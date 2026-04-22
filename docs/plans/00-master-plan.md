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
- `/account/characters` overview
- account subnav
- account-scoped character editor completion

Это означает, что account zone и server-scoped entry zone уже ушли значительно дальше старой крупноблочной схемы.

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

#### `07-admin-panel`

Статус: `partial`

В repo есть признаки internal/admin foundation:

- transitional admin-related routes
- отдельные internal/admin куски для security и laws

Но пока не подтверждён как завершённый цельный product block:

- единый `/internal/...` contour ещё не оформлен как законченная пользовательская/административная зона
- старый крупный план админки нельзя честно считать закрытым

#### `08-ai-integration`

Статус: `partial`

Что уже есть по факту:

- серверный AI-layer
- assistant как отдельный модуль
- logging foundation
- document field rewrite v1 внутри existing OGP/claims editors

Что не подтверждено как отдельный завершённый product block:

- более широкий document-AI suite beyond field rewrite
- grounding by law corpus / precedents inside document AI
- consistency-check и broad drafting workflows

Поэтому:

- assistant и AI infrastructure сильно продвинуты
- первый document-AI block уже реально реализован
- старый крупный AI-блок нельзя автоматически считать формально закрытым

#### `09-deploy-and-release`

Статус: `partial`

Фактически в repo и текущем процессе уже есть:

- повторяемые локальные проверки
- реальные production releases
- smoke-check discipline
- `/api/health`
- runtime checks

Но как отдельный формально закрытый блок всё ещё остаются вопросы:

- старый план deploy/release не полностью совпадает с текущей фактической operational схемой
- release hardening и финальная формализация процесса ещё не сведены в честный “formal done”

### Pending

#### `/app` migration / cleanup

Статус: `pending`

Зафиксировано:

- `/app` остаётся transitional
- новые крупные user-facing модули больше не должны строиться вокруг `/app`
- но отдельный cleanup / migration block ещё не выполнен

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

1. Нужен ли отдельный цельный admin panel block как обязательная часть MVP, или текущих internal/admin foundations пока достаточно.
2. Нужно ли расширять document AI дальше уже реализованного field rewrite v1, или для MVP достаточно текущего helper-уровня внутри editor.
3. Нужен ли отдельный formal deploy/release hardening block поверх уже работающего production release процесса.

## Спорные места, которые не стоит маскировать

### Trustors

Больше не считается открытым MVP-блокером:

- trustor snapshots уже признаны достаточными для MVP
- standalone trustors registry больше не трактуется как обязательный блок MVP
- если later convenience module всё же понадобится, он должен оформляться отдельно и жить в `/account/trustors`

### Admin panel

Спорное место:

- internal/admin foundations уже есть
- но законченный admin panel block по старому плану явно не оформлен

### AI integration

Спорное место:

- assistant и AI infrastructure в repo уже сильно продвинуты
- document field rewrite v1 уже реализован внутри document area
- но большой AI-suite по-прежнему не должен притворяться закрытым только потому, что есть assistant и rewrite foundation

### Deploy / release hardening

Спорное место:

- operational release flow фактически существует
- но старый deploy-plan документ и формальная стадия release hardening ещё не сведены к одному честному status
