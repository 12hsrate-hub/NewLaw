# 00 — Master Plan

## Назначение

Этот файл — главный актуальный reconciliation snapshot по состоянию репозитория.
Он не является старой линейной очередью этапов.

Source of truth:

- текущий repo-state
- актуальные docs в `docs/product`, `docs/architecture`, `docs/ops`
- активные планы, которые реально остались future/post-MVP source of truth

Исторические закрытые поэтапные планы вынесены в архив:

- [../archive/2026-04/closed-plans/](../archive/2026-04/closed-plans/)

## Closure Snapshot

По current agreed scope MVP формально закрыт.

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

## Что уже закрыто по текущему repo-state

### Core platform

- `Next.js + TypeScript + App Router`
- `Supabase Auth`
- `Prisma` + текущая прикладная data model
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

Current MVP-level AI scope уже покрыт:

- `server legal assistant`
- document field rewrite v1
- first grounded document AI v2 rollout

Это означает, что AI нельзя описывать как “ещё не начат”, но и нельзя притворяться, что весь future AI-suite уже закрыт.

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

### `13-character-access-requests-and-role-approval`

Статус: `active / security correction`

Это не post-MVP enhancement и не scope growth.

Зафиксировано:

- текущий repo-state реально позволяет self-service назначение `roleKeys` и `accessFlags`
- обычный пользователь не должен иметь возможности сам выдавать себе `lawyer`, `advocate`, `server_editor`, `server_admin`, `tester`
- новый персонаж должен создаваться только как безопасный профиль `citizen`
- адвокатский доступ должен выдаваться только через заявку пользователя и admin approve

Эта линия обязательна, потому что исправляет неправильную access-control модель, а не добавляет новую продуктовую ветку.

### `08-ai-integration`

Статус: `partial`

Остаётся активной, потому что current helper-level AI уже существует, а дальнейшее расширение beyond current scope ещё не закрыто.

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

1. Как быстро закрыть обязательную access-control correction по self-service ролям и адвокатскому доступу.
2. Нужно ли расширять grounded document AI дальше уже реализованного first legal rollout.
3. Какой объём template documents line нужен beyond уже реализованных `attorney_request` и `legal_services_agreement`.
4. Нужна ли deeper trustors expansion beyond current `/account/trustors` convenience layer.
5. Нужно ли после MVP физически удалять временную forum automation line или достаточно прекратить её развитие.

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
