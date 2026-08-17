#!/usr/bin/env bash
# Stops any locally running api/ (NestJS, default port 3000) or app/ (Expo, default
# port 8081) dev server started from this repo.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KILLED=0

for PORT in 3000 8081; do
  PIDS=$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null || true)
  for PID in $PIDS; do
    CMD=$(ps -o command= -p "$PID" 2>/dev/null || true)
    if [[ "$CMD" == *"$REPO_ROOT"* ]]; then
      echo "Stopping PID $PID on port $PORT: $CMD"
      kill "$PID"
      KILLED=1
    fi
  done
done

# Catches processes on non-default ports (e.g. PORT=4000 npm start) still under this repo.
PIDS=$(pgrep -f "$REPO_ROOT/(api|app)/node_modules/.bin/(nest|expo)" 2>/dev/null || true)
PIDS="$PIDS $(pgrep -f "$REPO_ROOT/api/dist/main.js" 2>/dev/null || true)"
for PID in $PIDS; do
  echo "Stopping PID $PID"
  kill "$PID" 2>/dev/null || true
  KILLED=1
done

if [[ "$KILLED" -eq 0 ]]; then
  echo "No running api/ or app/ dev servers found for this repo."
fi
