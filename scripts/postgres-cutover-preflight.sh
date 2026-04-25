#!/usr/bin/env bash

set -Eeuo pipefail

PATH=/usr/local/bin:/usr/bin:/bin

APP_ROOT="${APP_ROOT:-/srv/newlaw/app}"
ENV_FILE="${ENV_FILE:-$APP_ROOT/shared/.env.production}"
BACKUP_ROOT="${BACKUP_ROOT:-$APP_ROOT/backups/postgres-cutover}"
MIN_FREE_DISK_GB="${MIN_FREE_DISK_GB:-5}"
MIN_AVAILABLE_RAM_MB="${MIN_AVAILABLE_RAM_MB:-1024}"

log() {
  printf '[pg-cutover-preflight] %s\n' "$*"
}

fail() {
  printf '[pg-cutover-preflight] ERROR: %s\n' "$*" >&2
  exit 1
}

require_command() {
  local command_name="$1"

  if ! command -v "$command_name" >/dev/null 2>&1; then
    fail "Missing required command: $command_name"
  fi
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

extract_host_from_url() {
  local url="$1"

  printf '%s' "$url" | sed -E 's|^[a-z]+://([^:@/]+(:[^@/]+)?@)?([^:/?]+).*|\3|'
}

main() {
  require_command df
  require_command free
  require_command awk
  require_command grep
  require_command cut
  require_command sed
  require_command pg_dump
  require_command psql

  if [[ ! -f "$ENV_FILE" ]]; then
    fail "Missing env file: $ENV_FILE"
  fi

  mkdir -p "$BACKUP_ROOT"

  local available_disk_kb
  available_disk_kb="$(df -Pk "$APP_ROOT" | awk 'NR==2 { print $4 }')"
  local available_disk_gb
  available_disk_gb="$(( available_disk_kb / 1024 / 1024 ))"

  local available_ram_mb
  available_ram_mb="$(free -m | awk '/^Mem:/ { print $7 }')"

  local database_url
  local direct_url
  local database_host
  local direct_host
  database_url="$(extract_env_value 'DATABASE_URL')"
  direct_url="$(extract_env_value 'DIRECT_URL')"

  if [[ -z "$database_url" ]]; then
    fail "DATABASE_URL is missing in $ENV_FILE"
  fi

  if [[ -z "$direct_url" ]]; then
    fail "DIRECT_URL is missing in $ENV_FILE"
  fi

  database_host="$(extract_host_from_url "$database_url")"
  direct_host="$(extract_host_from_url "$direct_url")"

  log "APP_ROOT=$APP_ROOT"
  log "ENV_FILE=$ENV_FILE"
  log "BACKUP_ROOT=$BACKUP_ROOT"
  log "available_disk_gb=$available_disk_gb"
  log "available_ram_mb=$available_ram_mb"
  log "DATABASE_URL host=$database_host"
  log "DIRECT_URL host=$direct_host"

  if (( available_disk_gb < MIN_FREE_DISK_GB )); then
    fail "Free disk headroom is below threshold (${available_disk_gb}GB < ${MIN_FREE_DISK_GB}GB)"
  fi

  if (( available_ram_mb < MIN_AVAILABLE_RAM_MB )); then
    fail "Available RAM is below threshold (${available_ram_mb}MB < ${MIN_AVAILABLE_RAM_MB}MB)"
  fi

  if [[ "$database_host" == "$direct_host" ]]; then
    log "WARNING: DATABASE_URL and DIRECT_URL currently resolve to the same host"
  fi

  if [[ "$database_host" == *"pooler.supabase.com" ]]; then
    log "Current runtime DB still uses Supabase pooler host"
  fi

  if systemctl list-unit-files | grep -q '^postgresql\.service'; then
    log "postgresql.service is available on this host"
  else
    log "postgresql.service is not installed yet on this host"
  fi

  log "preflight completed successfully"
}

main "$@"
