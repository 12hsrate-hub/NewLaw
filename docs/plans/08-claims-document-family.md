# 08 — Claims Document Family

## Статус блока

Блок открыт.

Зафиксировано:

- `Claims` — вторая user-facing family внутри уже существующей document area
- routes живут в server-scoped зоне, а не в `/account` и не в `/app`
- user-facing family slug: `/servers/[serverSlug]/documents/claims`
- internal machine keys остаются:
  - `rehabilitation`
  - `lawsuit`
- claims не наследуют автоматически `OGP complaint` generation/publication workflow

## Цель блока

Добавить `Claims` как отдельную document family внутри уже работающей document area так, чтобы:

- она coexist с `OGP complaints` без route/UX конфликта
- не ломала общую `Document` model
- не смешивалась с post-MVP template documents
- могла дальше раскрываться по подшагам без смены route/module policy

## Зафиксированная архитектура

### Route contract

- `/servers/[serverSlug]/documents/claims`
- `/servers/[serverSlug]/documents/claims/new`
- `/servers/[serverSlug]/documents/claims/[documentId]`

Claims живут рядом с `OGP complaints` в одном server-scoped hub:

- `/servers/[serverSlug]/documents`

`/account/documents` остаётся агрегатором и позже показывает claims рядом с OGP documents.

### Family и machine keys

User-facing family:

- `Claims`

Внутренние `document_type`:

- `rehabilitation`
- `lawsuit`

Отдельный `document_type = claims` не вводится.

### Context rules

- source of truth по серверу — только `serverSlug` из URL
- last-used character допустим только как UX-default до first save
- first-save snapshot policy для claims должна быть такой же, как у `ogp_complaint`
- owner документа = account
- actor документа = character snapshot
- документ не может сменить сервер после создания

### Representative / trustor policy

Для claims зафиксирован тот же high-level default, что и для OGP:

- `self`
- `representative`

Rules:

- `self` доступен любому пользователю с доступным персонажем на сервере
- `representative` позже доступен только при `access_flag = advocate`
- trustor живёт внутри документа как snapshot
- trustor registry может позже использоваться как источник заполнения, но не как обязательная runtime-зависимость

### Output policy

Claims не используют OGP `BBCode`/publication flow по умолчанию.

Зафиксировано:

- на линии claims нет автоматического `BBCode`
- нет автоматического `publication_url`
- нет forum sync workflow
- если позже понадобится output/rendering для claims, это должен быть отдельный claims-specific block

## Подшаги

### 08.2 — Claims family routes и UX foundation

Что входит:

- `/servers/[serverSlug]/documents/claims`
- `/servers/[serverSlug]/documents/claims/new`
- `/servers/[serverSlug]/documents/claims/[documentId]`
- subtype choice `rehabilitation | lawsuit`
- claims как отдельная active family рядом с `OGP complaints`

Что не входит:

- claims persistence
- first-save snapshot capture
- claims editor payload
- generation/output
- publication/forum automation

### 08.3 — Claims persistence + snapshot foundation

Что входит:

- persisted drafts для `rehabilitation` и `lawsuit`
- first-save snapshot capture
- immutable server / character context after first save
- owner-only persisted `[documentId]` route
- persisted claims entries в `/account/documents` и `/servers/[serverSlug]/documents/claims`

Что не входит:

- full claims editor payload
- generation/output

### 08.4 — Claims editor MVP

Что входит:

- shared claims editor внутри `/claims/[documentId]`
- subtype-specific branching для `rehabilitation` и `lawsuit`
- self / representative flow
- trustor snapshot inside document
- evidence structure

Что не входит:

- `BBCode`
- forum publication automation
- template documents

## Acceptance criteria

### Claims architecture готова

- `Claims` описаны как отдельная family внутри document area
- family slug и future editor routes зафиксированы
- internal machine keys `rehabilitation` и `lawsuit` не ломаются
- claims не смешиваются с `OGP complaints` и template documents
- claims не наследуют OGP publication workflow по умолчанию

### Можно идти в первый code-step

- route contract `claims / new / [documentId]` зафиксирован
- subtype choice `rehabilitation | lawsuit` зафиксирован
- representative/trustor high-level policy зафиксирована
- output policy claims зафиксирована отдельно от OGP

### OGP module и document area не ломаются

- `/account/documents` остаётся агрегатором
- `/servers/[serverSlug]/documents` остаётся общим server-scoped hub
- `OGP complaints` продолжают жить в своей отдельной family
- `Claims` добавляются рядом, а не как ветка OGP family
