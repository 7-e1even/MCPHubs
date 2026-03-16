"""
McpHub FastAPI 应用

组装所有组件：
  /mcp       → Streamable HTTP（AI Client 连接，需 api_key 鉴权）
  /api/*     → 管理 API
  /docs      → Swagger UI
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from config import load_config
from db.engine import init_engine, get_session_factory
from db.models import Base, SettingModel
from services.registry import Registry
from routers import servers as servers_router
from routers import health as health_router
from routers import auth as auth_router
from routers import settings as settings_router
from routers import audit as audit_router

logger = logging.getLogger("mcphubs")


class ApiKeyMiddleware(BaseHTTPMiddleware):
    """对 /mcp 端点做 Bearer Token 鉴权（从数据库读取 api_key）。"""

    def __init__(self, app, fallback_key: str = ""):
        super().__init__(app)
        self.fallback_key = fallback_key

    async def _get_api_key(self) -> str:
        """从数据库获取 api_key，如果没有则回退到环境变量配置。"""
        try:
            from sqlalchemy import select
            factory = get_session_factory()
            async with factory() as session:
                row = await session.get(SettingModel, "api_key")
                if row and row.value:
                    return row.value
        except Exception:
            pass
        return self.fallback_key

    async def dispatch(self, request: Request, call_next):
        if request.url.path.startswith("/mcp"):
            api_key = await self._get_api_key()
            if api_key:  # 仅在 api_key 非空时鉴权
                auth = request.headers.get("Authorization", "")
                token = auth.removeprefix("Bearer ").strip() if auth.startswith("Bearer ") else ""
                if token != api_key:
                    return JSONResponse(status_code=401, content={"error": "Invalid API key"})
        return await call_next(request)


def create_app() -> FastAPI:
    """构建 FastAPI 应用。"""

    config = load_config()
    logger.info(f"配置加载: {config.server.name}")

    # --- 数据库 ---
    engine = init_engine(config.server.database_url)
    session_factory = get_session_factory()

    # --- 生命周期 ---
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        # 启动：建表 + 加载 server
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            # Auto-migrate: ensure disabled_tools column exists (for upgrades)
            from sqlalchemy import text
            result = await conn.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = 'mcp_servers' AND column_name = 'disabled_tools'"
            ))
            if not result.fetchone():
                await conn.execute(text(
                    "ALTER TABLE mcp_servers ADD COLUMN disabled_tools JSONB DEFAULT '[]'::jsonb"
                ))
                logger.info("✓ 自动迁移: 已添加 disabled_tools 列")
        logger.info("数据库表已就绪")

        # 自动创建默认管理员
        from sqlalchemy import select
        from db.models import UserModel
        from services.auth import hash_password

        async with session_factory() as session:
            exists = await session.execute(
                select(UserModel).where(UserModel.username == config.server.admin_username)
            )
            if not exists.scalar_one_or_none():
                session.add(UserModel(
                    username=config.server.admin_username,
                    hashed_password=hash_password(config.server.admin_password),
                ))
                await session.commit()
                logger.info(f"默认管理员 '{config.server.admin_username}' 已创建")

        # 初始化 api_key 设置（从环境变量迁移到数据库）
        async with session_factory() as session:
            existing_key = await session.get(SettingModel, "api_key")
            if not existing_key and config.server.api_key:
                session.add(SettingModel(key="api_key", value=config.server.api_key))
                await session.commit()
                logger.info("API Key 已从环境变量迁移到数据库")

        registry = Registry(session_factory)
        mode = config.server.exposure_mode.lower()

        if mode == "progressive":
            from services.progressive import ProgressiveProxy
            proxy = ProgressiveProxy(config, registry)
            logger.info("暴露模式: progressive")
        else:
            from services.proxy import MCPProxy
            proxy = MCPProxy(config, registry)
            logger.info("暴露模式: full")

        await proxy.load_all()

        # 注入到 routers
        servers_router.inject(registry, proxy)
        health_router.inject(registry, config.server.name, config.server.exposure_mode, proxy)

        # 挂载 MCP 端点
        mcp_app = proxy.get_asgi_app(path="/mcp")
        app.mount("/", mcp_app)

        logger.info(f"McpHub 就绪")
        logger.info(f"  MCP:   http://{config.server.host}:{config.server.port}/mcp")
        logger.info(f"  API:   http://{config.server.host}:{config.server.port}/api/servers")
        logger.info(f"  Docs:  http://{config.server.host}:{config.server.port}/docs")

        # 链接 MCP app 的 lifespan（初始化 StreamableHTTPSessionManager 的 task group）
        async with mcp_app.router.lifespan_context(mcp_app):
            yield

        # 关闭
        await engine.dispose()

    # --- FastAPI App ---
    app = FastAPI(
        title=config.server.name,
        description="McpHub — Unified MCP Gateway",
        version="0.1.0",
        lifespan=lifespan,
    )

    # API Key 鉴权（始终启用中间件，从 DB 动态读取 key）
    app.add_middleware(ApiKeyMiddleware, fallback_key=config.server.api_key)
    logger.info("API Key 鉴权中间件: 已挂载（动态读取数据库）")

    # 管理 API（路由先注册，inject 在 lifespan 里做）
    app.include_router(health_router.router)
    app.include_router(servers_router.router)
    app.include_router(auth_router.router)
    app.include_router(settings_router.router)
    app.include_router(audit_router.router)

    # CORS（开发环境允许 Next.js dev server）
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    return app
