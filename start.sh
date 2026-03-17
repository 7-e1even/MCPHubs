#!/bin/bash
set -e

# Start backend (Python)
python main.py serve &
BACKEND_PID=$!

# Wait for backend to be actually ready (not just started)
echo "⏳ Waiting for backend..."
for i in $(seq 1 60); do
  if curl -sf http://127.0.0.1:8000/api/health > /dev/null 2>&1; then
    echo "✓ Backend ready"
    break
  fi
  sleep 1
done

# Start frontend (Node.js standalone)
cd /app/web-standalone
HOSTNAME=0.0.0.0 PORT=3000 NEXT_PUBLIC_API_URL=http://127.0.0.1:8000 node server.js &
FRONTEND_PID=$!

echo "✓ MCPHubs started - Backend :8000 | Frontend :3000"

# Wait for either process to exit
wait -n $BACKEND_PID $FRONTEND_PID
exit $?
