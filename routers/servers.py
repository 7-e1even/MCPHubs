"""
Server 管理路由

CRUD API for MCP Server 注册/注销/查看 + JSON 批量导入导出。
"""

from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from services.auth import get_current_user
from services.registry import Registry
from services.summarizer import summarize_mcp
from services.transport import create_client_factory
from config import MCPServerConfig

router = APIRouter(prefix="/api/servers", tags=["servers"])

_registry: Registry | None = None
_proxy: object | None = None


def inject(registry: Registry, proxy: object) -> None:
    global _registry, _proxy
    _registry, _proxy = registry, proxy


def _r() -> Registry:
    assert _registry is not None
    return _registry


def _p():
    assert _proxy is not None
    return _proxy


class RegisterRequest(BaseModel):
    name: str
    transport: str
    command: str | None = None
    args: list[str] = Field(default_factory=list)
    env: dict[str, str] = Field(default_factory=dict)
    url: str | None = None
    headers: dict[str, str] = Field(default_factory=dict)
    description: str | None = None


# ─── 基础 CRUD ───────────────────────────────────────────


@router.get("")
async def list_servers():
    """列出所有 MCP Server。"""
    return _r().list_all()


@router.get("/export")
async def export_servers(
    format: str = Query("generic", pattern="^(claude|vscode|generic)$"),
):
    """导出所有 MCP Server 为指定 JSON 格式。"""
    servers = _r().list_all()

    if format == "claude":
        # Claude Desktop 格式
        result: dict[str, Any] = {"mcpServers": {}}
        for s in servers:
            entry: dict[str, Any] = {}
            if s["transport"] == "stdio":
                entry["command"] = s.get("command", "")
                entry["args"] = s.get("args", [])
                if s.get("env"):
                    entry["env"] = s["env"]
            else:
                entry["url"] = s.get("url", "")
                if s.get("headers"):
                    entry["headers"] = s["headers"]
            result["mcpServers"][s["name"]] = entry
        return result

    elif format == "vscode":
        # VS Code 格式
        result = {"mcp": {"servers": {}}}
        for s in servers:
            entry = {"type": s["transport"]}
            if s["transport"] == "stdio":
                entry["command"] = s.get("command", "")
                entry["args"] = s.get("args", [])
                if s.get("env"):
                    entry["env"] = s["env"]
            else:
                entry["url"] = s.get("url", "")
                if s.get("headers"):
                    entry["headers"] = s["headers"]
            result["mcp"]["servers"][s["name"]] = entry
        return result

    else:
        # 通用数组格式
        return [
            {
                "name": s["name"],
                "transport": s["transport"],
                "command": s.get("command"),
                "args": s.get("args", []),
                "env": s.get("env", {}),
                "url": s.get("url"),
                "headers": s.get("headers", {}),
            }
            for s in servers
        ]


@router.get("/{name}")
async def get_server(name: str):
    """获取指定 Server 信息。"""
    try:
        return _r().get(name)
    except KeyError:
        raise HTTPException(404, f"Server '{name}' 不存在")


@router.post("", status_code=201)
async def register_server(req: RegisterRequest, _user: str = Depends(get_current_user)):
    """动态注册新 MCP Server（持久化到数据库）。"""
    if req.name in _r():
        raise HTTPException(409, f"Server '{req.name}' 已存在")

    cfg = MCPServerConfig(**req.model_dump())
    info = await _r().register(cfg)
    await _p().add_server(cfg)
    return info


@router.delete("/{name}")
async def unregister_server(name: str, _user: str = Depends(get_current_user)):
    """注销 MCP Server（从数据库移除）。"""
    if name not in _r():
        raise HTTPException(404, f"Server '{name}' 不存在")
    _p().remove_server(name)
    await _r().unregister(name)
    return {"status": "ok", "message": f"'{name}' 已注销"}


@router.put("/{name}")
async def update_server(name: str, req: RegisterRequest, _user: str = Depends(get_current_user)):
    """更新已有 MCP Server 的配置。"""
    if name not in _r():
        raise HTTPException(404, f"Server '{name}' 不存在")

    cfg = MCPServerConfig(name=name, **{k: v for k, v in req.model_dump().items() if k != "name"})

    # 先从 proxy 移除旧的，再重新添加
    _p().remove_server(name)
    info = await _r().update(name, cfg)
    await _p().add_server(cfg)
    return info


# ─── 描述生成 ────────────────────────────────────────


@router.post("/{name}/generate-description")
async def generate_description(name: str, _user: str = Depends(get_current_user)):
    """手动触发 LLM 生成指定 Server 的描述。"""
    if name not in _r():
        raise HTTPException(404, f"Server '{name}' 不存在")

    info = _r().get(name)
    cfg = MCPServerConfig(**{k: info[k] for k in MCPServerConfig.model_fields if k in info})

    try:
        factory = create_client_factory(cfg)
        async with factory() as client:
            tools = await client.list_tools()
            tools_info = [{"name": t.name, "description": t.description or ""} for t in tools]
    except Exception as e:
        raise HTTPException(500, f"连接 MCP 失败: {e}")

    desc = await summarize_mcp(tools_info)
    if not desc:
        raise HTTPException(500, "LLM 未配置或调用失败")

    await _r().set_description(name, desc)
    return {"status": "ok", "description": desc}


# ─── JSON 批量导入 ────────────────────────────────────────


def _parse_json_config(data: Any) -> list[dict[str, Any]]:
    """
    自动检测并解析多种 JSON 格式为统一的 server 列表。

    支持格式:
    1. Claude Desktop:   { "mcpServers": { "<name>": { "command": "...", ... } } }
    2. VS Code:          { "mcp": { "servers": { "<name>": { "type": "...", ... } } } }
                    或   { "servers": { "<name>": { ... } } }
    3. 通用数组:          [{ "name": "...", "transport": "...", ... }]
    4. 单个 server:      { "name": "...", "transport": "...", ... }
    """
    results = []

    def _extract_entry(name: str, cfg: dict) -> dict[str, Any]:
        """从单条配置中提取统一的 server 字段。"""
        transport = cfg.get("type", cfg.get("transport", "stdio"))
        # 没有显式 transport/type 时，根据有无 url 判断
        if transport == "stdio" and cfg.get("url") and not cfg.get("command"):
            transport = "sse"
        return {
            "name": name,
            "transport": transport,
            "command": cfg.get("command"),
            "args": cfg.get("args", []),
            "env": cfg.get("env", {}),
            "url": cfg.get("url"),
            "headers": cfg.get("headers", {}),
            # disabled=true → enabled=false
            "enabled": not cfg.get("disabled", False),
        }

    # 1) Claude Desktop 格式: { "mcpServers": { ... } }
    if isinstance(data, dict) and "mcpServers" in data:
        for name, cfg in data["mcpServers"].items():
            if not isinstance(cfg, dict):
                continue
            results.append(_extract_entry(name, cfg))
        return results

    # 2) VS Code 格式: { "mcp": { "servers": { ... } } }
    if isinstance(data, dict) and "mcp" in data:
        mcp_block = data["mcp"]
        if isinstance(mcp_block, dict) and "servers" in mcp_block:
            data = {"servers": mcp_block["servers"]}

    # 2b) VS Code 格式: { "servers": { ... } }
    if isinstance(data, dict) and "servers" in data and isinstance(data["servers"], dict):
        for name, cfg in data["servers"].items():
            if not isinstance(cfg, dict):
                continue
            results.append(_extract_entry(name, cfg))
        return results

    # 3) 通用数组: [{ "name": "...", ... }]
    if isinstance(data, list):
        for item in data:
            if isinstance(item, dict) and "name" in item:
                results.append(_extract_entry(item["name"], item))
        return results

    # 4) 单个 server (带 name 字段): { "name": "...", ... }
    if isinstance(data, dict) and "name" in data:
        return [_extract_entry(data["name"], data)]

    # 5) 裸 name-keyed 格式: { "bing-search": { "command": "...", ... } }
    #    判断: dict，且所有 value 都是 dict（排除与格式 4 混淆的情况）
    if isinstance(data, dict) and len(data) > 0:
        if all(isinstance(v, dict) for v in data.values()):
            for name, cfg in data.items():
                results.append(_extract_entry(name, cfg))
            return results

    return results


@router.post("/import")
async def import_servers(
    request: Request,
    _user: str = Depends(get_current_user),
):
    """
    JSON 批量导入 MCP Server。

    自动检测 Claude Desktop / VS Code / 通用格式。
    """
    body = await request.json()
    parsed = _parse_json_config(body)

    if not parsed:
        raise HTTPException(400, "无法解析 JSON 配置，请检查格式")

    imported = []
    skipped = []
    errors = []

    for entry in parsed:
        name = entry.get("name", "")
        if not name:
            errors.append({"name": "(empty)", "error": "缺少 name 字段"})
            continue

        if name in _r():
            skipped.append({"name": name, "reason": "已存在"})
            continue

        try:
            # 只保留 MCPServerConfig 接受的字段
            cfg_data = {k: v for k, v in entry.items() if k in MCPServerConfig.model_fields}
            cfg = MCPServerConfig(**cfg_data)
            info = await _r().register(cfg)
            await _p().add_server(cfg)
            imported.append({"name": name, "status": "ok"})
        except Exception as e:
            errors.append({"name": name, "error": str(e)})

    return {
        "imported": imported,
        "skipped": skipped,
        "errors": errors,
        "total_parsed": len(parsed),
    }


# ─── ModelScope 同步 ────────────────────────────────────────


@router.post("/sync-modelscope")
async def sync_modelscope(_user: str = Depends(get_current_user)):
    """
    从 ModelScope MCP 广场同步已启用的 MCP Server。

    读取数据库中的 modelscope_token，调用 ModelScope OpenAPI，
    将远程 Server 导入本地（跳过已存在的）。
    """
    from services.modelscope import fetch_modelscope_servers

    try:
        servers = await fetch_modelscope_servers()
    except ValueError as e:
        raise HTTPException(400, str(e))

    imported = []
    skipped = []
    errors = []

    for entry in servers:
        name = entry.get("name", "")
        if not name:
            continue

        if name in _r():
            skipped.append({"name": name, "reason": "已存在"})
            continue

        try:
            cfg = MCPServerConfig(
                name=name,
                transport=entry.get("transport", "sse"),
                url=entry.get("url"),
                description=entry.get("description", ""),
            )
            info = await _r().register(cfg)
            await _p().add_server(cfg)
            imported.append({"name": name, "status": "ok"})
        except Exception as e:
            errors.append({"name": name, "error": str(e)})

    return {
        "imported": imported,
        "skipped": skipped,
        "errors": errors,
        "total_fetched": len(servers),
    }
