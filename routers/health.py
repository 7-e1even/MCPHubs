"""
健康检查路由
"""

from __future__ import annotations

from fastapi import APIRouter

from services.registry import Registry

router = APIRouter(prefix="/api", tags=["health"])

_registry: Registry | None = None
_name: str = "McpHub"


def inject(registry: Registry, name: str) -> None:
    global _registry, _name
    _registry, _name = registry, name


@router.get("/health")
async def health():
    return {
        "status": "ok",
        "name": _name,
        "servers_count": len(_registry) if _registry else 0,
    }
