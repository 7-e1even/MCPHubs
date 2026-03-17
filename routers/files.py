"""
文件管理路由

浏览、上传、下载、编辑、删除服务器文件。
"""

from __future__ import annotations

import os
import shutil
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Body
from fastapi.responses import FileResponse
from pydantic import BaseModel

from config import ServerConfig
from services.auth import get_current_user

router = APIRouter(prefix="/api/files", tags=["files"])

# 默认文件根目录，可通过环境变量覆盖
_files_root: str = ""


def get_files_root() -> str:
    global _files_root
    if not _files_root:
        cfg = ServerConfig()
        _files_root = cfg.files_root
        os.makedirs(_files_root, exist_ok=True)
    return _files_root


def _safe_path(requested: str) -> Path:
    """解析并验证路径，防止路径穿越。"""
    root = Path(get_files_root()).resolve()
    target = (root / requested.lstrip("/")).resolve()
    if not str(target).startswith(str(root)):
        raise HTTPException(403, "路径越权访问")
    return target


# ─── List Directory ───────────────────────────────────────


@router.get("")
async def list_directory(
    path: str = Query("", description="相对于根目录的路径"),
    _user: str = Depends(get_current_user),
):
    """列出目录内容。"""
    target = _safe_path(path)
    if not target.exists():
        raise HTTPException(404, f"路径不存在: {path}")
    if not target.is_dir():
        raise HTTPException(400, f"不是目录: {path}")

    items: list[dict[str, Any]] = []
    try:
        for entry in sorted(target.iterdir(), key=lambda e: (not e.is_dir(), e.name.lower())):
            stat = entry.stat()
            items.append({
                "name": entry.name,
                "is_dir": entry.is_dir(),
                "size": stat.st_size if entry.is_file() else None,
                "modified": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
            })
    except PermissionError:
        raise HTTPException(403, "无权限访问该目录")

    return {
        "path": path or "/",
        "root": get_files_root(),
        "items": items,
    }


# ─── Upload ───────────────────────────────────────────────


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    path: str = Query("", description="上传目标目录"),
    auto_extract: bool = Query(False, description="zip 文件自动解压"),
    _user: str = Depends(get_current_user),
):
    """上传文件，支持 zip 自动解压。"""
    target_dir = _safe_path(path)
    os.makedirs(target_dir, exist_ok=True)

    file_path = target_dir / file.filename
    content = await file.read()

    # 如果是 zip 且需要自动解压
    if auto_extract and file.filename and file.filename.endswith(".zip"):
        import tempfile
        with tempfile.NamedTemporaryFile(delete=False, suffix=".zip") as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        try:
            with zipfile.ZipFile(tmp_path, "r") as zf:
                # 安全检查：防止 zip 中的路径穿越
                for name in zf.namelist():
                    member_path = (target_dir / name).resolve()
                    if not str(member_path).startswith(str(target_dir.resolve())):
                        raise HTTPException(400, f"zip 包含非法路径: {name}")
                zf.extractall(target_dir)
        finally:
            os.unlink(tmp_path)

        return {"status": "ok", "message": f"已解压到 {path or '/'}", "extracted": True}
    else:
        with open(file_path, "wb") as f:
            f.write(content)
        return {
            "status": "ok",
            "name": file.filename,
            "size": len(content),
            "extracted": False,
        }


# ─── Download ─────────────────────────────────────────────


@router.get("/download")
async def download_file(
    path: str = Query(..., description="文件路径"),
    _user: str = Depends(get_current_user),
):
    """下载文件。"""
    target = _safe_path(path)
    if not target.exists() or not target.is_file():
        raise HTTPException(404, "文件不存在")
    return FileResponse(target, filename=target.name)


# ─── Read File Content ────────────────────────────────────


@router.get("/read")
async def read_file(
    path: str = Query(..., description="文件路径"),
    _user: str = Depends(get_current_user),
):
    """读取文件内容（用于编辑器）。"""
    target = _safe_path(path)
    if not target.exists() or not target.is_file():
        raise HTTPException(404, "文件不存在")

    # 限制文件大小防止内存溢出
    stat = target.stat()
    if stat.st_size > 5 * 1024 * 1024:  # 5MB
        raise HTTPException(400, "文件过大（> 5MB），不支持在线编辑")

    try:
        content = target.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        raise HTTPException(400, "非文本文件，无法编辑")

    return {
        "path": path,
        "name": target.name,
        "content": content,
        "size": stat.st_size,
    }


# ─── Write File Content ──────────────────────────────────


class WriteFileRequest(BaseModel):
    path: str
    content: str


@router.put("/write")
async def write_file(
    req: WriteFileRequest,
    _user: str = Depends(get_current_user),
):
    """保存文件内容（编辑器保存）。"""
    target = _safe_path(req.path)
    if not target.parent.exists():
        raise HTTPException(404, "父目录不存在")

    target.write_text(req.content, encoding="utf-8")
    return {"status": "ok", "path": req.path, "size": len(req.content.encode("utf-8"))}


# ─── Create Directory ─────────────────────────────────────


class MkdirRequest(BaseModel):
    path: str


@router.post("/mkdir")
async def create_directory(
    req: MkdirRequest,
    _user: str = Depends(get_current_user),
):
    """创建目录。"""
    target = _safe_path(req.path)
    if target.exists():
        raise HTTPException(409, "路径已存在")
    os.makedirs(target, exist_ok=True)
    return {"status": "ok", "path": req.path}


# ─── Delete ───────────────────────────────────────────────


@router.delete("")
async def delete_path(
    path: str = Query(..., description="文件或目录路径"),
    _user: str = Depends(get_current_user),
):
    """删除文件或目录。"""
    if not path or path == "/":
        raise HTTPException(400, "不能删除根目录")

    target = _safe_path(path)
    if not target.exists():
        raise HTTPException(404, "路径不存在")

    if target.is_dir():
        shutil.rmtree(target)
    else:
        target.unlink()

    return {"status": "ok", "deleted": path}
