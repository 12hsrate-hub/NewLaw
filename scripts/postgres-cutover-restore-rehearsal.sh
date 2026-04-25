#!/usr/bin/env bash

set -Eeuo pipefail

PATH=/usr/local/bin:/usr/bin:/bin

ADMIN_URL=""
TARGET_DB_URL=""
TARGET_DB_NAME=""
DUMP_FILE=""
ALLOW_RESET=0

log() {
  printf '[pg-cutover-restore] %s\n' "$*"
}

fail() {
  printf '[pg-cutover-restore] ERROR: %s\n' "$*" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Usage:
  postgres-cutover-restore-rehearsal.sh \
    --admin-url <postgres-admin-url> \
    --target-db-url <postgres-target-db-url> \
    --target-db-name <database-name> \
    --dump-file <pg_dump.custom> \
    --allow-reset

Safety rules:
  - target DB name must contain rehearsal, restore or verify
  - script resets only the explicitly named target DB
  - script does not touch production env or application runtime
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --admin-url)
      ADMIN_URL="${2:-}"
      shift 2
      ;;
    --target-db-url)
      TARGET_DB_URL="${2:-}"
      shift 2
      ;;
    --target-db-name)
      TARGET_DB_NAME="${2:-}"
      shift 2
      ;;
    --dump-file)
      DUMP_FILE="${2:-}"
      shift 2
      ;;
    --allow-reset)
      ALLOW_RESET=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "Unknown argument: $1"
      ;;
  esac
done

if [[ -z "$ADMIN_URL" || -z "$TARGET_DB_URL" || -z "$TARGET_DB_NAME" || -z "$DUMP_FILE" ]]; then
  usage
  fail "Missing required arguments"
fi

if [[ ! -f "$DUMP_FILE" ]]; then
  fail "Dump file does not exist: $DUMP_FILE"
fi

if [[ "$ALLOW_RESET" -ne 1 ]]; then
  fail "Missing required safety flag: --allow-reset"
fi

if [[ ! "$TARGET_DB_NAME" =~ (rehearsal|restore|verify) ]]; then
  fail "Target DB name must include rehearsal, restore or verify: $TARGET_DB_NAME"
fi

if ! printf '%s' "$TARGET_DB_URL" | grep -q "$TARGET_DB_NAME"; then
  fail "Target DB URL does not appear to reference target DB name: $TARGET_DB_NAME"
fi

command -v psql >/dev/null 2>&1 || fail "Missing required command: psql"
command -v pg_restore >/dev/null 2>&1 || fail "Missing required command: pg_restore"

log "resetting rehearsal DB: $TARGET_DB_NAME"
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$TARGET_DB_NAME' AND pid <> pg_backend_pid();" >/dev/null
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"$TARGET_DB_NAME\";" >/dev/null
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$TARGET_DB_NAME\";" >/dev/null

log "restoring dump into $TARGET_DB_NAME"
pg_restore \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  --dbname "$TARGET_DB_URL" \
  "$DUMP_FILE"

log "running row-count sanity checks"
psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
SELECT 'Account' AS table_name, COUNT(*) AS row_count FROM "Account"
UNION ALL
SELECT 'Server' AS table_name, COUNT(*) AS row_count FROM "Server"
UNION ALL
SELECT 'Character' AS table_name, COUNT(*) AS row_count FROM "Character"
UNION ALL
SELECT 'Trustor' AS table_name, COUNT(*) AS row_count FROM "Trustor"
UNION ALL
SELECT 'Document' AS table_name, COUNT(*) AS row_count FROM "Document"
UNION ALL
SELECT 'AIRequest' AS table_name, COUNT(*) AS row_count FROM "AIRequest";
SQL

log "restore rehearsal completed successfully"
