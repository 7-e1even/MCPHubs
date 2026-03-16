"""
健康检查路由
"""

from __future__ import annotations

import os

from fastapi import APIRouter

from services.registry import Registry

router = APIRouter(prefix="/api", tags=["health"])

_registry: Registry | None = None
_proxy = None
_name: str = "McpHub"
_exposure_mode: str = "progressive"
try:
    import psutil
    _proc = psutil.Process(os.getpid())
    _proc.cpu_percent()  # Initial call to set the baseline
except ImportError:
    _proc = None


def inject(registry: Registry, name: str, exposure_mode: str = "progressive", proxy=None) -> None:
    global _registry, _name, _exposure_mode, _proxy
    _registry, _name = registry, name
    _exposure_mode = exposure_mode
    _proxy = proxy


def _get_process_metrics() -> dict:
    """获取当前进程的 CPU 和内存占用"""
    if not _proc:
        return {
            "cpu_percent": 0,
            "memory_used_mb": 0,
            "memory_total_mb": 0,
            "memory_percent": 0,
        }

    try:
        import psutil
        mem = _proc.memory_info()
        # Returns CPU usage since last call (non-blocking)
        cpu = _proc.cpu_percent(interval=None)
        sys_mem = psutil.virtual_memory()
        return {
            "cpu_percent": round(cpu, 1),
            "memory_used_mb": round(mem.rss / 1024 / 1024, 1),
            "memory_total_mb": round(sys_mem.total / 1024 / 1024, 0),
            "memory_percent": round(mem.rss / sys_mem.total * 100, 1),
        }
    except Exception:
        return {
            "cpu_percent": 0,
            "memory_used_mb": 0,
            "memory_total_mb": 0,
            "memory_percent": 0,
        }


@router.get("/health")
async def health():
    # Count total tools from proxy cache
    total_tools = 0
    if _proxy and hasattr(_proxy, "_tools_cache"):
        for tools in _proxy._tools_cache.values():
            total_tools += len(tools)

    metrics = _get_process_metrics()

    return {
        "status": "ok",
        "name": _name,
        "servers_count": len(_registry) if _registry else 0,
        "exposure_mode": _exposure_mode,
        "total_tools": total_tools,
        **metrics,
    }
