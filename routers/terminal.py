"""
Web Terminal 路由

通过 WebSocket 提供浏览器内 Shell 终端。
使用 asyncio subprocess 双向转发 stdin/stdout。
"""

from __future__ import annotations

import asyncio
import logging
import os
import struct

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from services.auth import verify_token

logger = logging.getLogger("mcphubs.terminal")

router = APIRouter(prefix="/api/terminal", tags=["terminal"])


@router.websocket("/ws")
async def terminal_ws(
    websocket: WebSocket,
    token: str = Query(None, description="JWT Token"),
    cols: int = Query(120, description="终端列数"),
    rows: int = Query(30, description="终端行数"),
):
    """
    WebSocket 终端。

    连接时通过 query param `token` 鉴权。
    消息协议：
    - 客户端 → 服务端：纯文本（stdin 数据）或 JSON（resize 指令）
    - 服务端 → 客户端：纯文本（stdout/stderr 数据）
    """
    # 鉴权
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return

    try:
        verify_token(token)
    except Exception:
        await websocket.close(code=4001, reason="Invalid token")
        return

    await websocket.accept()

    # 确定 shell
    shell = "/bin/bash" if os.path.exists("/bin/bash") else "/bin/sh"

    try:
        # 创建子进程
        process = await asyncio.create_subprocess_exec(
            shell,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            env={**os.environ, "TERM": "xterm-256color", "COLUMNS": str(cols), "ROWS": str(rows)},
        )

        async def _read_output():
            """从子进程 stdout 读取并发送到 WebSocket。"""
            try:
                while process.stdout and not process.stdout.at_eof():
                    data = await process.stdout.read(4096)
                    if data:
                        await websocket.send_text(data.decode("utf-8", errors="replace"))
                    else:
                        break
            except (WebSocketDisconnect, ConnectionError):
                pass
            except Exception as e:
                logger.debug(f"读取输出异常: {e}")

        # 启动输出读取任务
        read_task = asyncio.create_task(_read_output())

        # 从 WebSocket 读取输入并写入子进程 stdin
        try:
            while True:
                data = await websocket.receive_text()

                # 检查是否是 resize 指令
                if data.startswith('{"type":"resize"'):
                    import json
                    try:
                        msg = json.loads(data)
                        if msg.get("type") == "resize":
                            # 非 pty 模式下忽略 resize
                            pass
                    except json.JSONDecodeError:
                        pass
                    continue

                if process.stdin:
                    process.stdin.write(data.encode("utf-8"))
                    await process.stdin.drain()

        except WebSocketDisconnect:
            logger.debug("WebSocket 断开连接")
        except Exception as e:
            logger.debug(f"处理输入异常: {e}")

    except Exception as e:
        logger.error(f"终端创建失败: {e}")
        try:
            await websocket.send_text(f"\r\nError: {e}\r\n")
        except Exception:
            pass
    finally:
        # 清理
        try:
            read_task.cancel()
        except Exception:
            pass
        try:
            if process.returncode is None:
                process.terminate()
                await asyncio.wait_for(process.wait(), timeout=3)
        except Exception:
            try:
                process.kill()
            except Exception:
                pass
        try:
            await websocket.close()
        except Exception:
            pass
