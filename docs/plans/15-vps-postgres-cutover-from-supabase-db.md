# 15 — VPS Postgres cutover from Supabase database

## Статус блока

Статус: `implemented in repo / infrastructure DB migration`

Этот блок:

- не reopening MVP
- не product feature
- не замена [../architecture/database.md](../architecture/database.md)
- не замена [../ops/release-runbook.md](../ops/release-runbook.md)
- не continuation плана [14-codebase-maintainability-db-stability-and-safe-refactor.md](./14-codebase-maintainability-db-stability-and-safe-refactor.md), а отдельная infra-линия
- сохраняет `Supabase Auth` и при необходимости `Supabase Storage` в текущем контуре

Текущий repo-state после выполнения cutover:

- production runtime DB уже переведена с `Supabase Postgres` на local `PostgreSQL 17` на том же VPS
- `DATABASE_URL` и `DIRECT_URL` в production уже указывают на `127.0.0.1:5433`
- `Supabase Auth` остаётся в текущем контуре
- old `Supabase DB` больше не используется как runtime DB

## Цель

Цель этого плана:

- убрать зависимость runtime Postgres от `Supabase shared pooler egress`
- перевести `DATABASE_URL` и `DIRECT_URL` на локальный Postgres на VPS
- сохранить текущее приложение и текущий release flow
- уменьшить egress pressure и зависимость от `Supabase DB quota`
- не ломать текущую продуктовую модель

## Почему появился этот план

Этот план появился, потому что текущий production/runtime follow-up уже показал:

- на free plan заметная часть лимита уходит в `Shared Pooler Egress`
- текущий размер базы маленький и не является основным bottleneck
- в production уже фиксировались `Prisma P2024` и `Prisma P1001`
- pooler / connection pressure уже стал operational проблемой, а не только quality issue
- `DIRECT_URL = DATABASE_URL` уже отмечен как operational risk

Это означает, что вопрос больше не сводится к generic refactor или maintainability. Это отдельное hosting/cutover решение по runtime DB.

## Что этот план НЕ делает

Этот план:

- не меняет Prisma schema
- не описывает product refactor
- не меняет routes, UI и server actions
- не заменяет `Supabase Auth`
- не требует полного выхода из Supabase
- не выполняет автоматическое destructive удаление данных
- не делает “горячую” миграцию без maintenance window
- не смешивается с обычным refactor PR

## Целевая модель

Целевая модель после cutover:

- приложение остаётся на текущем VPS
- новый Postgres поднимается на том же VPS
- `DATABASE_URL` указывает на local runtime user
- `DIRECT_URL` указывает на local admin/migration user
- `DATABASE_URL` и `DIRECT_URL` остаются разными credential paths даже на одном host
- `Supabase Auth` и текущие env для него сохраняются

## Execution snapshot

По фактическому выполнению уже сделано:

1. docs-only фиксация решения
2. VPS capacity / preflight
3. cleanup VPS disk pressure перед локальным Postgres
4. local `PostgreSQL 17` install / config
5. rollback env snapshot
6. rehearsal restore через `public` schema dump
7. финальный `public` dump из Supabase
8. restore в local `newlaw_production`
9. `prisma migrate deploy` против локального `DIRECT_URL`
10. production env switch и app restart
11. post-cutover smoke

Важно:

- для NewLaw корректным оказался не full Supabase cluster dump, а app-level dump схемы `public`
- Supabase-specific managed objects и extensions не считаются целевой моделью для local Postgres cutover

## Work order

1. Docs-only фиксация решения  
   Expected outcome: отдельный source of truth для controlled DB hosting migration, не смешанный с plan 14.

2. VPS capacity / preflight  
   Expected outcome: подтверждены диск, RAM, CPU headroom и backup path для локального Postgres.

3. Local Postgres install / config  
   Expected outcome: на VPS поднят отдельный Postgres runtime с раздельными runtime/admin credentials.

4. Backup / restore rehearsal  
   Expected outcome: подтверждено, что dump из Supabase корректно восстанавливается в тестовую локальную БД на VPS.

5. Final dump from Supabase  
   Expected outcome: снят финальный логический dump app-data перед production cutover.

6. Restore to VPS Postgres  
   Expected outcome: production data восстановлены в локальный Postgres без destructive cleanup исходной Supabase DB.

7. `prisma migrate deploy` against new `DIRECT_URL`  
   Expected outcome: schema state подтверждён уже на локальном Postgres через migration path.

8. Production env switch  
   Expected outcome: `DATABASE_URL` и `DIRECT_URL` переключены на локальный Postgres без изменения остальных Supabase env.

9. App restart and smoke  
   Expected outcome: приложение успешно поднимается на новой БД и проходит `/api/health` + DB-backed smoke.

10. Rollback or stabilization follow-up  
   Expected outcome: либо cutover подтверждён и стабилизирован, либо выполнен быстрый rollback на Supabase DB без потери данных.

## Safety rules

- migration делается отдельным infra-шагом
- cutover нельзя совмещать с feature release
- Prisma schema нельзя менять в том же цикле
- destructive cleanup old Supabase DB делать нельзя
- rollback env snapshot обязателен
- maintenance window обязателен
- сначала выполняется restore verification, потом app cutover
- без успешного `/api/health` и DB-backed smoke cutover не считается завершённым

## Acceptance criteria

План считается выполненным, когда:

- локальный Postgres на VPS подготовлен
- данные восстановлены
- приложение работает на новом `DATABASE_URL` / `DIRECT_URL`
- smoke проходит
- rollback описан и проверен как реальная опция
- `Supabase DB` больше не является runtime DB
- `Supabase Auth` продолжает работать в текущем контуре

На текущем repo-state эти критерии уже закрыты.

## Что остаётся после cutover

После завершения миграции остаются только post-cutover follow-up задачи:

- observation window и дополнительный мониторинг логов
- ручная проверка авторизованных сценариев `/account/documents`, `/account/trustors` и editor routes
- решение о сроках архивации или отключения старой Supabase DB как historical source

Это уже не reopen этого плана как активной migration-линии, а обычный post-cutover operational follow-up.
