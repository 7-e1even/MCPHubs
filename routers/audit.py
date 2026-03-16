"""
审计日志路由

GET  /api/audit       — 分页查询调用日志
GET  /api/audit/stats — 统计概要
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, desc

from db.engine import get_session_factory
from db.models import AuditLogModel
from services.auth import get_current_user

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("")
async def list_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    server_name: str | None = Query(None),
    tool_name: str | None = Query(None),
    status: str | None = Query(None),
    _user: str = Depends(get_current_user),
):
    """分页查询调用日志。"""
    factory = get_session_factory()
    async with factory() as session:
        q = select(AuditLogModel)

        if server_name:
            q = q.where(AuditLogModel.server_name == server_name)
        if tool_name:
            q = q.where(AuditLogModel.tool_name.contains(tool_name))
        if status:
            q = q.where(AuditLogModel.status == status)

        # 总数
        count_q = select(func.count()).select_from(q.subquery())
        total = (await session.execute(count_q)).scalar() or 0

        # 分页
        q = q.order_by(desc(AuditLogModel.created_at))
        q = q.offset((page - 1) * page_size).limit(page_size)
        result = await session.execute(q)
        rows = result.scalars().all()

    return {
        "items": [r.to_dict() for r in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, (total + page_size - 1) // page_size),
    }


@router.get("/stats")
async def audit_stats(_user: str = Depends(get_current_user)):
    """统计概要：总调用数、成功数、失败数、各 server 调用数。"""
    factory = get_session_factory()
    async with factory() as session:
        total = (await session.execute(select(func.count(AuditLogModel.id)))).scalar() or 0
        success = (await session.execute(
            select(func.count(AuditLogModel.id)).where(AuditLogModel.status == "success")
        )).scalar() or 0
        errors = total - success

        # 各 server 调用数 top 10
        server_q = (
            select(AuditLogModel.server_name, func.count(AuditLogModel.id).label("count"))
            .group_by(AuditLogModel.server_name)
            .order_by(desc("count"))
            .limit(10)
        )
        server_rows = (await session.execute(server_q)).all()

    return {
        "total": total,
        "success": success,
        "errors": errors,
        "by_server": [{"server_name": r[0], "count": r[1]} for r in server_rows],
    }
