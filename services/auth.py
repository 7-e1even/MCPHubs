"""
认证服务

JWT 令牌生成 / 验证 + 密码哈希。
支持两种鉴权方式：
  1. JWT Token（登录获取，有过期时间）
  2. 静态 admin_token（Settings 中设置，永不过期，方便外部工具调用）
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from config import load_config

logger = logging.getLogger("mcphubs.auth")

security = HTTPBearer()

_cfg = load_config()
SECRET_KEY = _cfg.server.jwt_secret
ALGORITHM = "HS256"
EXPIRE_MINUTES = _cfg.server.jwt_expire_minutes


async def _check_admin_token(token: str) -> bool:
    """检查 token 是否匹配数据库中的 admin_token。"""
    try:
        from db.engine import get_session_factory
        from db.models import SettingModel
        factory = get_session_factory()
        async with factory() as session:
            row = await session.get(SettingModel, "admin_token")
            if row and row.value and row.value == token:
                return True
    except Exception:
        pass
    return False


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(username: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=EXPIRE_MINUTES)
    payload = {"sub": username, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


async def verify_token(token: str) -> str:
    """验证 Token，返回用户名。支持 JWT 和静态 admin_token。"""
    # 1) 静态 admin_token
    if await _check_admin_token(token):
        return "__admin_token__"
    # 2) JWT
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    username: str | None = payload.get("sub")
    if username is None:
        raise ValueError("Invalid token")
    return username


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    """FastAPI 依赖：从 Bearer Token 解析用户名。支持 JWT 和静态 admin_token。"""
    token = credentials.credentials
    # 1) 静态 admin_token
    if await _check_admin_token(token):
        return "__admin_token__"
    # 2) JWT
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str | None = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="无效凭证")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="无效凭证")
    return username
