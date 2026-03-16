"""
McpHub CLI 入口
"""

from __future__ import annotations

import logging

import click
import uvicorn

from config import load_config


@click.group()
def cli():
    """McpHub — Unified MCP Gateway"""
    pass


@cli.command()
@click.option("--host", "-h", default=None, help="监听地址")
@click.option("--port", "-p", default=None, type=int, help="监听端口")
@click.option("--log-level", default="info", help="日志级别")
def serve(host: str | None, port: int | None, log_level: str):
    """启动 McpHub Gateway。"""
    logging.basicConfig(
        level=getattr(logging, log_level.upper(), logging.INFO),
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
        datefmt="%H:%M:%S",
    )

    cfg = load_config()
    h = host or cfg.server.host
    p = port or cfg.server.port

    logging.getLogger("mcphubs").info(f"McpHub v0.1.0 starting...")

    from app import create_app
    application = create_app()
    uvicorn.run(application, host=h, port=p, log_level=log_level)


if __name__ == "__main__":
    cli()
