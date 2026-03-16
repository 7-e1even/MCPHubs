"""
ModelScope MCP 同步服务

调用 ModelScope OpenAPI 获取用户已启用的 MCP Server 列表。
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from db.engine import get_session_factory
from db.models import SettingModel

logger = logging.getLogger("mcphubs.services.modelscope")

MODELSCOPE_API_BASE = "https://modelscope.cn/openapi/v1"


async def _get_modelscope_token() -> str:
    """从数据库 settings 表读取 ModelScope SDK Token。"""
    factory = get_session_factory()
    async with factory() as session:
        row = await session.get(SettingModel, "modelscope_token")
        return row.value if row and row.value else ""


async def fetch_modelscope_servers(token: str | None = None) -> list[dict[str, Any]]:
    """
    调用 ModelScope OpenAPI 获取已启用的 MCP Server 列表。

    返回统一格式:
    [
        {
            "name": "fetch-网页内容抓取",
            "transport": "sse",
            "url": "https://mcp.api-inference.modelscope.net/...",
        },
        ...
    ]
    """
    if not token:
        token = await _get_modelscope_token()

    if not token:
        raise ValueError("ModelScope SDK Token 未配置")

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{MODELSCOPE_API_BASE}/mcp/servers/operational",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
            )
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPStatusError as e:
        logger.error(f"ModelScope API 调用失败: HTTP {e.response.status_code}")
        raise ValueError(f"ModelScope API 返回错误: HTTP {e.response.status_code}")
    except Exception as e:
        logger.error(f"ModelScope API 请求异常: {e}")
        raise ValueError(f"ModelScope API 请求失败: {e}")

    # 解析返回数据
    servers = []
    raw_list = []

    if isinstance(data, dict):
        # 尝试多种可能的返回结构
        if "data" in data:
            d = data["data"]
            if isinstance(d, dict) and "mcp_server_list" in d:
                raw_list = d["mcp_server_list"]
            elif isinstance(d, list):
                raw_list = d
        elif "mcp_server_list" in data:
            raw_list = data["mcp_server_list"]
    elif isinstance(data, list):
        raw_list = data

    for item in raw_list:
        if not isinstance(item, dict):
            continue

        # 提取名称（优先 chinese_name，其次 name）
        name = item.get("chinese_name") or item.get("name") or ""
        if not name:
            continue

        # 清理名称：去掉 @ 前缀、/ 替换为 -，保持可读性
        clean_name = name.replace("@", "").replace("/", "-")

        # 从 operational_urls 提取第一个可用的 URL
        url = ""
        transport = "sse"
        op_urls = item.get("operational_urls", [])
        if isinstance(op_urls, list):
            for ou in op_urls:
                if isinstance(ou, dict) and ou.get("url"):
                    url = ou["url"]
                    t = ou.get("transport_type", "").lower()
                    if t in ("sse", "streamable_http", "streamable-http"):
                        transport = t.replace("_", "-")
                    break

        # 兜底：尝试 remote_config
        if not url:
            remote_cfg = item.get("remote_config", {})
            if isinstance(remote_cfg, dict):
                url = remote_cfg.get("url", "")
                t = remote_cfg.get("transport_type", "").lower()
                if t in ("sse", "streamable-http", "streamable_http"):
                    transport = t.replace("_", "-")

        if not url:
            continue

        servers.append({
            "name": f"ms-{clean_name}",
            "transport": transport,
            "url": url,
            "description": item.get("description", ""),
        })

    logger.info(f"从 ModelScope 获取到 {len(servers)} 个 MCP Server")
    return servers
