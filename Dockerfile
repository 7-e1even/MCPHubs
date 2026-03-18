# ============================================================
# MCPHubs - Unified Dockerfile (Frontend + Backend)
# ============================================================

# ── Stage 1: Build Frontend ──────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /app/web

COPY web/package.json web/package-lock.json ./
RUN npm ci

COPY web/ .

ENV NEXT_PUBLIC_API_URL=http://127.0.0.1:8000

RUN npm run build

# ── Stage 2: Final Image ─────────────────────────────────────
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# 安装系统依赖（合并为单层减小镜像）
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      python3 python3-pip python3-venv \
      gcc libpq-dev curl git unzip \
      ca-certificates bash vim nano net-tools iputils-ping && \
    ln -sf /usr/bin/python3 /usr/bin/python && \
    apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/*

# 从编译阶段复制 Node（彻底避免 NodeSource 超时问题）
COPY --from=frontend-builder /usr/local/bin/node /usr/local/bin/node

# File Manager 工作目录
RUN mkdir -p /app/installed

# Python 依赖（独立层，带重试）
COPY requirements.txt .
RUN pip install --no-cache-dir --retries 3 --timeout 60 \
    -r requirements.txt

# 后端源码
COPY . .

# 前端构建产物
COPY --from=frontend-builder /app/web/.next/standalone/  /app/web-standalone/
COPY --from=frontend-builder /app/web/.next/static       /app/web-standalone/.next/static
COPY --from=frontend-builder /app/web/public              /app/web-standalone/public

RUN chmod +x /app/start.sh

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -sf http://127.0.0.1:8000/api/health || exit 1

EXPOSE 8000 3000

CMD ["/app/start.sh"]
