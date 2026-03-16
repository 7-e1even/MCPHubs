"""
渐进式披露代理

不直接暴露所有 tool，而是提供 3 个 meta tool：
  1. list_servers   → 查看有哪些 MCP Server
  2. list_tools     → 查看某个 Server 有哪些 tool
  3. call_tool      → 统一调用入口

Agent 只看到 3 个 tool，按需发现和调用。
"""

from __future__ import annotations

import json
import logging
from typing import Any

from fastmcp import FastMCP, Client

from config import GatewayConfig, MCPServerConfig
from services.registry import Registry
from services.transport import create_client_factory
from services.summarizer import summarize_mcp

logger = logging.getLogger("mcphubs.services.progressive")


class ProgressiveProxy:
    """渐进式披露的 MCP 代理。"""

    def __init__(self, config: GatewayConfig, registry: Registry) -> None:
        self.config = config
        self.registry = registry
        self._mcp = FastMCP(name=config.server.name)
        self._client_factories: dict[str, Any] = {}
        self._tools_cache: dict[str, list[dict[str, Any]]] = {}

        self._register_meta_tools()

    @property
    def mcp(self) -> FastMCP:
        return self._mcp

    async def add_server(self, cfg: MCPServerConfig) -> None:
        """注册 server（保存 client factory），缓存 tools 列表，并自动生成描述。"""
        try:
            factory = create_client_factory(cfg)
            self._client_factories[cfg.name] = factory
            await self.registry.set_status(cfg.name, "connected")
            logger.info(f"✓ {cfg.name} 已注册 (progressive)")

            # 拉取并缓存 tools 列表 + 自动生成描述
            try:
                async with factory() as client:
                    tools = await client.list_tools()
                    self._tools_cache[cfg.name] = [
                        {
                            "name": t.name,
                            "description": t.description or "",
                            "parameters": t.inputSchema if hasattr(t, "inputSchema") else {},
                        }
                        for t in tools
                    ]
                    logger.info(f"✓ {cfg.name} 缓存了 {len(self._tools_cache[cfg.name])} 个 tools")

                    # 自动生成描述（如果还没有）
                    info = self.registry.get(cfg.name)
                    if not info.get("description"):
                        tools_info = [{"name": t["name"], "description": t["description"]} for t in self._tools_cache[cfg.name]]
                        desc = await summarize_mcp(tools_info)
                        if desc:
                            await self.registry.set_description(cfg.name, desc)
                            logger.info(f"✓ {cfg.name} 描述已生成")
            except Exception as e:
                logger.debug(f"{cfg.name} tools 缓存/描述生成跳过: {e}")
                self._tools_cache[cfg.name] = []
        except Exception as e:
            await self.registry.set_status(cfg.name, "error", str(e))
            logger.error(f"✗ {cfg.name} 注册失败: {e}")

    def remove_server(self, name: str) -> None:
        self._client_factories.pop(name, None)
        self._tools_cache.pop(name, None)

    async def load_all(self) -> None:
        """从 YAML 导入 + DB 加载。"""
        for cfg in self.config.mcp_servers:
            await self.registry.import_from_yaml(cfg)

        await self.registry.load_from_db()

        for info in self.registry.list_all():
            cfg = MCPServerConfig(**{k: info[k] for k in MCPServerConfig.model_fields if k in info})
            await self.add_server(cfg)

        logger.info(f"加载完成: {len(self.registry)} 个 server (progressive)")

    def get_asgi_app(self, path: str = "/mcp"):
        return self._mcp.http_app(path=path)

    # ------------------------------------------------------------------
    # Meta Tools
    # ------------------------------------------------------------------

    def _register_meta_tools(self) -> None:
        registry = self.registry
        factories = self._client_factories
        tools_cache = self._tools_cache

        @self._mcp.tool
        async def list_servers() -> str:
            """
            列出所有可用的 MCP Server。
            返回每个 server 的名称、传输类型和状态。
            使用 list_tools 可以查看具体 server 提供的工具。
            """
            servers = registry.list_all()
            result = [
                {
                    "name": s["name"],
                    "transport": s["transport"],
                    "status": s["status"],
                    "description": s.get("description") or "",
                }
                for s in servers
            ]
            return json.dumps(result, ensure_ascii=False)

        @self._mcp.tool
        async def list_tools(mcp_name: str, verbose: bool = False) -> str:
            """
            列出指定 MCP Server 的所有可用工具。

            参数:
              mcp_name: MCP 名称（通过 list_servers 获取）
              verbose: 是否返回完整参数 schema（默认 false，只返回名称和描述）
            """
            if mcp_name not in factories:
                return json.dumps({"error": f"MCP '{mcp_name}' 不存在"})

            cached = tools_cache.get(mcp_name)
            if cached is not None:
                if verbose:
                    return json.dumps(cached, ensure_ascii=False)
                return json.dumps(
                    [{"name": t["name"], "description": t["description"]} for t in cached],
                    ensure_ascii=False,
                )

            # 缓存未命中（理论上不应发生），实时拉取
            factory = factories[mcp_name]
            try:
                async with factory() as client:
                    tools = await client.list_tools()
                    items = [
                        {
                            "name": t.name,
                            "description": t.description or "",
                            "parameters": t.inputSchema if hasattr(t, "inputSchema") else {},
                        }
                        for t in tools
                    ]
                    tools_cache[mcp_name] = items
                    if verbose:
                        return json.dumps(items, ensure_ascii=False)
                    return json.dumps(
                        [{"name": t["name"], "description": t["description"]} for t in items],
                        ensure_ascii=False,
                    )
            except Exception as e:
                return json.dumps({"error": str(e)})

        @self._mcp.tool
        async def refresh_tools(mcp_name: str) -> str:
            """
            刷新指定 MCP Server 的工具缓存。

            参数:
              mcp_name: MCP 名称
            """
            if mcp_name not in factories:
                return json.dumps({"error": f"MCP '{mcp_name}' 不存在"})

            factory = factories[mcp_name]
            try:
                async with factory() as client:
                    tools = await client.list_tools()
                    tools_cache[mcp_name] = [
                        {
                            "name": t.name,
                            "description": t.description or "",
                            "parameters": t.inputSchema if hasattr(t, "inputSchema") else {},
                        }
                        for t in tools
                    ]
                    return json.dumps({"status": "ok", "tools_count": len(tools_cache[mcp_name])})
            except Exception as e:
                return json.dumps({"error": str(e)})

        @self._mcp.tool
        async def call_tool(mcp_name: str, tool_name: str, arguments: str = "{}") -> str:
            """
            调用指定 MCP Server 上的指定工具。

            参数:
              mcp_name: MCP 名称
              tool_name: 工具名称（通过 list_tools 获取）
              arguments: JSON 格式的参数字符串，例如 '{"query": "test"}'
            """
            if mcp_name not in factories:
                return json.dumps({"error": f"MCP '{mcp_name}' 不存在"})

            factory = factories[mcp_name]
            try:
                args = json.loads(arguments) if isinstance(arguments, str) else arguments
            except json.JSONDecodeError as e:
                return json.dumps({"error": f"arguments JSON 解析失败: {e}"})

            try:
                async with factory() as client:
                    result = await client.call_tool(tool_name, args)
                    texts = []
                    for item in result:
                        if hasattr(item, "text"):
                            texts.append(item.text)
                        else:
                            texts.append(str(item))
                    return "\n".join(texts)
            except Exception as e:
                return json.dumps({"error": str(e)})
