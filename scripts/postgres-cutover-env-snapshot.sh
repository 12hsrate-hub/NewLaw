#!/usr/bin/env bash

set -Eeuo pipefail

PATH=/usr/local/bin:/usr/bin:/bin
umask 077

APP_ROOT="${APP_ROOT:-/srv/newlaw/app}"
ENV_FILE="${ENV_FILE:-$APP_ROOT/shared/.env.production}"
SNAPSHOT_ROOT="${SNAPSHOT_ROOT:-$APP_ROOT/shared/db-cutover-snapshots}"
TIMESTAMP="${TIMESTAMP:-$(date -u +%Y%m%dT%H%M%SZ)}"
SNAPSHOT_DIR="$SNAPSHOT_ROOT/$TIMESTAMP"

log() {
  printf '[pg-cutover-env-snapshot] %s\n' "$*"
}

fail() {
  printf '[pg-cutover-env-snapshot] ERROR: %s\n' "$*" >&2
  exit 1
}

redact_url() {
  local value="$1"
  printf '%s' "$value" | sed -E 's#(://[^:]+:)[^@]+@#\1***@#'
}

extract_env_value() {
  local key="$1"
  local value

  value="$(grep -E "^${key}=" "$ENV_FILE" | head -n 1 | cut -d= -f2- || true)"

  if [[ -z "$value" ]]; then
    printf ''
    return 0
  fi

  value="${value%\"}"
  value="${value#\"}"
  printf '%s' "$value"
}

main() {
  if [[ ! -f "$ENV_FILE" ]]; then
    fail "Missing env file: $ENV_FILE"
  fi

  mkdir -p "$SNAPSHOT_DIR"

  cp "$ENV_FILE" "$SNAPSHOT_DIR/.env.production.rollback"
  chmod 600 "$SNAPSHOT_DIR/.env.production.rollback"

  local database_url
  local direct_url
  local supabase_url
  database_url="$(extract_env_value 'DATABASE_URL')"
  direct_url="$(extract_env_value 'DIRECT_URL')"
  supabase_url="$(extract_env_value 'NEXT_PUBLIC_SUPABASE_URL')"

  {
    printf 'timestamp=%s\n' "$TIMESTAMP"
    printf 'env_file=%s\n' "$ENV_FILE"
    printf 'DATABASE_URL=%s\n' "$(redact_url "$database_url")"
    printf 'DIRECT_URL=%s\n' "$(redact_url "$direct_url")"
    printf 'NEXT_PUBLIC_SUPABASE_URL=%s\n' "$supabase_url"
    printf 'NEXT_PUBLIC_SUPABASE_ANON_KEY=%s\n' "__SET__"
    printf 'SUPABASE_SERVICE_ROLE_KEY=%s\n' "__SET__"
  } > "$SNAPSHOT_DIR/summary.txt"

  log "env snapshot created at $SNAPSHOT_DIR"
  log "rollback env copy: $SNAPSHOT_DIR/.env.production.rollback"
  log "redacted summary: $SNAPSHOT_DIR/summary.txt"
}

main "$@"
