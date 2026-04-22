#!/usr/bin/env bash

set -Eeuo pipefail

PATH=/usr/local/bin:/usr/bin:/bin

APP_ROOT="${APP_ROOT:-/srv/newlaw/app}"
CURRENT_LINK="${CURRENT_LINK:-$APP_ROOT/current}"
ENV_FILE="${ENV_FILE:-$APP_ROOT/shared/.env.production}"
SERVICE_NAME="${SERVICE_NAME:-newlaw-app}"
PREVIOUS_RELEASE="${1:-}"

if [[ -z "$PREVIOUS_RELEASE" ]]; then
  printf 'Usage: %s <previous-release-path>\n' "${0##*/}" >&2
  exit 1
fi

if [[ ! -d "$PREVIOUS_RELEASE" ]]; then
  printf '[rollback] ERROR: previous release directory does not exist: %s\n' "$PREVIOUS_RELEASE" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  printf '[rollback] ERROR: env file is missing: %s\n' "$ENV_FILE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

log() {
  printf '[rollback] %s\n' "$*"
}

wait_for_health() {
  local health_url="${APP_URL%/}/api/health"
  local attempt

  for attempt in $(seq 1 15); do
    if curl -fsS "$health_url" >/dev/null 2>&1; then
      return 0
    fi

    sleep 2
  done

  return 1
}

log "target previous release: $PREVIOUS_RELEASE"
log "repointing current symlink"
ln -sfn "$PREVIOUS_RELEASE" "$CURRENT_LINK"

log "restarting $SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

if ! systemctl is-active --quiet "$SERVICE_NAME"; then
  printf '[rollback] ERROR: service is not active after restart\n' >&2
  exit 1
fi

if ! wait_for_health; then
  printf '[rollback] ERROR: /api/health did not recover after rollback\n' >&2
  exit 1
fi

log "rollback completed successfully"
