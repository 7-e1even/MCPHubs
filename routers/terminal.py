"""
Web Terminal 路由

通过 WebSocket + PTY 提供浏览器内 Shell 终端。
仅在 Linux/macOS 上可用（依赖 fcntl/pty/termios）。
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import platform
import signal
import struct
import sys
import threading

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from services.auth import verify_token

logger = logging.getLogger("mcphubs.terminal")

router = APIRouter(prefix="/api/terminal", tags=["terminal"])

# PTY 模块仅 Linux/macOS 可用
_PTY_AVAILABLE = False
if platform.system() != "Windows":
    try:
        import fcntl
        import pty
        import termios
        _PTY_AVAILABLE = True
    except ImportError:
        pass


@router.websocket("/ws")
async def terminal_ws(
    websocket: WebSocket,
    token: str = Query(None),
    cols: int = Query(120),
    rows: int = Query(30),
):
    """WebSocket 终端，基于 PTY 实现真实 shell 交互。"""

    # 鉴权
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return
    try:
        await verify_token(token)
    except Exception:
        await websocket.close(code=4001, reason="Invalid token")
        return

    if not _PTY_AVAILABLE:
        await websocket.accept()
        await websocket.send_text(
            "\r\n\x1b[31mTerminal is only available in Linux/Docker environment.\x1b[0m\r\n"
        )
        await websocket.close()
        return

    await websocket.accept()

    loop = asyncio.get_event_loop()

    # 创建 PTY（fork 出子进程运行 shell）
    child_pid, fd = pty.fork()

    if child_pid == 0:
        # 子进程
        shell = os.environ.get("SHELL", "/bin/bash")
        if not os.path.exists(shell):
            shell = "/bin/sh"
        os.environ["TERM"] = "xterm-256color"
        os.environ["COLUMNS"] = str(cols)
        os.environ["LINES"] = str(rows)
        os.execlp(shell, shell, "--login")
        return

    # 父进程：设置初始窗口大小
    _set_winsize(fd, rows, cols)

    # 设置 fd 为非阻塞
    flag = fcntl.fcntl(fd, fcntl.F_GETFL)
    fcntl.fcntl(fd, fcntl.F_SETFL, flag | os.O_NONBLOCK)

    stop_event = threading.Event()

    async def _read_pty():
        """从 PTY 读取输出并发送到 WebSocket。"""
        try:
            while not stop_event.is_set():
                await asyncio.sleep(0.02)
                try:
                    data = os.read(fd, 4096)
                    if data:
                        await websocket.send_text(data.decode("utf-8", errors="replace"))
                except OSError:
                    continue
                except Exception:
                    break
        except Exception:
            pass

    read_task = asyncio.create_task(_read_pty())

    try:
        while True:
            data = await websocket.receive_text()

            # Resize 指令
            if data.startswith('{"type"'):
                try:
                    msg = json.loads(data)
                    if msg.get("type") == "resize":
                        _set_winsize(fd, msg.get("rows", 30), msg.get("cols", 120))
                        os.kill(child_pid, signal.SIGWINCH)
                        continue
                except (json.JSONDecodeError, ValueError):
                    pass

            # 普通输入
            os.write(fd, data.encode("utf-8"))

    except WebSocketDisconnect:
        logger.debug("Terminal WebSocket disconnected")
    except Exception as e:
        logger.debug(f"Terminal error: {e}")
    finally:
        stop_event.set()
        read_task.cancel()
        try:
            os.kill(child_pid, signal.SIGHUP)
            os.waitpid(child_pid, os.WNOHANG)
        except Exception:
            pass
        try:
            os.close(fd)
        except Exception:
            pass
        try:
            await websocket.close()
        except Exception:
            pass


def _set_winsize(fd: int, rows: int, cols: int):
    """设置 PTY 窗口大小。"""
    winsize = struct.pack("HHHH", rows, cols, 0, 0)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)
