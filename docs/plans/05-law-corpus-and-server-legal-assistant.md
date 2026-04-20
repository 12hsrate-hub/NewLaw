# 05 — Law Corpus и Server Legal Assistant Foundation

## Статус блока

`05.1` архитектурный план law corpus утверждён.  
`05.2 corpus schema + internal source management foundation` выполнен.

На текущем шаге добавлен только foundation-слой:

- Prisma-схема для `LawSourceIndex`, `Law`, `LawVersion`, `LawSourcePost`, `LawBlock`, `LawImportRun`
- `server-scoped` источники законодательной базы
- manual override foundation для будущего discovery/import review
- import lock / idempotency foundation
- минимальный `super_admin`-only internal экран `/app/admin-laws`

Что ещё не входит в блок на этом шаге:

- discovery parser
- import темы форума
- normalization / segmentation pipeline
- retrieval service
- legal assistant UI
- документы, `BBCode`, публикация на форум, AI-генерация документов
- судебные прецеденты
- полноценная админка законов

## Зафиксированные правила

- управлять law corpus может только `super_admin`
- всё управление живёт только во внутреннем закрытом контуре
- текст закона на сайте вручную не редактируется
- source of truth: forum topic + imported snapshot
- один закон = одна тема форума
- supplements хранятся отдельным типом и по умолчанию не участвуют в retrieval MVP
- для одного сервера допускается максимум `2` `LawSourceIndex`
- source index URL принимаются только с домена `https://forum.gta5rp.com/`

## Что сделано в 05.2

### Схема данных

Добавлены:

- `LawSourceIndex`
- `Law`
- `LawVersion`
- `LawSourcePost`
- `LawBlock`
- `LawImportRun`

Добавлены enum-слои:

- `LawKind`
- `LawVersionStatus`
- `LawImportRunStatus`
- `LawImportRunMode`
- `LawBlockType`

Зафиксированы ключевые ограничения:

- `Law`: dedupe по `server_id + topic_external_id`
- `Law`: `law_key` уникален внутри сервера
- `LawVersion`: dedupe по `law_id + normalized_text_hash`
- `LawSourcePost`: уникальность по `law_version_id + post_external_id`
- `LawBlock`: уникальность по `law_version_id + block_order`
- `LawImportRun.lockKey` используется как foundation для import/discovery lock

### Manual override foundation

На уровне `Law` добавлены:

- `isExcluded`
- `classificationOverride`
- `internalNote`

Эти поля нужны для ручной корректировки discovery/import workflow на следующих шагах, но полноценный review UI пока не строится.

### Repositories и services

Добавлены foundation-слои для:

- source indexes
- laws
- law versions
- source posts
- logical blocks
- import runs

Также добавлены foundation-services:

- `addLawSourceIndexForServer`
- `setLawSourceIndexEnabledState`
- `registerLawStub`
- `startLawImportRun`
- `finishLawImportRun`
- `createImportedDraftLawVersion`

### Internal super_admin contour

Добавлен минимальный закрытый экран:

- `/app/admin-laws`

На нём `super_admin` может:

- увидеть список `LawSourceIndex` по серверам
- добавить новый index URL
- включить/отключить существующий index URL

На этом шаге экран не умеет:

- запускать discovery
- импортировать тему
- подтверждать версии
- редактировать текст закона

## Следующие подшаги блока

### 05.3 — discovery + import + normalization foundation

Должно войти:

- discovery по 1–2 index URL сервера
- сбор candidate topics
- фильтрация laws / supplements / ignored topics
- import forum topic в raw source layer
- построение непрерывной нормативной цепочки постов
- создание `imported_draft` version

### 05.4 — segmentation + current version workflow + retrieval foundation

Должно войти:

- segmentation в `section/chapter/article/appendix/unstructured`
- article-level working blocks
- ручное подтверждение `current` версии
- supersede прошлой `current`
- retrieval foundation только по `current primary laws` выбранного сервера

## Acceptance для 05.2

- схема law corpus готова и мигрируема
- source management доступен только `super_admin`
- нельзя добавить источник не с `forum.gta5rp.com`
- нельзя добавить больше 2 index URL на сервер
- есть foundation для manual override
- есть foundation для import lock / idempotency
- law text не редактируется вручную через этот слой
