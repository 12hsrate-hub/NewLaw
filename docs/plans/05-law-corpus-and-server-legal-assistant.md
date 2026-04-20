# 05 — Law Corpus и Server Legal Assistant Foundation

## Статус блока

`05.1` архитектурный план law corpus утверждён.  
`05.2 corpus schema + internal source management foundation` выполнен.  
`05.3 discovery + import + normalization + segmentation` выполнен.

На текущем шаге блок уже умеет:

- ручной `discovery` по `LawSourceIndex`
- ручной `import` конкретной темы форума
- классификацию topics в `primary`, `supplement`, `ignored`
- raw source layer через `LawSourcePost`
- построение `normalized_full_text`
- вычисление `source_snapshot_hash` и `normalized_text_hash`
- segmentation в `LawBlock`
- создание новой версии только как `imported_draft`

Что ещё не входит в блок на этом шаге:

- ручной review и подтверждение `current` версии
- promote `imported_draft -> current`
- retrieval service
- legal assistant UI
- embeddings, vector store, reranking
- документы, `BBCode`, публикация на форум, AI-генерация документов
- судебные прецеденты
- полноценная админка законов

## Зафиксированные правила

- управлять law corpus может только `super_admin`
- всё управление живёт только во внутреннем закрытом контуре
- текст закона на сайте вручную не редактируется
- source of truth: forum topic + imported snapshot
- один закон = одна тема форума
- текст закона может состоять из нескольких постов внутри темы
- нормативная цепочка всегда начинается сверху темы
- первый пост обязателен
- если следующий пост является прямым продолжением закона, он тоже включается
- как только встречен разрыв нормативной цепочки, import основной версии останавливается
- supplements хранятся отдельным типом и по умолчанию не участвуют в retrieval MVP
- судебные прецеденты сейчас не импортируются
- новая версия закона всегда создаётся как `imported_draft`
- current version автоматически не переключается

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

### Internal foundation

Добавлены:

- `server-scoped` источники законодательной базы
- manual override foundation: `isExcluded`, `classificationOverride`, `internalNote`
- import lock / idempotency foundation
- минимальный `super_admin`-only экран `/app/admin-laws`

## Что сделано в 05.3

### Discovery

Реализовано:

- ручной запуск discovery по `LawSourceIndex`
- обход index URL форума
- сбор candidate topics с минимумом:
  - `topic_url`
  - `topic_external_id`
  - `title`
- дедупликация по topic
- уважение уже сохранённых manual override полей

### Классификация topics

Реализована базовая классификация:

- `primary`
- `supplement`
- `ignored`

Текущие правила:

- `Нормативные акты изменения законодательной базы` и близкие темы идут как `supplement`
- `Судебные прецеденты` не импортируются и считаются `ignored`
- не-нормативные темы законодательной базы отбрасываются как `ignored`

### Import темы

Реализовано:

- ручной import по конкретному `Law`
- загрузка forum topic как ordered set постов
- трактовка закона как одной темы
- сбор непрерывной нормативной цепочки сверху темы
- остановка import при явном разрыве цепочки

### Raw source layer

Реализовано сохранение включённых постов в `LawSourcePost`:

- `post_external_id`
- `post_url`
- `post_order`
- `author_name`
- `posted_at`
- `raw_html`
- `raw_text`
- `normalized_text_fragment`

Это даёт возможность понять, из каких именно постов собрана версия закона.

### Normalization

Реализовано:

- построение единого `normalized_full_text`
- очистка forum artifacts и HTML-разметки
- сохранение нумерации и заголовочной структуры в текстовом виде
- вычисление:
  - `source_snapshot_hash`
  - `normalized_text_hash`
- dedupe: повторный import без изменения текста не создаёт новую версию

### Segmentation

Реализована базовая segmentation в `LawBlock`:

- `section`
- `chapter`
- `article`
- `appendix`
- `unstructured`

Зафиксировано:

- основной рабочий уровень блока — `article`
- если статья не выделяется надёжно, текст сохраняется как `unstructured`
- для `article` сохраняется `article_number_normalized`
- `block_order` сохраняется для стабильного порядка внутри версии

### Internal super_admin flow

В `/app/admin-laws` теперь доступны:

- добавление index URL
- включение и отключение index URL
- ручной запуск `discovery`
- просмотр обнаруженных laws
- ручной запуск `import` по конкретному law

При этом всё ещё не доступны:

- review imported draft версии
- выбор `current`
- retrieval
- legal assistant UI

## Первый реальный сервер и smoke-подход

Зафиксировано:

- первый реальный сервер law corpus: `Blackberry`
- основной source index для него: `https://forum.gta5rp.com/forums/zakonodatelnaja-baza.262/`
- для smoke и тестов используется отдельный smoke-server dataset
- production-данные реального сервера и smoke-сценарии не смешиваются
- production ID серверов не хардкодятся в коде

## Следующий подшаг блока

### 05.4 — current version workflow + retrieval foundation

Должно войти:

- ручное подтверждение `imported_draft` как `current`
- перевод прошлой current-версии в `superseded`
- foundation retrieval только по `current primary laws` выбранного сервера
- server-side foundation для будущего legal assistant

Что не должно входить:

- legal assistant UI
- документы
- `BBCode`
- публикация на форум
- AI-генерация документов
- post-MVP template documents module

## Acceptance для 05.3

- discovery находит candidate topics из `LawSourceIndex`
- один topic трактуется как один law candidate
- topics классифицируются в `primary`, `supplement`, `ignored`
- supplements сохраняются отдельно
- судебные прецеденты не импортируются
- multi-post law может собраться в одну `imported_draft` версию
- import останавливается при разрыве нормативной цепочки
- raw source layer сохраняется консистентно
- `normalized_full_text` и hashes строятся консистентно
- segmentation создаёт `LawBlock` без выдумывания ложной структуры
- повторный import без изменения текста не плодит новые версии
- current version автоматически не переключается
- запуск discovery/import доступен только `super_admin`
