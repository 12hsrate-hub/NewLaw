# Окружения и deployment

## Целевая схема окружений

Проект ведется с тремя окружениями:

- `local`
- `staging`
- `production`

## Поток разработки

Зафиксированный MVP-поток:

1. Локальная разработка и локальная проверка.
2. Push в GitHub.
3. Ручной production release на VPS.

Автоматический CI уже используется как baseline-проверка, но сам production rollout пока остаётся ручным операционным процессом.

## Каноническая production model для MVP

Текущая и каноническая для MVP runtime-схема:

- `Nginx` как reverse proxy
- `systemd` service для приложения
- immutable release directories
- `current` symlink на активный release
- shared production env вне release-каталогов

Эта модель уже соответствует фактическому production state и считается enough-for-MVP.

Важно:

- `Docker Compose` остаётся future target для later operational maturity
- migration на `Docker Compose` не является текущим blocker для formal done по deploy/release hardening

## Canonical server paths

Для production canonical paths должны быть такими:

- source checkout: `/srv/newlaw/app/repo`
- release directories: `/srv/newlaw/app/releases/<sha>`
- active symlink: `/srv/newlaw/app/current`
- shared production env: `/srv/newlaw/app/shared/.env.production`

Дополнительно:

- `systemd WorkingDirectory` должен быть `/srv/newlaw/app/current`
- `systemd EnvironmentFile` должен быть `/srv/newlaw/app/shared/.env.production`

Operational note:

- любые path-artefacts вроде source checkout в каталоге с именем `\/` не считаются нормой
- такие пути нужно трактовать как historical operational debt, а не как допустимый canonical deployment pattern
- новые releases должны собираться только в normal canonical paths без encoded slash/backslash artefacts

## Разделение окружений

### local

Назначение:

- разработка
- локальные проверки
- ручное тестирование фич до коммита

Требования:

- отдельные локальные `env`
- отдельный `Supabase`-проект или согласованный local режим

### staging

Назначение:

- проверка интеграции перед production
- тестирование миграций, auth и сборки в приближенной среде

Требования:

- отдельный процесс или отдельный сервис
- отдельные `env`
- отдельный домен или поддомен
- отдельный `Supabase` project или отдельная staging БД

### production

Назначение:

- реальная эксплуатация приложения

Требования:

- отдельная production БД
- production ключи и production env
- production домен
- безопасное хранение секретов на сервере

## Env / runtime hygiene

### Required env

Эти переменные считаются blocking для release/runtime:

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

Правило:

- missing required env = whole-app release blocker
- placeholder/non-live значения в required env тоже считаются blocker для production release

### Optional feature env

Эти переменные считаются feature-scoped и не должны блокировать whole-app release:

- `FORUM_SESSION_ENCRYPTION_KEY`
- `OGP_FORUM_THREAD_FORM_URL`
- `AI_PROXY_ACTIVE_KEY`

Правило:

- missing optional env = соответствующая feature считается disabled или operationally unavailable
- отсутствие optional env не должно автоматически валить весь production release

### Prisma-specific правило

- `DIRECT_URL` должен быть задан явно
- скрытый fallback `DIRECT_URL=DATABASE_URL` нельзя считать нормальной production-схемой
- `pnpm prisma:generate` должен выполняться перед `build`

## Release sequence

Канонический release order для MVP:

1. Локальный baseline:
   - `pnpm prisma validate`
   - `pnpm prisma generate`
   - `pnpm test:ci`
   - `pnpm lint`
   - `pnpm typecheck`
   - `pnpm build`
2. Обновить source checkout до target SHA.
3. Создать fresh release dir.
4. Явно загрузить production env.
5. Явно задать predictable `PATH`.
6. Выполнить:
   - `pnpm install --frozen-lockfile`
   - `pnpm prisma:generate`
   - `pnpm exec prisma migrate deploy`
   - `pnpm build`
7. Только после этого переключить `current`.
8. Перезапустить `systemd` service.
9. Проверить `/api/health`.
10. Выполнить mandatory smoke.

Ключевое правило:

- symlink switch допустим только после успешных `install + generate + migrate + build`
- если release ломается уже после switch, rollback обязателен

Детальный порядок и checklist находятся в [docs/ops/release-runbook.md](../ops/release-runbook.md).

Канонический server-side entry point для этого порядка:

- `scripts/deploy-release.sh <target-sha-or-ref>`

## Health и наблюдаемость

Для baseline production эксплуатации уже должны существовать:

- `/api/health`
- runtime logs
- `audit_logs`
- `ai_requests`
- ручной smoke-check после deploy

Это не означает наличие полноценной observability platform, dashboard или log explorer.

## Что не входит в current deploy/release hardening scope

В текущий MVP hardening block не входят:

- `Docker Compose` migration
- release dashboard
- full observability platform
- log explorer UI
- global `/app` cleanup

## Связанные документы

- [testing-and-debug.md](./testing-and-debug.md)
- [../ops/release-runbook.md](../ops/release-runbook.md)
- [../prod-access.md](../prod-access.md)
