# VPS Postgres Cutover Runbook

## Назначение

Этот документ фиксирует безопасный operational порядок для перехода runtime DB с `Supabase Postgres` на local Postgres на том же VPS.

Текущий status snapshot:

- migration уже выполнена
- production runtime DB уже работает на local `PostgreSQL 17`
- документ сохраняется как historical runbook и rollback reference

Он не заменяет:

- [release-runbook.md](./release-runbook.md)
- [../architecture/database.md](../architecture/database.md)
- [../plans/15-vps-postgres-cutover-from-supabase-db.md](../plans/15-vps-postgres-cutover-from-supabase-db.md)

`release-runbook.md` остаётся source of truth по release sequence приложения. Этот документ описывает только infra/cutover шаги вокруг DB hosting migration.

## Scope

Этот runbook покрывает:

- preflight на VPS
- rollback env snapshot
- rehearsal restore локального Postgres
- финальный production cutover при отдельном maintenance window

Этот runbook не покрывает:

- смену Prisma schema
- feature release
- отказ от `Supabase Auth`
- автоматический destructive cleanup старой Supabase DB

## Helper scripts

Для cutover используются следующие helper scripts:

- `scripts/postgres-cutover-preflight.sh`
- `scripts/postgres-cutover-env-snapshot.sh`
- `scripts/postgres-cutover-restore-rehearsal.sh`

Они не выполняют production switch автоматически и не должны смешиваться с обычным feature deploy.

## Recommended order

1. Выполнить VPS preflight:

```bash
scripts/postgres-cutover-preflight.sh
```

Ожидаемый результат:

- env file найден
- подтверждён headroom по диску и RAM
- доступны `psql`, `pg_dump`, `pg_restore`
- зафиксирован текущий host для `DATABASE_URL` и `DIRECT_URL`

2. Снять rollback env snapshot:

```bash
scripts/postgres-cutover-env-snapshot.sh
```

Ожидаемый результат:

- создан timestamped snapshot directory
- сохранена полная rollback-копия `.env.production`
- создан redacted summary без публикации секретов

3. Подготовить локальный Postgres на VPS.

Минимальные требования:

- runtime user для `DATABASE_URL`
- admin/migration user для `DIRECT_URL`
- `listen_addresses` ограничен локальным доступом
- backup path подготовлен заранее

4. Выполнить rehearsal restore в отдельную rehearsal DB.

Пример:

```bash
scripts/postgres-cutover-restore-rehearsal.sh \
  --admin-url "$POSTGRES_ADMIN_URL" \
  --target-db-url "$POSTGRES_REHEARSAL_DB_URL" \
  --target-db-name "newlaw_rehearsal" \
  --dump-file "/srv/newlaw/app/backups/postgres-cutover/final.dump" \
  --allow-reset
```

Ожидаемый результат:

- rehearsal DB восстановлена
- row-count sanity checks отработали успешно
- production env и runtime не тронуты

5. Только после rehearsal restore и отдельного maintenance window можно переходить к финальному env switch и app restart.

Для app restart и smoke после env switch использовать уже канонический порядок из [release-runbook.md](./release-runbook.md).

## Execution note

На текущем repo-state этот порядок уже был выполнен:

- был использован app-level dump схемы `public`
- rehearsal restore на `PG17` прошёл успешно
- production restore на local `PG17` прошёл успешно
- `DATABASE_URL` / `DIRECT_URL` были переключены на `127.0.0.1:5433`
- `Supabase Auth` не выносился из текущего контура

## Safety rules

- cutover не совмещается с feature release
- без maintenance window cutover не выполняется
- `DATABASE_URL` и `DIRECT_URL` должны указывать на разные credential paths
- rollback snapshot должен существовать до любых env-изменений
- restore rehearsal выполняется до production switch
- silent data cleanup запрещён
- старая Supabase DB не удаляется сразу после cutover

## Minimum rollback

Если local Postgres cutover не проходит:

1. вернуть `.env.production` из rollback snapshot
2. перезапустить `newlaw-app`
3. проверить:
   - `systemctl is-active newlaw-app`
   - `/api/health`
   - DB-backed smoke из `release-runbook.md`

Cutover не считается успешным, пока:

- приложение не работает на новом `DATABASE_URL` / `DIRECT_URL`
- `/api/health` не даёт `200`
- DB-backed smoke не проходит

На текущем repo-state этот cutover уже считается successful.
