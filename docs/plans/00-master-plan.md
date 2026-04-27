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

Это зонтичная AI-линия.

Роль этой линии:

- зафиксировать, что AI-направление в проекте уже существует
- зафиксировать текущий общий AI-контур
- быть точкой входа в более узкие post-MVP шаги

Границы:

- `08` не описывает детальную legal-core механику
- `08` не описывает детальный quality-review workflow
- `08` не подменяется шагами `16` и `17`

Источник правды:

- [08-ai-integration.md](./08-ai-integration.md)

### `16-ai-legal-core`

Статус: `post-MVP / active / partial`

Это отдельный post-MVP шаг после `08`, но только для `AI Legal Core`.

Роль этой линии:

- зафиксировать `input normalization`
- зафиксировать единый legal pipeline
- зафиксировать `LegalQueryPlan`
- зафиксировать `LawFamily`
- зафиксировать `NormRole`
- зафиксировать `applicability scoring`
- зафиксировать `structured selection`
- зафиксировать `Corpus Metadata and Citation Readiness Audit` как первый future slice
- зафиксировать `LegalIssueType diagnostics contract`
- зафиксировать future `Legal Citation Parser / Citation Resolver`
- зафиксировать retrieval quality hardening
- зафиксировать future `source specificity ranking`
- зафиксировать `primary_basis_eligibility`
- зафиксировать future `PrimaryBasisEligibility v2`
- зафиксировать `direct_basis_status`
- зафиксировать compact generation context
- зафиксировать internal runner modes `core_only` / `compact_generation`
- зафиксировать compact runtime payload + internal full payload
- зафиксировать `source_ledger`, `fact_ledger` и `self-assessment`
- зафиксировать multi-server grounding через `server_id + law_version`
- зафиксировать scenario groups и expectation-based test suites как контур ручной проверки legal core
- зафиксировать, что scenario suites будут уменьшаться и очищаться от дублей
- зафиксировать `16.3 AI Legal Core — NormBundle and Companion Context` как active partial line
- зафиксировать, что slices `5a`-`5c.1` по `NormBundle` уже задеплоены на production
- зафиксировать, что `5d` уже добавил companion-aware expectation layer для `attorney_request` без изменения runtime
- зафиксировать, что `5d.1` уже расширил companion-aware expectations на `attorney_rights` как acceptance-only слой без изменения runtime
- зафиксировать, что `5d.2` уже минимально расширил companion-aware expectations на `bodycam_and_recording` только для access-сценариев без изменения runtime
- зафиксировать, что `5d.3` в repo-state расширяет companion-aware expectations на `multi_server_variance` без изменения runtime
- зафиксировать, что `16.3` на текущем уровне считается `stabilised / partial-complete line`, а следующий крупный AI Legal Core шаг лучше искать вне дальнейшего companion expansion
- зафиксировать implemented `citation behavior contract v1`, который различает `citation_explanation`, `citation_application`, thin-facts application и `unresolved_citation` без изменения `Step 17` gate policy
- зафиксировать production deploy `citation behavior contract v1` на release `af7f4f6` с успешным targeted citation smoke и правилом `node --env-file`, без `bash source`
- зафиксировать implemented broader citation behavior scenario suite как suite/test expansion поверх `citation behavior contract v1`, без runtime hardening v1.1 и без новых expectation fields в scenario/evaluator layer

Границы:

- `16` не подменяет шаг `08`
- `16` не включает `AI Quality Review`
- `16` не включает review workflow, `fix_instruction`, `AI Behavior Rules` и `regression gate`

Источник правды:

- [16-ai-legal-core.md](./16-ai-legal-core.md)

### `17-ai-quality-review`

Статус: `post-MVP / active / partial`

Это отдельный post-MVP шаг после `16`, и он зависит от уже определённого `AI Legal Core`.

Роль этой линии:

- проверять цепочку `raw_input -> normalized_input -> selected norms -> final output`
- выделять `law_basis_issue`
- фиксировать review flags и normalization flags
- задавать `fix_instruction`
- задавать `AI Behavior Rules`
- задавать `regression gate`
- принимать в review queue и реальные кейсы, и результаты test runner из шага `16`
- учитывать `server_id + law_version` как обязательный review-контекст
- в future expansion проверять не только `selected norms`, но и ошибки `NormBundle / companion context`, не подменяя `AI Legal Core`
- в future expansion проверять citation-related flags, не превращая шаг `17` в citation resolver
- зафиксировать `17.1a` как implemented deterministic review kernel для `law-basis / grounding issues` без изменения runtime `Step 16`
- зафиксировать `17.1b` как internal reporting integration для `law_basis_review` без regression gate и без изменения public behavior
- зафиксировать `17.1c` как calibration baseline для deterministic review flags без suite blocking и без изменения runtime/public behavior
- зафиксировать `17.1d` как non-blocking gate simulation для deterministic review flags без изменения suite result и без изменения runtime/public behavior
- зафиксировать `17.1e` как dry-run calibration report для `law_basis_gate_simulation` без blocking policy и без изменения runtime/public behavior
- зафиксировать `17.2` как narrow internal-only opt-in gate readiness только для `sanction_or_exception_used_as_primary`, без изменения suite result и без изменения runtime/public behavior
- зафиксировать `17.2a` как usage validation и runbook для internal-only opt-in law basis gate без расширения blocking scope
- зафиксировать, что текущий этап `16` закрыт как runtime legal grounding foundation, а текущий этап `17` закрыт как internal deterministic quality review / gate-readiness contour
- зафиксировать, что broader regression gate, expanded blocking flags, review UI, Prisma/schema для review history, AI reviewer, cross-run analytics/trends, broad answer quality rewrite, anti-hallucination line и future runtime hardening для citation behavior остаются отдельными future линиями
- зафиксировать, что следующий крупный AI Legal Core этап должен выбираться отдельно, а не через автоматическое расширение `16/17`

Границы:

- `17` не подменяет шаг `08`
- `17` не проектирует legal core заново
- `17` не определяет retrieval-механику вместо шага `16`

Источник правды:

- [17-ai-quality-review.md](./17-ai-quality-review.md)

Дополнительный принцип для AI-линии:

- дальнейшие AI-улучшения не должны затачиваться под `4` ручных вопроса
- дальнейшие AI-улучшения должны идти по `error classes`, а не по списку конкретных формулировок
- основной контроль качества должен идти через scenario groups и expectation-based test suites
- `multi_server_variance` должен рассматриваться как обязательная future test dimension, а не current runtime hardcode path

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
