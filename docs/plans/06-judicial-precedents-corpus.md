# 06 — Judicial Precedents Corpus

## Статус блока

`06.1` архитектурный план precedent corpus утверждён.  
`06.2 precedent schema + source topic foundation` выполнен.

На текущем шаге блок уже умеет:

- хранить precedents как отдельный corpus, а не как разновидность `Law`
- хранить `PrecedentSourceTopic` с привязкой к `Server` и `LawSourceIndex`
- хранить отдельные сущности:
  - `Precedent`
  - `PrecedentVersion`
  - `PrecedentSourcePost`
  - `PrecedentBlock`
- хранить отдельные `version status` и `validity status`
- вести manual override foundation для source topics precedents
- показывать foundation-секцию precedents внутри `/app/admin-laws`
- ограничивать управление precedent foundation только `super_admin`

Что ещё не входит в блок на этом шаге:

- precedent discovery parser
- import topic -> precedents
- split одной topic на несколько precedents
- current review workflow
- assistant integration
- embeddings, vector search, reranking
- documents, `BBCode`, forum publishing, AI document generation
- полноценная precedent-админка

## Зафиксированные правила

- судебные прецеденты не смешиваются с `primary laws`
- precedents не хранятся как `law_kind` и не являются разновидностью `supplement`
- precedents не попадают автоматически в уже работающий assistant
- управление precedents corpus доступно только `super_admin`
- source of truth для precedent — forum topic + imported snapshot
- текст precedent вручную на сайте не редактируется
- precedents не смешиваются с document flows, `BBCode` и post-MVP template documents module
- internal workflow precedents живёт как секция внутри `/app/admin-laws`

## Что сделано в 06.2

### Схема данных

Добавлены:

- `PrecedentSourceTopic`
- `Precedent`
- `PrecedentVersion`
- `PrecedentSourcePost`
- `PrecedentBlock`

Добавлены enum-слои:

- `PrecedentSourceTopicDiscoveryStatus`
- `PrecedentSourceTopicClassification`
- `PrecedentVersionStatus`
- `PrecedentValidityStatus`
- `PrecedentBlockType`

### PrecedentSourceTopic

Зафиксированы основные поля:

- `server_id`
- `source_index_id`
- `topic_url`
- `topic_external_id`
- `title`
- `is_excluded`
- `classification_override`
- `internal_note`
- `last_discovered_at`
- `last_discovery_status`
- `last_discovery_error`

Правила:

- dedupe идёт минимум по `server_id + topic_external_id`
- source topic остаётся отдельной foundation-сущностью precedents corpus
- связь с `LawSourceIndex` нужна только как с discovery-источником

### Precedent

Зафиксированы основные поля:

- `server_id`
- `precedent_source_topic_id`
- `precedent_key`
- `display_title`
- `precedent_locator_key`
- `current_version_id`
- `validity_status`

Правила:

- `precedent_key` уникален внутри сервера
- `precedent_locator_key` стабилен внутри source topic
- один `PrecedentSourceTopic` позже сможет породить несколько precedents, но split pipeline в `06.2` ещё не делается

### PrecedentVersion

Зафиксированы основные поля:

- `precedent_id`
- `status`
- `normalized_full_text`
- `source_snapshot_hash`
- `normalized_text_hash`
- `imported_at`
- `confirmed_at`
- `confirmed_by_account_id`

Правила:

- version status отвечает только за lifecycle snapshot
- precedence text не должен редактироваться руками через internal management
- unchanged snapshot позже должен дедуплицироваться по `normalized_text_hash`

### PrecedentSourcePost и PrecedentBlock

Зафиксированы raw/source и block foundation:

- `PrecedentSourcePost` хранит post-level snapshot будущего import
- `PrecedentBlock` хранит logical blocks precedence version

Базовые `block_type`:

- `facts`
- `issue`
- `holding`
- `reasoning`
- `resolution`
- `unstructured`

## Stable identifiers и status model

### Stable identifiers

Зафиксированы:

- `PrecedentSourceTopic`: уникальность минимум по `server_id + topic_external_id`
- `precedent_key`: server-scoped machine key
- `precedent_locator_key`: topic-scoped стабильный locator для precedent внутри темы
- `precedent_version_id`: immutable id версии
- `precedent_block_id`: immutable id блока

### Status model

Version status:

- `imported_draft`
- `current`
- `superseded`

Validity status:

- `applicable`
- `limited`
- `obsolete`

Правило:

- `version status` отвечает за lifecycle snapshot
- `validity_status` отвечает за будущую применимость precedent в assistant
- `obsolete` позже не должен попадать в retrieval assistant по умолчанию

## Repository / service foundation

На этом шаге добавлены foundation-слои для:

- `precedent source topics`
- `precedents`
- `precedent versions`
- `precedent source posts`
- `precedent blocks`

Что принципиально не делается в `06.2`:

- discovery parser
- import pipeline
- split одного topic на несколько precedents
- retrieval changes
- assistant integration

## Internal super_admin contour

В `/app/admin-laws` добавлена минимальная секция precedents foundation.

`super_admin` может:

- видеть precedent source topics
- вручную добавить precedent source topic
- обновить `isExcluded`
- обновить `classificationOverride`
- обновить `internalNote`

При этом пока не добавляются:

- precedent discovery UI
- precedent import UI
- current review UI
- assistant preview по precedents

## Acceptance для 06.2

- precedents schema существует отдельно от law schema
- `PrecedentSourceTopic` дедуплицируется по `server_id + topic_external_id`
- `super_admin` guard на precedent foundation работает
- `non-super-admin` не может управлять precedent foundation
- manual override поля сохраняются корректно
- `validity_status` и `version status` сохраняются корректно
- precedent text не редактируется руками через этот слой
- precedents не смешиваются с `Law`, `LawVersion`, `LawBlock`
- `/app/admin-laws` остаётся единой внутренней точкой law/precedent source foundation без превращения в полноценную админку

## Следующие подшаги блока

### 06.3 — discovery/import/splitting foundation

Входит:

- precedent discovery через существующие `LawSourceIndex`
- precedent topic classification
- raw snapshot import темы
- split одной topic на один или несколько precedents
- multi-post handling
- normalization и precedent blocks
- создание `imported_draft`

Не входит:

- current confirm
- assistant integration

### 06.4 — review/current/validity workflow

Входит:

- internal review controls для precedents
- ручной `imported_draft -> current`
- `superseded` transition
- управление `validity_status`

Не входит:

- retrieval assistant
- public precedent UI

### 06.5 — assistant precedents integration

Входит:

- precedent retrieval provider
- typed retrieval envelope `law + precedent`
- laws-first answer policy
- отдельный precedent-grounded section в assistant response

Не входит:

- embeddings
- feedback/rating
- history/memory
- document generation

## Что точно не нужно делать в MVP этого precedent-блока

- смешивать precedents с `primary laws`
- автоматически подмешивать precedents в текущий assistant до завершения отдельного integration-подшага
- строить полноценную precedent-админку
- делать documents / `BBCode` / forum publishing / AI document generation
- делать embeddings / vector search / reranking как обязательную часть precedent foundation
