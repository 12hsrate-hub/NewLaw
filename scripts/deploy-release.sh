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

run_read_only_db_check() {
  local script_path="$RELEASE_DIR/.deploy-read-db.mts"

  cat > "$script_path" <<'EOF'
import * as prismaModule from "./src/db/prisma.ts";

const { prisma } = prismaModule;

const server = await prisma.server.findFirst({
  orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  select: { code: true },
});

if (!server?.code) {
  throw new Error("No server records available for deploy smoke");
}

console.log(server.code);
await prisma.$disconnect();
EOF

  KNOWN_SERVER_SLUG="$("$PNPM_BIN" exec tsx "$script_path")"
  rm -f "$script_path"

  if [[ -z "$KNOWN_SERVER_SLUG" ]]; then
    fail "Failed to resolve known server slug for smoke"
  fi

  log "read-only DB check passed with server slug: $KNOWN_SERVER_SLUG"
}

run_app_context_db_check() {
  local script_path="$RELEASE_DIR/.deploy-app-context.mts"

  cat > "$script_path" <<'EOF'
import * as internalHealthModule from "./src/server/internal/health.ts";

const { getInternalHealthContext } = internalHealthModule;

const context = await getInternalHealthContext();

if (context.runtime.status !== "ok") {
  throw new Error(`Unexpected runtime status: ${context.runtime.status}`);
}

if (context.serverSummaries.length === 0) {
  throw new Error("Internal health context returned zero server summaries");
}

console.log(`servers=${context.serverSummaries.length}`);
EOF

  local output
  output="$("$PNPM_BIN" exec tsx "$script_path")"
  rm -f "$script_path"

  if [[ -z "$output" ]]; then
    printf '[deploy] ERROR: app-context DB check returned empty output\n' >&2
    return 1
  fi

  log "app-context DB check passed: $output"
}

assert_status_code() {
  local url="$1"
  local expected="$2"
  local actual

  actual="$(curl -sS -o /dev/null -w '%{http_code}' "$url")"

  if [[ "$actual" != "$expected" ]]; then
    printf '[deploy] ERROR: unexpected status for %s: expected %s, got %s\n' "$url" "$expected" "$actual" >&2
    return 1
  fi
}

assert_redirect_target() {
  local url="$1"
  local expected_path="$2"
  local headers

  headers="$(curl -sS -I "$url")"

  if ! grep -qi '^HTTP/.* 307' <<<"$headers"; then
    printf '[deploy] ERROR: expected 307 redirect for %s\n' "$url" >&2
    return 1
  fi

  if ! grep -qi "^location: .*${expected_path}" <<<"$headers"; then
    printf '[deploy] ERROR: redirect target for %s does not include %s\n' "$url" "$expected_path" >&2
    return 1
  fi
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

run_http_smoke() {
  local base_url="${APP_URL%/}"

  log "mandatory smoke started against $base_url"

  assert_status_code "$base_url/api/health" "200" || return 1
  assert_status_code "$base_url/sign-in" "200" || return 1
  assert_status_code "$base_url/forgot-password" "200" || return 1
  assert_status_code "$base_url/assistant" "200" || return 1
  assert_status_code "$base_url/servers" "200" || return 1

  assert_redirect_target "$base_url/account" "/sign-in?next=%2Faccount" || return 1
  assert_redirect_target "$base_url/servers/$KNOWN_SERVER_SLUG" "/sign-in?next=%2Fservers%2F$KNOWN_SERVER_SLUG" || return 1
  assert_redirect_target "$base_url/internal" "/sign-in?next=%2Finternal" || return 1

  log "mandatory smoke finished"
}

rollback_release() {
  if [[ -z "$PREVIOUS_RELEASE" ]]; then
    fail "Rollback required but previous release path is unknown"
  fi

  log "rollback started"
  log "previous release: $PREVIOUS_RELEASE"

  ln -sfn "$PREVIOUS_RELEASE" "$CURRENT_LINK"
  systemctl restart "$SERVICE_NAME"

  if wait_for_health "${APP_URL%/}/api/health"; then
    log "rollback finished successfully"
  else
    fail "Rollback restart finished but /api/health did not recover"
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

  if ! run_app_context_db_check; then
    rollback_release
    fail "App-context DB smoke failed after release activation"
  fi

  if ! run_http_smoke; then
    rollback_release
    fail "Mandatory smoke failed after release activation"
  fi
}

main() {
  assert_required_inputs
  source_env
  prepare_repo_checkout
  create_release_dir
  run_release_build
  run_read_only_db_check
  activate_and_verify_release
  cleanup_release_dir
  log "deploy sequence completed successfully"
}

main
