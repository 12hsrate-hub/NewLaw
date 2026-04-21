# 07 — Document Area и OGP Complaint MVP

## Статус блока

Блок открыт.

Зафиксировано:

- route/module placement для document area уже согласован
- `/account/documents` — только агрегатор
- `/servers/[serverSlug]/documents` — server-scoped document area
- первый рабочий document family в MVP — `OGP complaints`
- claims и post-MVP template documents не должны смешиваться с первым MVP flow

## Цель блока

Построить корректную document area архитектуру и затем реализовать внутри неё первый рабочий документный сценарий MVP — жалобу в ОГП с итоговой генерацией `BBCode`.

Этот блок не должен:

- возвращать document flow в `/app`
- превращать `/account/documents` в основной editor center
- смешивать OGP complaint с claims
- смешивать MVP complaint flow с post-MVP template documents

## Зафиксированная архитектура

### Account overview

- `/account` — account zone
- `/account/documents` — cross-server обзор документов пользователя
- это overview-маршрут, а не основной create/edit flow

### Server-scoped document area

- `/servers/[serverSlug]/documents` — server-scoped document hub
- source of truth по серверу — только `serverSlug` из URL
- active server из `/app` shell не используется как источник server context

### OGP complaint family

- `/servers/[serverSlug]/documents/ogp-complaints`
- `/servers/[serverSlug]/documents/ogp-complaints/new`
- `/servers/[serverSlug]/documents/ogp-complaints/[documentId]`

Create/edit contract:

- создание начинается в `/new`
- после первого сохранения работа продолжается в `[documentId]`
- server context после создания уже не меняется
- character snapshot фиксируется позже, в persistence/snapshot шаге

### Future fit

Позже сюда войдут:

- `/servers/[serverSlug]/documents/claims`
- `/servers/[serverSlug]/documents/templates/...`

Но в текущем MVP-блоке они не реализуются.

## Document context rules

- document modules доступны только авторизованному пользователю
- создание документа возможно только если у пользователя есть хотя бы один персонаж на этом сервере
- если персонажей нет, показывается server-scoped empty state с временным CTA в текущий transitional characters flow
- персонаж может подставляться как last-used UX-default для этого сервера
- сервер и персонаж всегда должны быть явно показаны пользователю
- до первого сохранения персонажа можно будет сменить
- после первого сохранения сервер и character snapshot станут фиксированными

## Lifecycle rules для document area

Верхнеуровневая модель статусов документа:

- `draft`
- `generated`
- `published`

Отдельно зафиксировано:

- owner документа = аккаунт
- actor документа = персонаж в snapshot
- law corpus update не мутирует черновик автоматически
- позже допустим `warning + manual rebuild`
- старые документы остаются историческими snapshot-объектами, даже если персонаж или роли потом изменились

## OGP complaint MVP scope

Внутри этого блока OGP complaint остаётся отдельным document family, а не общей платформой для всех будущих документов.

В MVP для этого family позже должны появиться:

- self / representative flow
- работа с trustor внутри документа
- evidence links
- generate `BBCode`
- `publication_url` и manual forum sync metadata только для `ogp_complaint`

Что не входит в этот блок сразу:

- claims implementation
- template documents module
- forum automation beyond agreed MVP flow
- precedents-aware document logic

## Подшаги

### 07.2 — Document area foundation

Что входит:

- `/account`
- `/account/documents`
- `/servers/[serverSlug]/documents`
- `/servers/[serverSlug]/documents/ogp-complaints`
- `/servers/[serverSlug]/documents/ogp-complaints/new`
- `/servers/[serverSlug]/documents/ogp-complaints/[documentId]`
- auth/server/character availability guards
- honest empty / unavailable states

Что не входит:

- document persistence
- first-save snapshot capture
- autosave
- OGP field logic
- `BBCode` generation

### 07.3 — Document persistence + snapshot foundation

Статус: реализовано.

Что входит:

- document model и storage foundation
- first-save snapshot capture
- immutable server / character context after first save
- manual save foundation
- basic autosave foundation
- persisted owner-account editor route
- persisted aggregator в `/account/documents`
- persisted family list для `ogp_complaint`

Что не входит:

- full OGP wizard
- `BBCode` generation

Результат шага:

- добавлена реальная `Document`-модель в Prisma
- первое сохранение из `/servers/[serverSlug]/documents/ogp-complaints/new` создаёт `draft`, фиксирует `serverId`, `characterId`, `author_snapshot_json` и `snapshotCapturedAt`
- после first save server context и author snapshot больше не меняются
- `/servers/[serverSlug]/documents/ogp-complaints/[documentId]` больше не fake foundation route, а owner-account persisted editor
- в editor route уже работает минимальный autosave/manual save для `title` и `workingNotes`
- `/account/documents` показывает реальные persisted документы пользователя
- `/servers/[serverSlug]/documents/ogp-complaints` показывает persisted список документов family `ogp_complaint`
- полный OGP wizard, `BBCode` generation и forum/publication logic остаются следующими шагами

### 07.4 — OGP complaint wizard MVP

Что входит:

- OGP-specific form flow
- self / representative branching
- trustor usage inside document
- evidence groups and rows
- validation rules для жалобы

Что не входит:

- claims
- template documents

### 07.5 — BBCode generation и publication metadata

Что входит:

- generation `BBCode`
- preview/copy flow
- `last_generated_bbcode`
- `generated_at`
- generation metadata
- `publication_url`
- manual forum sync marker

Что не входит:

- forum automation beyond agreed MVP flow

## Acceptance criteria

### Foundation document area готов

- `/account/documents` существует как агрегатор
- `/servers/[serverSlug]/documents` существует как server-scoped hub
- OGP family routes существуют как foundation contract
- route placement не возвращает document work в `/app`
- claims и template documents не подмешаны в текущий UI и routing

### Можно переходить к persistence и OGP implementation

- auth/server/character availability guards уже заведены
- character context foundation уже показан в UI
- `/new -> [documentId]` contract уже существует
- `[documentId]` route уже закреплён как owner-account editor foundation, а не как public arbitrary route
