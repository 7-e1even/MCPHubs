# ============================================================
# MCPHubs - Unified Dockerfile (Frontend + Backend)
# ============================================================

# ── Stage 1: Build Frontend ──────────────────────────────────
FROM registry.cn-hangzhou.aliyuncs.com/library/node:20-alpine AS frontend-builder

WORKDIR /app/web

COPY web/package.json web/package-lock.json ./
RUN npm config set registry https://registry.npmmirror.com && npm ci

COPY web/ .

ENV NEXT_PUBLIC_API_URL=http://127.0.0.1:8000

RUN npm run build

# ── Stage 2: Final Image ─────────────────────────────────────
FROM registry.cn-hangzhou.aliyuncs.com/library/ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# 换源 + 安装系统依赖（合并为单层减小镜像）
RUN sed -i 's|http://archive.ubuntu.com|http://mirrors.aliyun.com|g' /etc/apt/sources.list && \
    sed -i 's|http://security.ubuntu.com|http://mirrors.aliyun.com|g' /etc/apt/sources.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
      python3 python3-pip python3-venv \
      gcc libpq-dev curl git unzip \
      ca-certificates bash vim nano net-tools iputils-ping && \
    ln -sf /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/*

# File Manager 工作目录
RUN mkdir -p /app/installed

# Python 依赖（独立层，利用缓存）
COPY requirements.txt .
RUN pip install --no-cache-dir \
    -i https://pypi.tuna.tsinghua.edu.cn/simple \
    -r requirements.txt

# 后端源码
COPY . .

# 前端构建产物
COPY --from=frontend-builder /app/web/.next/standalone/  /app/web-standalone/
COPY --from=frontend-builder /app/web/.next/static       /app/web-standalone/.next/static
COPY --from=frontend-builder /app/web/public              /app/web-standalone/public

RUN chmod +x /app/start.sh

EXPOSE 8000 3000

CMD ["/app/start.sh"]
