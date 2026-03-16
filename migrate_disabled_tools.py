"""
迁移脚本：为 mcp_servers 表添加 disabled_tools 列
运行方式: python migrate_disabled_tools.py
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from config import ServerConfig

async def migrate():
    cfg = ServerConfig()
    engine = create_async_engine(cfg.database_url)
    
    async with engine.begin() as conn:
        # 检查列是否已存在
        result = await conn.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = 'mcp_servers' AND column_name = 'disabled_tools'"
        ))
        if result.fetchone():
            print("✓ disabled_tools 列已存在，无需迁移")
        else:
            await conn.execute(text(
                "ALTER TABLE mcp_servers ADD COLUMN disabled_tools JSONB DEFAULT '[]'::jsonb"
            ))
            print("✓ 已添加 disabled_tools 列")
    
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(migrate())
