# ============================================================
# MCPHubs - Unified Dockerfile (Frontend + Backend)
# ============================================================

# ── Stage 1: Build Frontend (Debian-based, glibc 兼容 Ubuntu) ─
FROM node:22-slim AS frontend-builder

WORKDIR /app/web

COPY web/package.json web/package-lock.json ./
RUN npm ci

COPY web/ .

ENV NEXT_PUBLIC_API_URL=http://127.0.0.1:8000

RUN npm run build

# ── Stage 2: Final Image ─────────────────────────────────────
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# 安装系统依赖（直接从源安装 nodejs 18.x 即可满足 Next.js standalone 需求，免去 NodeSource 和跨镜像复制的二进制兼容问题）
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      python3 python3-pip python3-venv \
      gcc libpq-dev curl git unzip nodejs \
      ca-certificates bash vim nano net-tools iputils-ping && \
    ln -sf /usr/bin/python3 /usr/bin/python && \
    apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/*

# File Manager 工作目录
RUN mkdir -p /app/installed

# Python 依赖（--break-system-packages 适配 Ubuntu 24.04 PEP 668）
COPY requirements.txt .
RUN pip install --no-cache-dir --break-system-packages \
    --retries 3 --timeout 60 \
    -r requirements.txt

# 后端源码（web/ 已在 .dockerignore 中排除）
COPY . .

# 前端构建产物（只复制 standalone 输出，不带 node_modules）
COPY --from=frontend-builder /app/web/.next/standalone/  /app/web-standalone/
COPY --from=frontend-builder /app/web/.next/static       /app/web-standalone/.next/static
COPY --from=frontend-builder /app/web/public              /app/web-standalone/public

RUN chmod +x /app/start.sh

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -sf http://127.0.0.1:8000/api/health || exit 1

EXPOSE 8000 3000

CMD ["/app/start.sh"]
