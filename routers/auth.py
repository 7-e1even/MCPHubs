"""
认证路由

POST /api/auth/login — 登录，返回 JWT
POST /api/auth/change-password — 修改密码
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select

from db.engine import get_session_factory
from db.models import UserModel
from services.auth import verify_password, hash_password, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=2, max_length=64)
    password: str = Field(..., min_length=4, max_length=128)


class ChangePasswordRequest(BaseModel):
    old_password: str = Field(..., min_length=4, max_length=128)
    new_password: str = Field(..., min_length=4, max_length=128)


@router.post("/login")
async def login(req: LoginRequest):
    """登录并返回 JWT。"""
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(
            select(UserModel).where(UserModel.username == req.username)
        )
        user = result.scalar_one_or_none()

    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(401, "用户名或密码错误")

    token = create_access_token(user.username)
    return {"access_token": token, "token_type": "bearer"}


@router.post("/change-password")
async def change_password(
    req: ChangePasswordRequest,
    current_user: str = Depends(get_current_user),
):
    """修改当前用户密码。"""
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(
            select(UserModel).where(UserModel.username == current_user)
        )
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(404, "用户不存在")

        if not verify_password(req.old_password, user.hashed_password):
            raise HTTPException(400, "原密码错误")

        user.hashed_password = hash_password(req.new_password)
        await session.commit()

    return {"status": "ok", "message": "密码修改成功"}
