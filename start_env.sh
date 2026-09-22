#!/usr/bin/env bash
set -e

# Resolve script directory to project root
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

# Support direct shutdown command: ./start_env.sh stop
if [ "$1" = "stop" ]; then
  echo "Stopping AELA services on ports 8000 and 3000..."
  pkill -f "tests/jmeter_plans/mock_server.py" 2>/dev/null || true
  pkill -f "vite" 2>/dev/null || true
  echo "All services stopped cleanly."
  exit 0
fi

echo "========================================================"
echo " Starting AELA Cloud Security Environment (Full-Stack)"
echo "========================================================"

# Cleanup handler on EXIT / SIGINT / SIGTERM
cleanup() {
  echo ""
  echo "Shutting down AELA services..."
  if [ -n "$BACKEND_PID" ]; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
  if [ -n "$FRONTEND_PID" ]; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
  # Fallback check for ports 8000 and 3000
  pkill -f "tests/jmeter_plans/mock_server.py" 2>/dev/null || true
  pkill -f "vite" 2>/dev/null || true
  echo "All services stopped cleanly."
  exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# 1. Start Python Mock Backend on port 8000
echo "[1/2] Starting Python Mock Backend on port 8000..."
if command -v python3 &>/dev/null; then
  python3 tests/jmeter_plans/mock_server.py &
else
  python tests/jmeter_plans/mock_server.py &
fi
BACKEND_PID=$!

# Wait briefly for backend
sleep 2

# 2. Start Vite Frontend on port 3000
echo "[2/2] Starting Vite Frontend on port 3000..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd "$DIR"

echo ""
echo "========================================================"
echo " AELA Full-Stack Environment is Running!"
echo " - Backend API:  http://127.0.0.1:8000"
echo " - Frontend App: http://localhost:3000"
echo "========================================================"
echo "Press Ctrl+C to shut down all services."

# Wait for background processes
wait
