"""
Server 注册中心（PostgreSQL 版）

所有 MCP Server 的 CRUD 操作通过 SQLAlchemy 异步读写 PostgreSQL。
"""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from db.models import MCPServerModel
from config import MCPServerConfig

logger = logging.getLogger("mcphubs.services.registry")


class Registry:
    """MCP Server 注册中心（PostgreSQL 存储）。"""

    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self._sf = session_factory
        # 内存缓存，启动时从 DB 加载
        self._cache: dict[str, dict[str, Any]] = {}

    async def load_from_db(self) -> None:
        """启动时从 DB 加载所有 server 到内存缓存。"""
        async with self._sf() as session:
            result = await session.execute(select(MCPServerModel))
            rows = result.scalars().all()
            self._cache = {r.name: r.to_dict() for r in rows}
        logger.info(f"从数据库加载了 {len(self._cache)} 个 server")

    async def register(self, config: MCPServerConfig) -> dict[str, Any]:
        """注册新 MCP Server（写入 DB + 缓存）。"""
        async with self._sf() as session:
            existing = await session.get(MCPServerModel, config.name)
            if existing:
                raise ValueError(f"Server '{config.name}' 已存在")

            row = MCPServerModel(
                name=config.name,
                transport=config.transport,
                command=config.command,
                args=config.args,
                env=config.env,
                url=config.url,
                headers=config.headers,
                description=config.description,
                status="registered",
            )
            session.add(row)
            await session.commit()
            await session.refresh(row)

            self._cache[config.name] = row.to_dict()
            logger.info(f"注册: {config.name} ({config.transport})")
            return self._cache[config.name]

    async def unregister(self, name: str) -> dict[str, Any]:
        """注销 MCP Server（从 DB + 缓存移除）。"""
        if name not in self._cache:
            raise KeyError(f"Server '{name}' 不存在")

        info = self._cache.pop(name)
        async with self._sf() as session:
            await session.execute(
                delete(MCPServerModel).where(MCPServerModel.name == name)
            )
            await session.commit()

        logger.info(f"注销: {name}")
        return info

    async def update(self, name: str, config: MCPServerConfig) -> dict[str, Any]:
        """更新已有 MCP Server 的配置（DB + 缓存）。"""
        if name not in self._cache:
            raise KeyError(f"Server '{name}' 不存在")

        async with self._sf() as session:
            row = await session.get(MCPServerModel, name)
            if not row:
                raise KeyError(f"Server '{name}' 不存在")

            row.transport = config.transport
            row.command = config.command
            row.args = config.args
            row.env = config.env
            row.url = config.url
            row.headers = config.headers
            if config.description is not None:
                row.description = config.description
            await session.commit()
            await session.refresh(row)

            self._cache[name] = row.to_dict()
            logger.info(f"更新: {name} ({config.transport})")
            return self._cache[name]

    async def set_status(self, name: str, status: str, error: str | None = None) -> None:
        """更新 server 状态。"""
        if name in self._cache:
            self._cache[name]["status"] = status
            self._cache[name]["error_message"] = error

        async with self._sf() as session:
            row = await session.get(MCPServerModel, name)
            if row:
                row.status = status
                row.error_message = error
                await session.commit()

    async def set_description(self, name: str, description: str) -> None:
        """更新 server 描述。"""
        if name in self._cache:
            self._cache[name]["description"] = description

        async with self._sf() as session:
            row = await session.get(MCPServerModel, name)
            if row:
                row.description = description
                await session.commit()

    async def set_disabled_tools(self, name: str, disabled_tools: list[str]) -> None:
        """更新 server 的禁用工具列表。"""
        if name in self._cache:
            self._cache[name]["disabled_tools"] = disabled_tools

        async with self._sf() as session:
            row = await session.get(MCPServerModel, name)
            if row:
                row.disabled_tools = disabled_tools
                await session.commit()

    async def import_from_yaml(self, config: MCPServerConfig) -> None:
        """从 YAML 导入（如果 DB 中不存在则插入）。"""
        async with self._sf() as session:
            existing = await session.get(MCPServerModel, config.name)
            if existing:
                self._cache[config.name] = existing.to_dict()
                return  # 已存在，跳过

        await self.register(config)
        logger.info(f"从 YAML 导入: {config.name}")

    def get(self, name: str) -> dict[str, Any]:
        """从缓存获取 server 信息。"""
        if name not in self._cache:
            raise KeyError(f"Server '{name}' 不存在")
        return self._cache[name]

    def list_all(self) -> list[dict[str, Any]]:
        """列出所有 server（从缓存）。"""
        return list(self._cache.values())

    def __len__(self) -> int:
        return len(self._cache)

    def __contains__(self, name: str) -> bool:
        return name in self._cache
