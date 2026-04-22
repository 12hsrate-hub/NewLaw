#!/usr/bin/env bash

set -Eeuo pipefail

PATH=/usr/local/bin:/usr/bin:/bin

APP_ROOT="${APP_ROOT:-/srv/newlaw/app}"
REPO_DIR="${REPO_DIR:-$APP_ROOT/repo}"
RELEASES_DIR="${RELEASES_DIR:-$APP_ROOT/releases}"
CURRENT_LINK="${CURRENT_LINK:-$APP_ROOT/current}"
ENV_FILE="${ENV_FILE:-$APP_ROOT/shared/.env.production}"
SERVICE_NAME="${SERVICE_NAME:-newlaw-app}"
PNPM_BIN="${PNPM_BIN:-/usr/local/bin/pnpm}"
PREFLIGHT_SCRIPT_RELATIVE_PATH="scripts/deploy-env-preflight.mts"
SMOKE_SCRIPT_RELATIVE_PATH="scripts/deploy-smoke.mts"
ROLLBACK_SCRIPT_RELATIVE_PATH="scripts/deploy-rollback.sh"

TARGET_REF="${1:-}"

if [[ -z "$TARGET_REF" ]]; then
  printf 'Usage: %s <target-sha-or-ref>\n' "${0##*/}" >&2
  exit 1
fi

PREVIOUS_RELEASE=""
RELEASE_DIR=""
RESOLVED_SHA=""
SHORT_SHA=""
KNOWN_SERVER_SLUG=""
ROLLED_BACK=0

log() {
  printf '[deploy] %s\n' "$*"
}

fail() {
  printf '[deploy] ERROR: %s\n' "$*" >&2
  exit 1
}

require_command() {
  local command_name="$1"

  if ! command -v "$command_name" >/dev/null 2>&1; then
    fail "Missing required command: $command_name"
  fi
}

cleanup_release_dir() {
  if [[ -n "$RELEASE_DIR" && -d "$RELEASE_DIR" && "${ROLLED_BACK:-0}" -eq 0 ]]; then
    find "$RELEASE_DIR" -maxdepth 1 -type f -name '.deploy-*.mts' -delete >/dev/null 2>&1 || true
  fi
}

on_error() {
  local exit_code="$1"
  local line_no="$2"

  cleanup_release_dir
  printf '[deploy] ERROR: command failed on line %s (exit %s)\n' "$line_no" "$exit_code" >&2
  exit "$exit_code"
}

trap 'on_error $? $LINENO' ERR

source_env() {
  if [[ ! -f "$ENV_FILE" ]]; then
    fail "Missing production env file: $ENV_FILE"
  fi

  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a

  log "env loaded from $ENV_FILE"
}

assert_required_inputs() {
  require_command git
  require_command curl
  require_command ln
  require_command readlink
  require_command systemctl

  if [[ ! -x "$PNPM_BIN" ]]; then
    fail "Expected pnpm binary at $PNPM_BIN"
  fi

  if [[ ! -d "$REPO_DIR/.git" ]]; then
    fail "Canonical repo checkout is missing or not a git repo: $REPO_DIR"
  fi

  if [[ "$REPO_DIR" == *'\/'* ]]; then
    fail "Canonical repo path must not contain path artefacts like '\\/': $REPO_DIR"
  fi

  mkdir -p "$RELEASES_DIR"
}

prepare_repo_checkout() {
  log "fetching target ref from $REPO_DIR"
  git -C "$REPO_DIR" fetch --prune origin

  RESOLVED_SHA="$(git -C "$REPO_DIR" rev-parse --verify "${TARGET_REF}^{commit}")"
  SHORT_SHA="${RESOLVED_SHA:0:7}"
  RELEASE_DIR="$RELEASES_DIR/$SHORT_SHA"

  log "target SHA: $RESOLVED_SHA"
  log "release dir: $RELEASE_DIR"

  if [[ -e "$RELEASE_DIR" ]]; then
    fail "Release directory already exists: $RELEASE_DIR"
  fi

  git -C "$REPO_DIR" checkout --detach "$RESOLVED_SHA" >/dev/null 2>&1
}

create_release_dir() {
  mkdir -p "$RELEASE_DIR"

  log "copying source archive from canonical repo checkout"
  git -C "$REPO_DIR" archive --format=tar "$RESOLVED_SHA" | tar -xf - -C "$RELEASE_DIR"

  ln -sfn "$ENV_FILE" "$RELEASE_DIR/.env.production"
}

run_release_build() {
  cd "$RELEASE_DIR"

  log "PATH normalized to $PATH"

  log "install started"
  "$PNPM_BIN" install --frozen-lockfile
  log "install finished"

  log "env preflight started"
  "$PNPM_BIN" exec tsx "./$PREFLIGHT_SCRIPT_RELATIVE_PATH" --env-file "$ENV_FILE"
  log "env preflight finished"

  log "prisma generate started"
  "$PNPM_BIN" prisma:generate
  log "prisma generate finished"

  log "prisma migrate deploy started"
  "$PNPM_BIN" exec prisma migrate deploy
  log "prisma migrate deploy finished"

  log "build started"
  "$PNPM_BIN" build
  log "build finished"
}

wait_for_health() {
  local health_url="$1"
  local attempt
  local max_attempts=15

  for attempt in $(seq 1 "$max_attempts"); do
    if curl -fsS "$health_url" >/dev/null 2>&1; then
      log "/api/health is ready"
      return 0
    fi

    sleep 2
  done

  return 1
}

rollback_release() {
  if [[ -z "$PREVIOUS_RELEASE" ]]; then
    fail "Rollback required but previous release path is unknown"
  fi

  log "rollback started"
  log "previous release: $PREVIOUS_RELEASE"

  if "$RELEASE_DIR/$ROLLBACK_SCRIPT_RELATIVE_PATH" "$PREVIOUS_RELEASE"; then
    log "rollback finished successfully"
  else
    fail "Rollback helper failed"
  fi

  ROLLED_BACK=1
}

activate_and_verify_release() {
  PREVIOUS_RELEASE="$(readlink -f "$CURRENT_LINK" 2>/dev/null || true)"

  if [[ -z "$PREVIOUS_RELEASE" ]]; then
    fail "Unable to resolve previous release before symlink switch"
  fi

  log "previous release: $PREVIOUS_RELEASE"
  log "switching current symlink"
  ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"
  log "switched current to $RELEASE_DIR"

  log "restarting $SERVICE_NAME"
  if ! systemctl restart "$SERVICE_NAME"; then
    rollback_release
    fail "Service restart failed after symlink switch"
  fi

  if ! systemctl is-active --quiet "$SERVICE_NAME"; then
    rollback_release
    fail "Service is not active after restart"
  fi

  log "service restarted"

  if ! wait_for_health "${APP_URL%/}/api/health"; then
    rollback_release
    fail "/api/health did not return 200 after release activation"
  fi

  log "mandatory smoke helper started"
  if ! "$PNPM_BIN" exec tsx "./$SMOKE_SCRIPT_RELATIVE_PATH" --env-file "$ENV_FILE"; then
    rollback_release
    fail "Mandatory smoke failed after release activation"
  fi
  log "mandatory smoke helper finished"
}

main() {
  assert_required_inputs
  source_env
  prepare_repo_checkout
  create_release_dir
  run_release_build
  activate_and_verify_release
  cleanup_release_dir
  log "deploy sequence completed successfully"
}

main
