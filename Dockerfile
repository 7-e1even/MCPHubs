# ============================================================
# MCPHubs - Unified Dockerfile (Frontend + Backend)
# ============================================================

# ── Stage 1: Build Frontend ──────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /app/web

COPY web/package.json web/package-lock.json ./
RUN npm ci

COPY web/ .

# In unified mode, frontend proxies to localhost backend
ENV NEXT_PUBLIC_API_URL=http://127.0.0.1:8000

RUN npm run build

# ── Stage 2: Final Image ─────────────────────────────────────
FROM python:3.11-slim

WORKDIR /app

# Install Node.js (for npx stdio servers) and system deps
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libpq-dev curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY . .

# Copy frontend standalone build
COPY --from=frontend-builder /app/web/.next/standalone/  /app/web-standalone/
COPY --from=frontend-builder /app/web/.next/static       /app/web-standalone/.next/static
COPY --from=frontend-builder /app/web/public              /app/web-standalone/public

# Startup script
RUN chmod +x /app/start.sh

EXPOSE 8000 3000

CMD ["/app/start.sh"]
