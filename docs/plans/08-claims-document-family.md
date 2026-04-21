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
- immutable subtype after first save
- owner-only persisted `[documentId]` route
- persisted claims entries в `/account/documents` и `/servers/[serverSlug]/documents/claims`
- базовый manual save и autosave foundation без полного claims payload editor

Что не входит:

- full claims editor payload
- generation/output

Текущий результат шага:

- `/servers/[serverSlug]/documents/claims/new` при выбранном subtype уже создаёт persisted draft
- subtype `rehabilitation | lawsuit` фиксируется в `document_type` и не меняется после first save
- `/servers/[serverSlug]/documents/claims/[documentId]` уже грузит owner-only persisted draft с реальным snapshot context
- `/account/documents` и server-scoped family list уже читают persisted claims рядом с OGP

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

Текущий результат шага:

- `/servers/[serverSlug]/documents/claims/[documentId]` работает как реальный owner-only claims editor route, а не только как persistence foundation
- общий persisted claims payload уже включает:
  - `filing_mode`
  - `respondent_name`
  - `claim_subject`
  - `factual_background`
  - `legal_basis_summary`
  - `requested_relief`
  - `working_notes`
  - `trustor_snapshot`
  - `evidence_groups / evidence_rows`
- subtype-specific payload уже работает:
  - `rehabilitation`: `case_reference`, `rehabilitation_basis`, `harm_summary`
  - `lawsuit`: `court_name`, `defendant_name`, `claim_amount`, `pretrial_summary`
- representative branch доступна только при `access_flag = advocate`; без `advocate` filing принудительно остаётся `self`
- trustor snapshot живёт внутри persisted claims document и не требует отдельного trustor module
- claims используют тот же evidence pattern, что и OGP, без отдельной несовместимой модели доказательств
- manual save и autosave foundation уже работают с реальным claims payload
- generation/output и publication/forum automation для claims по-прежнему не включены

### 08.5 — Claims output / rendering policy

Что входит:

- отдельный claims-specific output layer
- deterministic server-side structured preview
- copy-friendly text output
- claims не наследуют OGP `BBCode` и publication model
- claims могут позже использовать общий status `generated`, но publication workflow не активируется автоматически

Что не входит:

- forum automation
- `publication_url`
- OGP `BBCode` reuse

Результат шага:

- claims output target зафиксирован как `structured preview`, а не `BBCode`
- output строится только из persisted `Document + snapshot + payload`
- renderer должен быть общим на уровне family, но с subtype-specific ветками `rehabilitation | lawsuit`
- first output-step не зависит от law corpus, assistant или precedents
- `generated` status допустим для future checkpoint, но published workflow для claims по умолчанию не активируется

### 08.6 — Claims structured renderer foundation

Что входит:

- family-level renderer contract `ClaimsRenderedOutput`
- subtype-specific rendering для `rehabilitation` и `lawsuit`
- deterministic structured preview
- copy-friendly text output из того же output shape
- blocking reasons при неполном profile/payload
- UI preview внутри `/servers/[serverSlug]/documents/claims/[documentId]`

Что не входит:

- generated checkpoint persistence
- publication/forum automation

Текущий результат шага:

- claims получили отдельный server-side renderer service вместо OGP `BBCode`
- renderer строит `structured preview` и `copyText` только из persisted claims document и snapshot data
- preview поддерживает оба subtype:
  - `rehabilitation`
  - `lawsuit`
- common sections включают header, filing mode, claimant/representative, trustor, respondent, claim subject, factual background, legal basis summary, requested relief, evidence и working notes
- subtype-specific sections строятся отдельно для `rehabilitation` и `lawsuit`
- blocking reasons честно возвращаются при неполном profile, неполном common payload, неполном subtype payload и неполном trustor snapshot для representative flow
- evidence может быть пустым и тогда renderer явно показывает, что отдельные evidence links не добавлены
- `/servers/[serverSlug]/documents/claims/[documentId]` уже умеет собирать structured preview и copy-friendly text без перевода документа в `generated`
- claims по-прежнему не притворяются publication/forum workflow и не используют OGP `publication_url`

### 08.7 — Claims generated checkpoint + status integration

Что входит:

- persisted generated artifact для claims structured preview
- `status = generated` без publication workflow
- `generated_at`
- `generated_form_schema_version`
- renderer/output metadata для claims checkpoint
- regenerate behavior
- `modified_after_generation` после последующих правок

Что не входит:

- `publication_url`
- forum sync
- template documents
- precedents-aware claims logic

Текущий результат шага:

- claims preview больше не живёт только как runtime-слой: successful generate action уже фиксирует отдельный persisted structured artifact
- claims не используют OGP-specific поле `last_generated_bbcode`; для них заведён output-neutral generated artifact layer
- persisted claims checkpoint сохраняет:
  - generated artifact
  - copy-friendly generated text
  - output format metadata
  - renderer version metadata
  - `generated_at`
  - `generated_form_schema_version`
- успешный checkpoint переводит claims document из `draft` в `generated`
- повторный generate перезаписывает claims artifact и generation metadata детерминированным output из persisted payload
- последующая правка persisted claims payload не ломает snapshot invariants, но помечает документ как `modified_after_generation`
- `/servers/[serverSlug]/documents/claims/[documentId]` уже показывает generated state, `generated_at`, renderer/output metadata и persisted artifact preview
- `/account/documents` и `/servers/[serverSlug]/documents/claims` продолжают использовать общую status model document area и уже корректно показывают generated claims state
- publication/forum workflow для claims по-прежнему не активируется и не смешивается с OGP `BBCode/publication` model

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
