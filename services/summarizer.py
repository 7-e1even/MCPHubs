"""
LLM 摘要服务

连接 MCP Server 获取 tools 列表，调用 OpenAI 兼容 API 生成一句话描述。
LLM 配置从数据库 settings 表读取（llm_base_url / llm_api_key / llm_model）。
"""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from db.engine import get_session_factory
from db.models import SettingModel

logger = logging.getLogger("mcphubs.services.summarizer")


async def _get_llm_config() -> dict[str, str]:
    """从数据库 settings 表读取 LLM 配置。"""
    keys = ("llm_base_url", "llm_api_key", "llm_model")
    factory = get_session_factory()
    async with factory() as session:
        config = {}
        for k in keys:
            row = await session.get(SettingModel, k)
            config[k] = row.value if row and row.value else ""
        return config


async def summarize_mcp(tools: list[dict[str, Any]]) -> str:
    """
    调用 OpenAI 兼容 Chat API，根据 tools 列表生成 MCP Server 描述。

    返回描述字符串；如果 LLM 未配置或调用失败，返回空字符串。
    """
    if not tools:
        return ""

    cfg = await _get_llm_config()
    base_url = cfg.get("llm_base_url", "").rstrip("/")
    api_key = cfg.get("llm_api_key", "")
    model = cfg.get("llm_model", "") or "gpt-4o-mini"

    if not base_url or not api_key:
        logger.debug("LLM 未配置，跳过摘要生成")
        return ""

    # 构建 tools 摘要（只取 name + description，精简 token）
    tool_summaries = []
    for t in tools[:30]:  # 限制最多 30 个 tool 防止 token 爆炸
        name = t.get("name", "unknown")
        desc = t.get("description", "")
        tool_summaries.append(f"- {name}: {desc}" if desc else f"- {name}")

    tools_text = "\n".join(tool_summaries)

    prompt = (
        "You are a concise technical writer. Based on the following MCP tools list, "
        "write a single short sentence (under 100 characters, in the same language as the tool descriptions) "
        "describing what this MCP Server does. No quotes, no markdown.\n\n"
        f"Tools:\n{tools_text}"
    )

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 150,
                    "temperature": 0.3,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"].strip()
            logger.info(f"LLM 生成描述: {content[:80]}")
            return content
    except Exception as e:
        logger.warning(f"LLM 摘要生成失败: {e}")
        return ""
