#!/bin/bash
set -e

# ─── 自动检测运行环境 ─────────────────────────────────────
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"

# 判断是否在 Docker 中
IN_DOCKER=false
if [ -f /.dockerenv ] || grep -q docker /proc/1/cgroup 2>/dev/null; then
  IN_DOCKER=true
fi

echo "━━━ MCPHubs Startup ━━━"
echo "  Directory: $APP_DIR"
echo "  Docker:    $IN_DOCKER"

# ─── 非 Docker 环境：激活 venv ───────────────────────────
if [ "$IN_DOCKER" = false ]; then
  if [ -d "$APP_DIR/venv" ]; then
    echo "  Activating venv..."
    source "$APP_DIR/venv/bin/activate"
  elif [ -d "$APP_DIR/.venv" ]; then
    echo "  Activating .venv..."
    source "$APP_DIR/.venv/bin/activate"
  else
    echo "  ⚠ No venv found, using system Python"
  fi
fi

# ─── 启动后端 ─────────────────────────────────────────────
echo "⏳ Starting backend..."
python main.py serve &
BACKEND_PID=$!

# 等待后端就绪
echo "⏳ Waiting for backend to be ready..."
for i in $(seq 1 60); do
  if curl -sf http://127.0.0.1:8000/api/health > /dev/null 2>&1; then
    echo "✓ Backend ready (port 8000)"
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "✗ Backend failed to start in 60s"
    kill $BACKEND_PID 2>/dev/null
    exit 1
  fi
  sleep 1
done

# ─── 启动前端 ─────────────────────────────────────────────
echo "⏳ Starting frontend..."
if [ "$IN_DOCKER" = true ]; then
  # Docker: 用 standalone 产物
  cd /app/web-standalone
  HOSTNAME=0.0.0.0 PORT=3000 NEXT_PUBLIC_API_URL=http://127.0.0.1:8000 node server.js &
else
  # 非 Docker: 用 npm run start（需要先 build）
  cd "$APP_DIR/web"
  if [ ! -d ".next" ]; then
    echo "  Building frontend (first time)..."
    npm run build
  fi
  HOSTNAME=0.0.0.0 PORT=3000 npm run start &
fi
FRONTEND_PID=$!

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✓ MCPHubs started successfully!"
echo "  Backend:  http://0.0.0.0:8000"
echo "  Frontend: http://0.0.0.0:3000"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 等待任一进程退出
wait -n $BACKEND_PID $FRONTEND_PID
exit $?
