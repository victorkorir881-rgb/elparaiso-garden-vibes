#!/usr/bin/env bash
# sql/_check.sh — verify every numbered migration applies cleanly to a throwaway
# Postgres, end-to-end. Idempotency is also checked by running the full set twice.
#
# Usage:
#   ./sql/_check.sh                   # spins up postgres:15 in docker on port 55432
#   PGURL=postgresql://... ./sql/_check.sh   # use an existing throwaway DB
#
# Exits non-zero on the first failing migration. Safe for CI.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
USE_DOCKER=0
CONTAINER_NAME="elparaiso-sql-check-$$"

cleanup() {
  if [[ "$USE_DOCKER" == "1" ]]; then
    docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if [[ -z "${PGURL:-}" ]]; then
  command -v docker >/dev/null 2>&1 || { echo "docker required when PGURL is not set" >&2; exit 2; }
  USE_DOCKER=1
  echo "▶ starting throwaway postgres:15 (container=$CONTAINER_NAME, port=55432)"
  docker run --rm -d --name "$CONTAINER_NAME" -e POSTGRES_PASSWORD=test -p 55432:5432 postgres:15 >/dev/null
  PGURL="postgresql://postgres:test@localhost:55432/postgres"
  echo -n "  waiting for postgres "
  for _ in $(seq 1 30); do
    if PGPASSWORD=test psql "$PGURL" -c 'select 1' >/dev/null 2>&1; then
      echo "ready"
      break
    fi
    echo -n "."
    sleep 1
  done
fi

run_pass() {
  local label="$1"
  echo "── pass: $label ──"
  for f in "$SCRIPT_DIR"/[0-9][0-9][0-9][0-9]_*.sql; do
    [[ -f "$f" ]] || continue
    case "$f" in
      *.legacy.bak|*.mysql.bak) continue ;;
    esac
    echo "▶ $(basename "$f")"
    psql "$PGURL" -v ON_ERROR_STOP=1 -q -f "$f" >/dev/null
  done
}

run_pass "first apply"
run_pass "re-apply (idempotency)"

echo "✅ all migrations applied cleanly twice"
