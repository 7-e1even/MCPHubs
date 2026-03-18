"""
McpHub 配置

使用 pydantic-settings 直接从环境变量 / .env 加载，
不再依赖 mcphubs.yaml。
"""

from __future__ import annotations

import secrets

from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class MCPServerConfig(BaseModel):
    """单个 MCP Server 配置。"""
    name: str = Field(..., description="唯一标识名")
    transport: str = Field(..., description="stdio / sse / streamable-http")

    # stdio 专用
    command: str | None = None
    args: list[str] = Field(default_factory=list)
    env: dict[str, str] = Field(default_factory=dict)

    # sse / streamable-http 专用
    url: str | None = None
    headers: dict[str, str] = Field(default_factory=dict)

    # 描述（LLM 自动生成或手动填写）
    description: str | None = None

    # 暴露模式：progressive（走 meta-tool）或 direct（直接暴露工具）
    exposure: str = "progressive"


class ServerConfig(BaseSettings):
    """Gateway 核心配置，全部来自环境变量。"""

    model_config = SettingsConfigDict(
        env_prefix="MCPHUBS_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    host: str = "0.0.0.0"
    port: int = 8000
    name: str = "McpHub"
    database_url: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/mcphubs",
        description="PostgreSQL 连接字符串",
    )
    api_key: str = Field(default="", description="API Key，为空则不鉴权")
    exposure_mode: str = Field(
        default="progressive",
        description="暴露模式: full / progressive",
    )
    jwt_secret: str = Field(
        default_factory=lambda: secrets.token_urlsafe(32),
        description="JWT 签名密钥（未配置时每次启动自动生成）",
    )
    jwt_expire_minutes: int = Field(
        default=1440,
        description="JWT 过期时间（分钟），默认 24 小时",
    )
    admin_username: str = Field(
        default="admin",
        description="默认管理员用户名",
    )
    admin_password: str = Field(
        default="admin123",
        description="默认管理员密码",
    )
    files_root: str = Field(
        default="/app/installed",
        description="文件管理器根目录",
    )


class GatewayConfig:
    """顶层配置容器（保持与原有代码兼容）。"""

    def __init__(self) -> None:
        self.server = ServerConfig()
        self.mcp_servers: list[MCPServerConfig] = []


def load_config() -> GatewayConfig:
    """加载配置（纯环境变量驱动）。"""
    return GatewayConfig()
