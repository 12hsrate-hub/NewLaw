# 00 — Master Plan

## Назначение

Этот файл больше не трактуется как старая линейная очередь крупных этапов.
Теперь это актуальный master snapshot по состоянию репозитория:

- source of truth = текущий repo
- source of truth = уже существующие `docs/plans/*`
- source of truth = реально реализованные маршруты, модули, миграции и release-поток

Если старые блоковые планы отстают по формулировкам или порядку этапов, этот документ фиксирует актуальную картину и не пытается подгонять репозиторий под устаревшую линейную схему.

## Как читать статусы

- `done` — крупный блок реально реализован и может считаться закрытым на уровне текущего согласованного scope
- `partial` — в репозитории уже есть заметная реализация, но блок как отдельная продуктовая единица ещё не закрыт
- `pending` — блок остаётся плановым и не подтверждён как реализованный
- `optional / temporary` — линия технически существует, но не является обязательной продуктовой capability
- `post-MVP` — намеренно вынесено за рамки MVP

## Progress Snapshot

### Done

#### `01-bootstrap`

Статус: `done`

Репозиторий давно ушёл дальше bootstrap-стадии:

- базовая структура проекта существует
- `Next.js + TypeScript + App Router` уже используются как рабочая основа
- dev/build/test pipeline реально используется в текущей разработке

#### `02-database-and-auth`

Статус: `done`

Реально присутствуют:

- `Prisma`
- рабочая модель данных
- `Supabase Auth`
- protected flows
- account-level guards и security foundation

#### `03-auth-shell-and-character-management` + `03-characters-and-roles`

Статус: `done`

Фактически реализованы:

- transitional protected shell в `/app`
- active server / active character
- character create/edit flow
- roles / `access_flags`
- owner-only character management
- account/security foundation

Важно:

- `/app` остаётся transitional
- это не меняет согласованную target route/module policy

#### `05-law-corpus-and-server-legal-assistant`

Статус: `done`

Фактически реализованы:

- law corpus import/storage/current-version foundation
- retrieval layer
- server legal assistant

#### `06-judicial-precedents-corpus`

Статус: `done`

Фактически реализованы:

- precedents corpus
- review/current selection
- интеграция precedents в assistant-линию

#### `07-document-area-and-ogp-complaint-mvp`

Статус: `done`

Фактически реализованы:

- document area
- `/account/documents` как агрегатор
- server-scoped document routes
- OGP complaint editor
- persisted draft flow
- snapshot foundation
- `BBCode` generation
- generation metadata
- optional manual publication metadata

Важно:

- OGP complaint MVP считается полноценным и без live forum automation
- user success state не зависит от факта реальной публикации на форуме

#### `08-claims-document-family`

Статус: `done`

Фактически реализованы:

- claims family routes
- persisted claims drafts
- shared editor для `rehabilitation` и `lawsuit`
- claims structured renderer
- generated checkpoint
- status integration inside document area

Важно:

- claims не смешиваются с OGP `BBCode` / publication model
- claims не используют forum/publication workflow как default capability

#### `10-server-list-and-server-hub-foundation`

Статус: `done`

Фактически реализованы:

- public `/servers`
- auth-gated `/servers/[serverSlug]`
- server directory summary layer
- server hub
- account zone completion around:
  - `/account`
  - `/account/security`
  - `/account/documents`
  - `/account/characters`
- `/account/characters` overview
- shared account subnav
- account-scoped character editor completion inside existing account route

Это означает, что account zone и server-scoped entry zone уже ушли значительно дальше старой крупноблочной схемы.

#### `12-admin-panel-reconciliation-and-completion`

Статус: `done`

Фактически реализованы и уже сведены в единый internal contour:

- `/internal`
- `/internal/laws`
- `/internal/precedents`
- `/internal/security`
- `/internal/health`
- shared internal nav и общий `super_admin`-only guard
- migration существующих corpus sections в `/internal/laws` и `/internal/precedents`
- migration admin account-security flow в `/internal/security`
- compact internal health summary в `/internal/health`
- transitional cleanup для:
  - `/app/admin-laws`
  - `/app/admin-security`

Важно:

- `/internal/...` теперь уже существует как единая internal zone
- `/app/admin-laws` и `/app/admin-security` больше не считаются primary admin surface
- они сохраняются только как transitional bridge routes к `/internal/*`
- это закрывает текущий agreed admin-panel scope, но не означает global `/app` cleanup

#### `09-deploy-and-release`

Статус: `done`

Фактически реализованы и уже доказаны на production:

- канонический MVP runtime model:
  - `systemd`
  - immutable `release directories`
  - `current` symlink
  - shared production env
- deterministic release sequence через canonical deploy script
- explicit env loading и explicit `PATH`
- `prisma generate` / `migrate deploy` / `build` как фиксированная часть release flow
- env preflight helper с required/optional classification
- reusable mandatory smoke helper
- rollback helper и рабочий rollback path
- repeated production releases по этой схеме

Важно:

- это закрывает текущий agreed hardening scope enough-for-MVP
- future operational maturity вроде release dashboard, full observability platform или Docker Compose migration не является blocker для formal done

#### `/app` migration / cleanup

Статус: `done`

Зафиксировано:

- `/app` больше не является primary workspace и остаётся только controlled compatibility surface
- default self-service target = `/account`
- canonical self-service security route = `/account/security`
- canonical character-management route = `/account/characters`
- canonical admin/internal contour = `/internal/*`
- `/account`, `/servers` и `/internal` реально выступают target zones
- `/app/security`, `/app/admin-laws` и `/app/admin-security` сохраняются как compatibility routes, а не как primary targets
- global hard removal `/app` не требуется для закрытия текущего agreed cleanup scope

### Optional / Temporary

#### `09-ogp-forum-automation`

Статус: `optional / temporary`

Важно разделять технический и продуктовый статус:

- линия `09.x` технически реализована
- существуют account-scoped forum integration foundation, publish create и resync/update flow
- но это больше не считается обязательной пользовательской частью MVP

Зафиксировано:

- forum automation не является обязательным user-facing OGP сценарием
- cookies / forum session не считаются обязательным пользовательским вводом
- live create/update against `forum.gta5rp.com` не является blocking acceptance для MVP
- `manual publication_url` может оставаться только как optional metadata / fallback

Post-MVP policy для этой линии:

- она не должна развиваться дальше как core product capability
- после MVP она подлежит удалению из продукта

### Optional / Future

#### `04-trustors`

Статус: `optional / future`

Честная картина по repo:

- trustor snapshot уже используется внутри `OGP complaints` и claims representative flow
- current representative flows не блокируются отсутствием standalone registry
- document success state уже не зависит от отдельного trustors module

Поэтому:

- inline document trustor usage = уже есть и достаточно для MVP
- standalone trustor registry = optional convenience line
- если registry позже появится, его target route = `/account/trustors`

### Partial

#### `08-ai-integration`

Статус: `partial`

Что уже есть по факту:

- серверный AI-layer
- assistant как отдельный модуль
- logging foundation
- document field rewrite v1 внутри existing OGP/claims editors
- agreed v1 scope для field-level rewrite уже реально закрыт
- текущий согласованный MVP AI scope больше не выглядит пустым или недоделанным

Что не подтверждено как отдельный завершённый product block:

- более широкий document-AI suite beyond field rewrite
- grounding by law corpus / precedents inside document AI
- consistency-check и broad drafting workflows
- отдельное решение о том, нужно ли расширять document AI beyond current helper-level inside editor

Поэтому:

- assistant и AI infrastructure сильно продвинуты
- первый document-AI block уже реально реализован
- current MVP-level AI scope можно считать покрытым существующим assistant module + document field rewrite v1
- но весь AI block нельзя автоматически считать формально закрытым только из-за assistant + rewrite v1

### Post-MVP

#### `12-post-mvp-template-documents`

Статус: `post-MVP`

Server-specific template documents остаются отдельной post-MVP линией и не смешиваются с текущим MVP.

#### Post-MVP cleanup: forum automation removal

Статус: `post-MVP`

Так как `09.x` больше не считается обязательной продуктовой частью MVP, после MVP эта capability должна удаляться, а не продолжать расти как “раз уже реализовано, значит остаётся”.

## Почему старая линейная схема больше не отражает repo

Старая версия master plan отставала от фактической разработки по нескольким причинам:

- assistant, document area и claims развивались отдельными шагами быстрее, чем это отражала старая крупноблочная цепочка
- server directory и server hub появились как отдельная линия позже старого linear plan
- account zone существенно изменилась после появления `/account/security`, `/account/documents` и `/account/characters`
- OGP forum automation была технически реализована, но затем получила новый product status: optional / temporary instead of required MVP capability

Поэтому актуальный master plan дальше должен читаться как reconciliation snapshot, а не как историческая линейка “слева направо”.

## Актуальная route / module policy

На текущий момент согласованная целевая карта маршрутов выглядит так:

- `/account` — account zone
- `/account/security` — account security / integrations
- `/account/characters` — account-scoped character management
- `/account/documents` — document aggregator
- `/assistant` и `/assistant/[serverSlug]` — отдельный assistant module вне кабинета
- `/servers` — public server directory
- `/servers/[serverSlug]` — auth-gated server hub
- `/servers/[serverSlug]/documents/...` — server-scoped document area
- `/internal/...` — целевой internal / super-admin contour
- `/app` — transitional shell, а не target-zone для новых крупных модулей

## Что ещё остаётся до более формального MVP closure

С учётом фактического repo остаются следующие честные открытые вопросы:

1. Нужно ли расширять document AI дальше уже реализованного field rewrite v1, если текущий MVP AI scope уже покрыт helper-уровнем внутри existing editors.

## Спорные места, которые не стоит маскировать

### Trustors

Больше не считается открытым MVP-блокером:

- trustor snapshots уже признаны достаточными для MVP
- standalone trustors registry больше не трактуется как обязательный блок MVP
- если later convenience module всё же понадобится, он должен оформляться отдельно и жить в `/account/trustors`

### AI integration

Спорное место:

- assistant и AI infrastructure в repo уже сильно продвинуты
- document field rewrite v1 уже реализован внутри document area
- agreed v1 scope для document field rewrite уже закрыт
- текущий MVP AI scope больше не должен описываться как незакрытый blocker
- но большой AI-suite по-прежнему не должен притворяться закрытым только потому, что есть assistant и rewrite foundation

### Deploy / release hardening

Больше не считается открытым продуктовым blocker:

- operational release flow уже формализован и production-proven
- helper layer для preflight / smoke / rollback уже существует
- дальнейшая operational maturity возможна позже, но не нужна для текущего MVP closure
