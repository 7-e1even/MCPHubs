"""
MCP 代理核心（full 模式）

将注册的 MCP Server 通过 ProxyProvider 聚合到 FastMCP Gateway，
统一暴露为 Streamable HTTP。
"""

from __future__ import annotations

import logging

from fastmcp import FastMCP
from fastmcp.server.providers.proxy import ProxyProvider

from config import GatewayConfig, MCPServerConfig
from services.registry import Registry
from services.transport import create_client_factory
from services.summarizer import summarize_mcp

logger = logging.getLogger("mcphubs.services.proxy")


class MCPProxy:
    """MCP 代理服务（full 模式）。"""

    def __init__(self, config: GatewayConfig, registry: Registry) -> None:
        self.config = config
        self.registry = registry
        self._mcp = FastMCP(name=config.server.name)
        self._providers: dict[str, ProxyProvider] = {}

    @property
    def mcp(self) -> FastMCP:
        return self._mcp

    async def add_server(self, cfg: MCPServerConfig) -> None:
        """注册并挂载 ProxyProvider，自动生成描述。"""
        try:
            factory = create_client_factory(cfg)
            provider = ProxyProvider(client_factory=factory, prefix=cfg.name)
            self._mcp.add_provider(provider)
            self._providers[cfg.name] = provider
            await self.registry.set_status(cfg.name, "connected")
            logger.info(f"✓ {cfg.name} 已挂载")

            # 自动生成描述（如果还没有）
            info = self.registry.get(cfg.name)
            if not info.get("description"):
                try:
                    async with factory() as client:
                        tools = await client.list_tools()
                        tools_info = [{"name": t.name, "description": t.description or ""} for t in tools]
                    desc = await summarize_mcp(tools_info)
                    if desc:
                        await self.registry.set_description(cfg.name, desc)
                        logger.info(f"✓ {cfg.name} 描述已生成")
                except Exception as e:
                    logger.debug(f"{cfg.name} 描述生成跳过: {e}")
        except Exception as e:
            await self.registry.set_status(cfg.name, "error", str(e))
            logger.error(f"✗ {cfg.name} 挂载失败: {e}")

    def remove_server(self, name: str) -> None:
        if name in self._providers:
            del self._providers[name]

    async def load_all(self) -> None:
        """从 YAML 导入 + 从 DB 加载，然后挂载所有 server。"""
        # 1. YAML 中的 server 导入到 DB
        for cfg in self.config.mcp_servers:
            await self.registry.import_from_yaml(cfg)

        # 2. 从 DB 加载全部
        await self.registry.load_from_db()

        # 3. 挂载所有
        for info in self.registry.list_all():
            cfg = MCPServerConfig(**{k: info[k] for k in MCPServerConfig.model_fields if k in info})
            await self.add_server(cfg)

        logger.info(f"加载完成: {len(self.registry)} 个 server")

    def get_asgi_app(self, path: str = "/mcp"):
        return self._mcp.http_app(path=path)
