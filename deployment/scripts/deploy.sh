#!/usr/bin/env bash
# LogPulse — build and (re)start the stack.
#
# Usage:
#   ./deploy.sh                 # build + start core services (postgres, mongo, backend, frontend)
#   ./deploy.sh --edge          # also start the edge nginx reverse proxy
#   ./deploy.sh --logs          # follow logs after starting
set -euo pipefail

cd "$(dirname "$0")/.."   # -> deployment/

if [ ! -f .env ]; then
  echo "No .env found. Copying .env.example -> .env — edit it before re-running." >&2
  cp .env.example .env
  exit 1
fi

PROFILE_ARGS=()
FOLLOW_LOGS=0
for arg in "$@"; do
  case "$arg" in
    --edge) PROFILE_ARGS=(--profile edge) ;;
    --logs) FOLLOW_LOGS=1 ;;
    *) echo "Unknown flag: $arg" >&2; exit 1 ;;
  esac
done

docker compose "${PROFILE_ARGS[@]}" config >/dev/null   # validate before touching anything
docker compose "${PROFILE_ARGS[@]}" up -d --build

echo
docker compose ps
echo
echo "Backend health: http://localhost:${BACKEND_HOST_PORT:-8080}/health"
echo "Frontend:       http://localhost:${FRONTEND_HOST_PORT:-5173}"

if [ "$FOLLOW_LOGS" = "1" ]; then
  docker compose logs -f
fi
