"""
数据库连接管理

提供 async SQLAlchemy engine 和 session。
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def init_engine(database_url: str) -> AsyncEngine:
    """初始化数据库引擎。"""
    global _engine, _session_factory

    _engine = create_async_engine(database_url, echo=False)
    _session_factory = async_sessionmaker(_engine, expire_on_commit=False)
    return _engine


def get_engine() -> AsyncEngine:
    assert _engine is not None, "数据库未初始化，先调用 init_engine()"
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    assert _session_factory is not None, "数据库未初始化"
    return _session_factory


async def get_session() -> AsyncSession:
    """获取一个新的 async session（用于 FastAPI 依赖注入）。"""
    factory = get_session_factory()
    async with factory() as session:
        yield session
