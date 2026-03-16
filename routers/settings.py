"""
Settings 路由

GET  /api/settings          — 获取所有设置
PUT  /api/settings/:key     — 更新单个设置
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from db.engine import get_session_factory
from db.models import SettingModel
from services.auth import get_current_user

router = APIRouter(prefix="/api/settings", tags=["settings"])

# 允许通过 UI 修改的 key 白名单
ALLOWED_KEYS = {"api_key", "llm_base_url", "llm_api_key", "llm_model", "modelscope_token"}


class UpdateSettingRequest(BaseModel):
    value: str


@router.get("")
async def get_settings(_user: str = Depends(get_current_user)):
    """获取所有设置。"""
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(select(SettingModel))
        rows = result.scalars().all()

    return {r.key: r.value for r in rows}


@router.put("/{key}")
async def update_setting(
    key: str,
    req: UpdateSettingRequest,
    _user: str = Depends(get_current_user),
):
    """更新指定设置。"""
    if key not in ALLOWED_KEYS:
        raise HTTPException(400, f"Setting '{key}' is not configurable")

    factory = get_session_factory()
    async with factory() as session:
        existing = await session.get(SettingModel, key)
        if existing:
            existing.value = req.value
        else:
            session.add(SettingModel(key=key, value=req.value))
        await session.commit()

    return {"status": "ok", "key": key}
