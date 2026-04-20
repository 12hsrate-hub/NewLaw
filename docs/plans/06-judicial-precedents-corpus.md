# 06 — Judicial Precedents Corpus

## Статус блока

`06.1` архитектурный план precedent corpus утверждён.  
`06.2 precedent schema + source topic foundation` выполнен.  
`06.3 precedent discovery / import / split foundation` выполнен.

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
- запускать отдельный precedent discovery через существующие `LawSourceIndex`
- создавать и обновлять `PrecedentSourceTopic` по `server_id + topic_external_id`
- импортировать forum topic как полный precedent source snapshot
- split-ить один `PrecedentSourceTopic` в один или несколько extracted precedents
- поддерживать multi-post precedents
- строить `normalized_full_text`, `source_snapshot_hash`, `normalized_text_hash`
- сегментировать precedent в `PrecedentBlock`
- создавать новые precedent versions только как `imported_draft`

Что ещё не входит в блок на этом шаге:

- current review workflow
- assistant integration
- embeddings, vector search, reranking
- documents, `BBCode`, forum publishing, AI document generation
- полноценная precedent-админка

## Source of truth для cross-cutting policy

Детальные frozen decisions для precedent-блока собраны в [../architecture/frozen-product-decisions.md](../architecture/frozen-product-decisions.md).

Именно там считаются source of truth:

- precedents как отдельный corpus, а не разновидность law corpus
- laws-first policy для будущего assistant
- server/corpus health assumptions
- operational и migration assumptions вокруг corpus tools

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

## Что сделано в 06.3

### Separate precedent discovery pipeline

Добавлен отдельный precedent discovery pipeline, который:

- использует существующие `LawSourceIndex`
- не является расширением law discovery
- создаёт или обновляет `PrecedentSourceTopic`
- классифицирует темы только в:
  - `precedent_candidate`
  - `ignored`

Ключевые правила:

- темы, уже импортированные как `law` или `supplement`, не становятся precedents автоматически
- manual override через `classificationOverride` и `isExcluded` по-прежнему учитывается
- discovery/status fields обновляются на уровне `PrecedentSourceTopic`, без смешения с `Law`, `LawVersion`, `LawBlock`

### Source topic snapshot import

Добавлен foundation-импорт forum topic как целостного source snapshot:

- topic скачивается как ordered set posts
- используется полный topic snapshot, а не law-правило про непрерывную нормативную цепочку сверху темы
- raw source layer сохраняется на уровне `PrecedentSourcePost` для конкретной version extracted precedent
- source of truth остаётся: forum topic + imported snapshot

### Split одного source topic

Добавлен split pipeline:

- один `PrecedentSourceTopic` может породить один или несколько `Precedent`
- если новый precedent начинается с отдельного post или с явного heading marker внутри snapshot, создаётся отдельный extracted precedent
- если continuation одного precedent уходит в следующий post, этот post включается в тот же extracted precedent
- если split ненадёжен, применяется честный fallback в один precedent на весь topic

Для каждого extracted precedent формируется:

- `precedent_locator_key`
- `display_title`
- `normalized_full_text`
- собственный source snapshot hash и normalized text hash

### Normalization и dedupe

На уровне каждого extracted precedent теперь работают:

- `normalized_full_text`
- `source_snapshot_hash`
- `normalized_text_hash`

Правило dedupe:

- если `normalized_text_hash` совпадает с последней уже известной version этого precedent, новая `PrecedentVersion` не создаётся

### PrecedentBlock foundation

Добавлена базовая segmentation-логика в `PrecedentBlock`:

- `facts`
- `issue`
- `holding`
- `reasoning`
- `resolution`
- `unstructured`

Правило:

- если структура precedent не распознана надёжно, pipeline сохраняет `unstructured`, а не выдумывает ложные `holding/reasoning`

### Version creation

В `06.3` precedents при изменении текста создают только:

- `PrecedentVersion.status = imported_draft`

Что сознательно не делается:

- auto-current
- current review
- editing `validity_status` как часть import decision

### Internal super_admin flow

`/app/admin-laws` теперь умеет минимальный precedent workflow:

- запуск precedent discovery по `LawSourceIndex`
- запуск import конкретного `PrecedentSourceTopic`
- показ последнего статуса discovery/import
- показ extracted precedents для source topic на минимальном уровне

При этом всё ещё не делаются:

- current review controls
- validity editing UI
- assistant preview по precedents

## Acceptance для 06.3

- precedent discovery идёт отдельным pipeline от law discovery
- discovery создаёт/обновляет `PrecedentSourceTopic`
- law/supplement topics не становятся precedents автоматически без override
- один source topic может породить несколько precedents
- multi-post precedent корректно собирается
- fallback в один precedent работает, если split ненадёжен
- raw source layer сохраняется консистентно
- normalized text dedupe не плодит лишние версии
- imported precedents получают `imported_draft`, а не `current`
- `super_admin` guard на precedent discovery/import работает

## Следующие подшаги блока

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
