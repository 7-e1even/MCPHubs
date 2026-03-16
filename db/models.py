"""
数据库模型

mcp_servers 表：存储所有注册的 MCP Server。
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import String, Text, DateTime, JSON, Boolean, Integer
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class MCPServerModel(Base):
    """MCP Server 表。"""

    __tablename__ = "mcp_servers"

    name: Mapped[str] = mapped_column(String(128), primary_key=True)
    transport: Mapped[str] = mapped_column(String(32), nullable=False)

    # stdio
    command: Mapped[str | None] = mapped_column(String(256), nullable=True)
    args: Mapped[list] = mapped_column(JSON, default=list)
    env: Mapped[dict] = mapped_column(JSON, default=dict)

    # sse / streamable-http
    url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    headers: Mapped[dict] = mapped_column(JSON, default=dict)

    # 状态
    status: Mapped[str] = mapped_column(String(32), default="registered")
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # 时间
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "transport": self.transport,
            "command": self.command,
            "args": self.args or [],
            "env": self.env or {},
            "url": self.url,
            "headers": self.headers or {},
            "status": self.status,
            "error_message": self.error_message,
            "enabled": self.enabled,
            "description": self.description,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class UserModel(Base):
    """用户表。"""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(256), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )


class SettingModel(Base):
    """系统设置表（key-value 存储）。"""

    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(128), primary_key=True)
    value: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
