# Release Runbook

## Назначение

Этот документ — основной source of truth для production release процедуры MVP.

Он фиксирует:

- canonical paths
- release sequence
- env prerequisites
- mandatory smoke
- failure classification
- rollback checklist

`docs/prod-access.md` остаётся только access/bootstrap note и не должен считаться основным release-процедурным документом.

Каноническая server-side реализация этого порядка находится в:

- `scripts/deploy-release.sh <target-sha-or-ref>`
- `scripts/deploy-env-preflight.mts --env-file /srv/newlaw/app/shared/.env.production`
- `scripts/deploy-smoke.mts --env-file /srv/newlaw/app/shared/.env.production`
- `scripts/deploy-rollback.sh <previous-release-path>`

## Canonical runtime model

Для MVP production runtime считается таким:

- source checkout: `/srv/newlaw/app/repo`
- immutable releases: `/srv/newlaw/app/releases/<sha>`
- active symlink: `/srv/newlaw/app/current`
- shared env: `/srv/newlaw/app/shared/.env.production`
- service manager: `systemd`

`systemd` contract:

- `WorkingDirectory=/srv/newlaw/app/current`
- `EnvironmentFile=/srv/newlaw/app/shared/.env.production`

Важно:

- source checkout path с artefact-именем вроде `\/` не считается нормой
- release directories должны собираться только в normal canonical path

## Required vs optional env

### Required env

Blocking для release/runtime:

- `APP_ENV`
- `APP_URL`
- `DATABASE_URL`
- `DIRECT_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AI_PROXY_CONFIGS_JSON`
- `AI_PROXY_INTERNAL_TOKEN`
- `OPENAI_API_KEY`

Interpretation:

- missing required env = release stop
- non-live placeholder required env = release stop

### Optional env

Feature-scoped, но не whole-app blockers:

- `FORUM_SESSION_ENCRYPTION_KEY`
- `OGP_FORUM_THREAD_FORM_URL`
- `AI_PROXY_ACTIVE_KEY`

Interpretation:

- missing optional env = feature disabled / unavailable
- optional env не должен блокировать whole-app deploy

Operational helper policy:

- `deploy-env-preflight.mts` классифицирует env как:
  - `blocking_missing`
  - `optional_missing`
  - `placeholder_non_live`
  - `valid`
- missing required env = blocking release failure
- missing optional env = feature disabled / unavailable, но не release blocker

## Canonical release sequence

### 1. Local baseline before push

Обязательный baseline:

- `pnpm prisma validate`
- `pnpm prisma generate`
- `pnpm test:ci`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`

### 2. Prepare target SHA

- target SHA уже должен быть в `main`
- production source checkout в `/srv/newlaw/app/repo` должен быть обновлён именно до этого SHA
- канонический deterministic entry point для этого шага: `scripts/deploy-release.sh <target-sha-or-ref>`

### 3. Create fresh release

- создать `/srv/newlaw/app/releases/<sha>`
- release должен собираться с чистого source tree
- нельзя reuse старый release directory под новый SHA

### 4. Explicit runtime normalization

Перед build/release шагами нужно явно задать:

- predictable `PATH`
- explicit env load from `/srv/newlaw/app/shared/.env.production`

Release не должен зависеть от:

- login shell magic
- случайного `PATH`
- ad-hoc aliases
- PowerShell/Bash quoting luck

### 5. Build sequence inside release dir

Canonical order:

1. `pnpm install --frozen-lockfile`
2. `pnpm prisma:generate`
3. `pnpm exec prisma migrate deploy`
4. `pnpm build`

Важно:

- `pnpm prisma:generate` идёт до `build`
- `migrate deploy` идёт до `build`
- при падении любого из этих шагов symlink switch не выполняется

### 6. Activate release

Только после успешных шагов выше:

1. сохранить `previous release path`
2. переключить `/srv/newlaw/app/current`
3. выполнить `systemctl restart newlaw-app`

### 7. Verify release

После restart:

1. `systemctl is-active newlaw-app`
2. `/api/health`
3. mandatory smoke-check

Только после этого release считается successful.

## Mandatory post-deploy smoke

После каждого release обязательно:

### HTTP / route smoke

- `/api/health`
- `/sign-in`
- `/forgot-password`
- `/assistant`
- `/servers`

### Auth redirect smoke

- `/account`
- `/servers/<known-server-slug>`
- `/internal`

### DB-backed smoke

Минимум:

- `1` read-only DB-backed check
- `1` app-context DB-backed check

Примеры допустимых DB-backed smoke:

- безопасный read реального server summary
- безопасный read internal health context
- безопасный read directory/hub summary

Эти проверки теперь вынесены в reusable helper:

- `scripts/deploy-smoke.mts --env-file /srv/newlaw/app/shared/.env.production`

Не обязательно каждый раз:

- глубокий authenticated browser smoke
- full document flow smoke
- full assistant answer smoke

## Failure classification

### Code regression

Считать code regression, если:

- release reproducibly ломается на code path
- baseline локально был зелёный, но fresh release на тех же env воспроизводимо падает
- route/action/render broken не из-за env или внешнего провайдера

### External runtime/env blocker

Считать external runtime/env blocker, если:

- missing required env
- invalid env
- external provider unavailable
- broken credential / token / endpoint

### Flaky operational issue

Считать flaky operational issue, если:

- transient SSH/network issue
- startup race
- one-off file lock
- shell quoting/path artifact

Правило:

- для flaky issue допустим один bounded retry
- для env blocker нужен fix env/config before redeploy
- для code regression release считается failed

## Rollback checklist

Минимальный rollback:

1. знать `previous release path`
2. repoint `/srv/newlaw/app/current` на previous release
3. `systemctl restart newlaw-app`
4. проверить:
   - `systemctl is-active newlaw-app`
   - `/api/health`
   - короткий smoke-check

Для ручного bounded rollback используется helper:

- `scripts/deploy-rollback.sh <previous-release-path>`

Release считается unsuccessful, если:

- build pipeline release dir не завершён
- service после switch не поднялся
- `/api/health` не дал `200`
- mandatory smoke не прошёл

Нельзя оставлять:

- broken `current` symlink
- failed service без rollback
- partially switched release без явной operational note

## Что не входит в этот runbook

Этот runbook не покрывает:

- release dashboard
- full observability platform
- log explorer
- automated rollback platform
- Docker Compose migration

Это future operational maturity, а не current MVP blocker.
