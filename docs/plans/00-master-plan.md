# 00 — Мастер-план

## Назначение

Этот файл — главный актуальный сводный снимок по состоянию репозитория.
Он не является старой линейной очередью этапов.

Источники правды:

- текущее состояние репозитория
- актуальные документы в `docs/product`, `docs/architecture`, `docs/ops`
- активные планы, которые действительно остаются источником правды для future/post-MVP линий

Исторические закрытые поэтапные планы вынесены в архив:

- [../archive/2026-04/closed-plans/](../archive/2026-04/closed-plans/)

## Статус закрытия

По текущему согласованному контуру MVP проект формально закрыт.

Это означает:

- обязательных `pending`-блоков “чтобы дойти до MVP” больше нет
- текущие незакрытые линии не должны маскироваться под недоделанный MVP
- дальнейшее развитие должно оформляться только как:
  - future expansion
  - optional capability
  - post-MVP line
  - operational maturity

При этом закрытый MVP не отменяет возможные обязательные correction-задачи, если в текущем repo-state обнаружена неправильная access-control модель.
Такие correction-линии нужно фиксировать отдельно от post-MVP expansion и не трактовать как “MVP снова открыт”.

## Что уже закрыто по текущему состоянию репозитория

### Core platform

- `Next.js + TypeScript + App Router`
- `Supabase Auth`
- `Prisma` + текущая прикладная data model
- production runtime `PostgreSQL 17` на том же VPS
- account/security foundation
- character management
- server context foundation

### Product zones

- `/account`
- `/assistant`
- `/servers`
- `/servers/[serverSlug]`
- `/servers/[serverSlug]/documents/...`
- `/internal/...`

### Document area

Закрыты как реальные рабочие линии:

- `ogp_complaint`
- claims family:
  - `rehabilitation`
  - `lawsuit`

Зафиксировано:

- persisted drafts
- first-save snapshot capture
- generation metadata
- account-level documents aggregator
- server-scoped editor routes

### AI

Текущий MVP-уровень AI уже покрыт:

- `server legal assistant`
- document field rewrite v1
- first grounded document AI v2 rollout

Это означает, что AI нельзя описывать как “ещё не начат”, но и нельзя притворяться, что весь будущий расширенный AI-контур уже закрыт.

### Internal/admin contour

Закрыт current agreed scope для:

- `/internal/laws`
- `/internal/precedents`
- `/internal/security`
- `/internal/health`

### Deploy / release

Закрыт current agreed production hardening enough-for-scope:

- `systemd`
- immutable `release directories`
- `current` symlink
- shared env
- canonical deploy script
- preflight / smoke / rollback helpers
- local production `PostgreSQL 17` runtime на VPS

Дополнительно уже закрыто:

- runtime DB cutover с `Supabase Postgres` на local `PostgreSQL 17`
- `DATABASE_URL` / `DIRECT_URL` в production больше не используют Supabase pooler
- `Supabase Auth` остаётся в текущем контуре

`Docker Compose` не является текущим blocker и остаётся future operational target.

### `/app` policy

- `/app` больше не считается primary product zone
- `/app` остаётся только compatibility surface
- целевые зоны: `/account`, `/assistant`, `/servers`, `/internal`

## Что уже есть в repo, но не является MVP blocker

### Trustors

- `/account/trustors` уже существует
- CRUD и optional prefill уже существуют
- document flows при этом остаются snapshot-based
- `trustorId` не должен становиться обязательной runtime dependency для OGP/claims

### Forum automation

- линия технически реализована для `ogp_complaint`
- product status этой линии = `optional / temporary`
- она не является required user-facing MVP capability
- post-MVP policy: удалить или не развивать как core product capability

### Post-MVP template documents

Линия уже вошла в repo как отдельное post-MVP expansion направление:

- `attorney_request`
- `legal_services_agreement`

При этом:

- это не переоткрывает закрытый MVP
- это не переводит template documents в required MVP scope
- активный source-of-truth для этой линии — [12-post-mvp-template-documents.md](./12-post-mvp-template-documents.md)

## Что остаётся активными линиями

### `14-codebase-maintainability-db-stability-and-safe-refactor`

Статус: `active / technical maintainability + DB stability follow-up`

Это не MVP blocker и не product expansion.

Это отдельная техническая линия после production DB stability hotfix, направленная на:

- safe refactor
- read-path resilience
- DB stability follow-up
- снижение риска дальнейших регрессий

Отдельные правила этой линии:

- security correction по character access остаётся в плане `13`
- DB source of truth остаётся `docs/architecture/database.md` + `prisma/schema.prisma`
- release source of truth остаётся `docs/ops/release-runbook.md`
- план `14` не должен менять Prisma schema без отдельного DB-safe шага
- план `14` не должен добавлять migrations в обычных refactor PR
- переход на другой runtime DB hosting вынесен в отдельный план `15`

### `13-character-access-requests-and-role-approval`

Статус: `implemented in repo / security correction`

Это не post-MVP enhancement и не scope growth.

В текущем repo-state уже реализовано:

- self-service create/update персонажа больше не читает и не применяет `roleKeys` и `accessFlags`
- новый персонаж создаётся как безопасный профиль `citizen`
- роли и access flags меняются только через admin-only mutation path
- пользователь подаёт заявку на адвокатский доступ через `/account/characters`
- `super_admin` рассматривает pending-заявки через `/internal/access-requests`
- approve выдаёт `lawyer + advocate`
- reject не меняет назначения
- audit actions для create/approve/reject уже есть
- internal review-list уже выданных назначений существует как nondestructive инструмент ручной проверки

Эта correction-линия закрыта на уровне repo-state и больше не должна описываться как незавершённая продуктовая задача.

### `08-ai-integration`

Статус: `partial`

Остаётся активной, потому что текущий helper-уровень AI уже существует, а дальнейшее расширение beyond current scope ещё не закрыто.

Уточнение по роли этой линии:

- `08` остаётся общей зонтичной линией по AI-интеграции
- будущий `16` должен конкретизировать базовое legal core для юридической AI-выдачи
- будущий `17` должен описывать слой AI Quality Review уже после legal core
- `16` и `17` не должны дублировать или подменять `08`, а должны выступать как его более узкие post-MVP шаги-продолжения

### `16-ai-legal-core`

Статус: `post-MVP / active / стабилизация`

Это следующий именованный шаг после `15`, но по product-смыслу он конкретизирует AI-направление именно после `08`.

Источник правды для этой линии:

- [16-ai-legal-core.md](./16-ai-legal-core.md)

Фокус шага:

- довести базовую юридическую AI-выдачу до рабочего состояния до внедрения отдельного слоя `AI Quality Review`
- распространить единый legal core на `server legal assistant` и AI-доработку описательной части
- закрепить обязательный grounding по `server_id + law_version`
- ввести `intent`, `actor_context`, `response_mode`, `source ledger`, `fact ledger` и `self-assessment` как базовые элементы post-MVP контура юридической AI-выдачи, не подменяя общую AI-линию шага `08`

Что уже реализовано в repo:

- legal-core metadata и internal logging для assistant и document rewrite flows
- слой нормализации входного текста с `raw_input` / `normalized_input`
- полноценный `actor_context` contract для assistant и rewrite flows
- `law_version_contract` для assistant, обычного rewrite и grounded rewrite
- `source ledger` / `used_sources` для assistant
- `fact ledger` для AI-доработки описательной части
- retrieval-aware legal guardrails для обычного rewrite
- grounded rewrite с теми же legal-core принципами
- `input_trace` / `output_trace` для основных AI-flow
- скрытые future-review markers как мост к шагу `17`, но без включения самого review-слоя
- усиленная атрибуция источников в assistant, которая уже достаточно отделяет найденные, переданные и реально использованные источники для прикладных нужд legal core

Что ещё остаётся до практического закрытия:

- короткий этап стабилизации без открытия новых AI-подпроектов внутри `16`
- финальная проверка assistant / rewrite / grounded rewrite после следующей фиксации этого слоя

Что специально не нужно превращать в шаг `16`:

- внутренний review UI
- полное семантическое доказательство для каждой фразы ответа
- hard enforcement `ровно 3–7 норм`
- отдельный фреймворк оркестрации для дешёвых и дорогих операций
- всё, что по смыслу уже относится к `17-ai-quality-review`

После этого шага отдельной follow-up линией должен идти `17-ai-quality-review`, который не входит в сам шаг `16`.

### `17-ai-quality-review`

Статус: `post-MVP`

Это следующий именованный шаг после `16`, и он явно зависит от уже стабилизированного legal core из шага `16`.

Источник правды для этой линии:

- [17-ai-quality-review.md](./17-ai-quality-review.md)

Фокус шага:

- построить внутренний слой контроля качества AI-выдачи после `16`
- проверять и `server legal assistant`, и AI-доработку описательной части
- собирать спорные кейсы, flags, сигналы риска, fix instructions и ожидания для regression в управляемый внутренний контур проверки
- не выпускать автоматические изменения в production-логику без человека, `PR` / `commit` и проверки

Границы этой линии:

- `17` не является частью MVP
- `17` не подменяет зонтичную линию `08`
- `17` не заменяет legal core шага `16`, а зависит от него, идёт после него и проверяет уже выстроенную базовую AI-логику

### `12-post-mvp-template-documents`

Статус: `post-MVP`

Остаётся активной, потому что template documents уже реально вошли в repo как post-MVP expansion и нужен один актуальный документ с канонической policy этой линии.

### Trustors expansion beyond current convenience layer

Статус: `future`

Зафиксировано:

- текущий `/account/trustors` уже не foundation-only
- deeper expansion beyond current CRUD + prefill не является blocker
- отдельного активного плана для этого сейчас не требуется; хватает master snapshot + product docs

### Operational maturity beyond current release flow

Статус: `future`

Сюда относятся:

- `Docker Compose` migration
- deeper observability
- richer release tooling

Это не blocker для current done state.

### Post-cutover observation and eventual Supabase DB retirement

Статус: `future / operational follow-up`

Зафиксировано:

- runtime DB cutover уже завершён
- отдельного активного migration-плана для этого больше не требуется
- остаются только observation, monitoring и решение о сроках historical retirement старой Supabase DB

## Что специально не должно выглядеть как active task

Следующие линии больше не должны висеть как “следующие этапы”:

- bootstrap
- database/auth foundation
- early `/app` shell phases
- OGP complaint MVP rollout
- claims family rollout
- admin/internal reconciliation
- server hub foundation
- deploy/release foundation
- attorney request implementation plan
- legal services agreement spike plan

Их история перенесена в архив.

## Реальные незакрытые вопросы

Незакрытыми остаются:

1. Нужно ли расширять grounded document AI дальше уже реализованного first legal rollout.
2. Какой объём template documents line нужен beyond уже реализованных `attorney_request` и `legal_services_agreement`.
3. Нужна ли deeper trustors expansion beyond current `/account/trustors` convenience layer.
4. Нужно ли после MVP физически удалять временную forum automation line или достаточно прекратить её развитие.

## What Comes After MVP

Следующие линии уже не “до MVP”, а именно после него:

- deeper grounded document AI expansion
- deeper trustors expansion
- дальнейшее развитие template/PDF/JPG documents
- deeper operational/admin maturity

Важно:

- forum automation не возвращается в required scope
- trustors registry не возвращается в required scope
- `/app` не возвращается как primary product zone
