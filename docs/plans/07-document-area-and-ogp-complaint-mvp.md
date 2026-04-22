# 07 — Document Area и OGP Complaint MVP

## Статус блока

Текущий согласованный MVP-скоуп блока реализован.

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

Новая product policy для OGP:

- OGP complaint MVP считается полноценным и без live forum automation
- обязательный пользовательский путь заканчивается корректным persisted документом и generation result
- manual `publication_url` может оставаться только как optional metadata / fallback
- real forum session / cookies не считаются обязательным пользовательским вводом
- live publish / update against `forum.gta5rp.com` не является blocking acceptance для этого блока

Что не входит в этот блок сразу:

- claims implementation
- template documents module
- forum automation beyond agreed MVP flow
- precedents-aware document logic

Post-MVP note:

- даже если техническая линия forum automation уже существует, она не должна считаться долгосрочной продуктовой опорой
- после MVP эта capability должна быть удалена, а не развиваться дальше по умолчанию

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

### 07.4 — OGP complaint editor MVP

Статус: реализовано.

Что входит:

- OGP-specific form flow
- self / representative branching
- trustor usage inside document
- evidence groups and rows
- validation rules для жалобы

Что не входит:

- claims
- template documents

Результат шага:

- `/servers/[serverSlug]/documents/ogp-complaints/new` стал реальным pre-draft create entry, а не просто foundation screen
- после first save работа продолжается в owner-only route `/servers/[serverSlug]/documents/ogp-complaints/[documentId]` без поломки snapshot invariants шага `07.3`
- complaint payload теперь уже хранит:
  - `filing_mode`
  - `appeal_number`
  - `object_organization`
  - `object_full_name`
  - `incident_at`
  - `situation_description`
  - `violation_summary`
  - `working_notes`
  - `trustor snapshot`
  - `evidence groups / evidence rows`
- self filing работает для любого доступного персонажа
- representative filing доступен только персонажу с `access flag advocate`
- при representative filing trustor snapshot живёт внутри самого документа и сохраняется консистентно в persisted payload
- evidence links сохраняются в структуре, пригодной для будущего `BBCode` generation без переделки схемы
- `/account/documents` и `/servers/[serverSlug]/documents/ogp-complaints` уже показывают persisted `ogp_complaint` drafts/documents пользователя
- `BBCode` generation, publication metadata UI и forum automation остаются следующими шагами

### 07.5 — BBCode generation и publication metadata

Статус: реализовано.

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

Результат шага:

- generation `BBCode` вызывается только для persisted `ogp_complaint` документа и всегда строится из сохранённого payload
- generation deterministic: один и тот же persisted payload даёт предсказуемый `BBCode`
- generation работает для `self` и `representative`, при representative flow использует trustor snapshot из самого документа
- `evidenceGroups` и `evidenceRows` со ссылками корректно попадают в итоговый `BBCode`
- generation честно блокируется при неполном обязательном profile или неполном complaint payload
- при успешной generation сохраняются:
  - `last_generated_bbcode`
  - `generated_at`
  - `generated_law_version`
  - `generated_template_version`
  - `generated_form_schema_version`
- успешная generation переводит документ из `draft` в `generated`
- последующая правка persisted документа помечает его как `modified_after_generation`
- `publication_url` и manual forum sync metadata уже можно обновлять вручную только для owner и только после хотя бы одной успешной generation
- `/account/documents` и `/servers/[serverSlug]/documents/ogp-complaints` уже показывают generation-related state
- forum automation, external forum checks и любые другие document families остаются вне этого шага

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
