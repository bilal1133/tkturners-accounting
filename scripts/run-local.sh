#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker/docker-compose.yml"
ENV_FILE="$ROOT_DIR/.env"

POSTGRES_PORT="${POSTGRES_PORT:-5433}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-tkturners_accounting}"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/run-local.sh up        # start postgres, then run api + web in foreground
  ./scripts/run-local.sh down      # stop api/web local processes and postgres container
  ./scripts/run-local.sh status    # show local process/container status

Notes:
  - Default postgres host port is 5433 (matches apps/api/.env).
  - Override with POSTGRES_PORT if needed.
EOF
}

start_postgres() {
  POSTGRES_PORT="$POSTGRES_PORT" docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d postgres >/dev/null
}

wait_for_postgres() {
  local retries=30
  local i
  for i in $(seq 1 "$retries"); do
    if docker exec tkturners-postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "Postgres did not become ready in time." >&2
  return 1
}

stop_local_processes() {
  pkill -f "$ROOT_DIR/apps/api/node_modules/.bin/strapi develop" >/dev/null 2>&1 || true
  pkill -f "$ROOT_DIR/apps/web/node_modules/.bin/next dev" >/dev/null 2>&1 || true
}

show_status() {
  local api_pids
  local web_pids
  local all_pids

  api_pids="$(pgrep -f "$ROOT_DIR/apps/api/node_modules/.bin/strapi develop" || true)"
  web_pids="$(pgrep -f "$ROOT_DIR/apps/web/node_modules/.bin/next dev" || true)"
  all_pids="$(printf '%s\n%s\n' "$api_pids" "$web_pids" | awk 'NF' | tr '\n' ' ')"

  echo "== Local processes =="
  if [[ -n "$all_pids" ]]; then
    ps -o pid=,ppid=,command= -p $all_pids
  else
    echo "No local API/Web dev processes found."
  fi

  echo
  echo "== Docker postgres =="
  POSTGRES_PORT="$POSTGRES_PORT" docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps postgres || true
}

cmd="${1:-up}"

case "$cmd" in
  up)
    echo "Starting local Postgres on host port $POSTGRES_PORT..."
    start_postgres
    wait_for_postgres
    echo "Postgres is ready."
    echo "Starting API + Web..."
    cd "$ROOT_DIR"
    yarn dev
    ;;
  down)
    echo "Stopping API + Web local processes..."
    stop_local_processes
    echo "Stopping local Postgres container..."
    POSTGRES_PORT="$POSTGRES_PORT" docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" stop postgres >/dev/null || true
    echo "Stopped."
    ;;
  status)
    show_status
    ;;
  *)
    usage
    exit 1
    ;;
esac
