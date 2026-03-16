"""
Transport 工厂

根据 transport 类型创建 FastMCP Client 工厂函数。
"""

from __future__ import annotations

import logging
from typing import Callable

from fastmcp import Client
from fastmcp.client.transports import (
    StdioTransport,
    SSETransport,
    StreamableHttpTransport,
)

from config import MCPServerConfig

logger = logging.getLogger("mcphubs.services.transport")


def create_client_factory(cfg: MCPServerConfig) -> Callable[[], Client]:
    """根据配置创建 Client 工厂。"""
    t = cfg.transport.lower().replace("_", "-")

    if t == "stdio":
        if not cfg.command:
            raise ValueError(f"[{cfg.name}] stdio 需要 command")

        def factory() -> Client:
            return Client(StdioTransport(
                command=cfg.command,
                args=cfg.args,
                env=cfg.env or None,
            ))
        logger.info(f"[{cfg.name}] stdio → {cfg.command} {' '.join(cfg.args)}")
        return factory

    elif t == "sse":
        if not cfg.url:
            raise ValueError(f"[{cfg.name}] sse 需要 url")

        def factory() -> Client:
            return Client(SSETransport(url=cfg.url, headers=cfg.headers or None))
        logger.info(f"[{cfg.name}] sse → {cfg.url}")
        return factory

    elif t in ("streamable-http", "streamablehttp", "http"):
        if not cfg.url:
            raise ValueError(f"[{cfg.name}] streamable-http 需要 url")

        def factory() -> Client:
            return Client(StreamableHttpTransport(url=cfg.url, headers=cfg.headers or None))
        logger.info(f"[{cfg.name}] http → {cfg.url}")
        return factory

    else:
        raise ValueError(f"[{cfg.name}] 不支持的 transport: {cfg.transport}")
