# 05 — Law Corpus и Server Legal Assistant Foundation

## Статус блока

`05.1` архитектурный план law corpus утверждён.  
`05.2 corpus schema + internal source management foundation` выполнен.  
`05.3 discovery + import + normalization + segmentation` выполнен.
`05.4 current-version workflow + retrieval foundation` выполнен.

На текущем шаге блок уже умеет:

- ручной `discovery` по `LawSourceIndex`
- ручной `import` конкретной темы форума
- классификацию topics в `primary`, `supplement`, `ignored`
- raw source layer через `LawSourcePost`
- построение `normalized_full_text`
- вычисление `source_snapshot_hash` и `normalized_text_hash`
- segmentation в `LawBlock`
- создание новой версии только как `imported_draft`
- ручное подтверждение `imported_draft` версии как `current`
- перевод предыдущей `current` версии в `superseded`
- internal review controls по версиям закона
- server-scoped retrieval foundation только по `current primary laws`
- internal retrieval preview для `super_admin`

Что ещё не входит в блок на этом шаге:

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
- только `super_admin` может подтвердить `imported_draft` как `current`
- retrieval работает только по `current primary laws` выбранного сервера
- `supplement`, `imported_draft` и `superseded` по умолчанию не участвуют в retrieval
- основной retrieval unit — `LawBlock`, прежде всего `article`

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

- legal assistant UI

## Что сделано в 05.4

### Current-version workflow

Реализовано:

- ручное подтверждение `imported_draft -> current` только для `super_admin`
- проверка, что в confirm-flow можно переводить только `imported_draft`
- автоматический перевод предыдущей `current` версии закона в `superseded`
- обновление `Law.currentVersionId`
- фиксация `confirmed_at`
- фиксация `confirmed_by_account_id`

Зафиксировано:

- автоматического promote после import по-прежнему нет
- у одного закона в один момент времени есть только одна `current` версия
- если `imported_draft` не подтверждён вручную, retrieval его не использует

### Internal review flow

В `/app/admin-laws` добавлен минимальный `super_admin`-only review-контур:

- список laws по серверу
- показ `title`, `law_key`, `law_kind`, `topic_url`
- показ наличия `current` версии
- список версий закона
- показ для версии:
  - `status`
  - `imported_at`
  - `confirmed_at`
  - `source posts count`
  - `blocks count`
  - `source_snapshot_hash`
  - `normalized_text_hash`
- минимальный action подтверждения `imported_draft -> current`

При этом не добавлялись:

- diff viewer
- полноценный review dashboard
- большая админка законов

### Retrieval foundation

Реализован server-side retrieval foundation:

- retrieval работает только в контексте выбранного `server_id`
- retrieval использует только:
  - `Law.kind = primary`
  - `LawVersion.status = current`
- `supplement` по умолчанию исключаются
- `imported_draft` и `superseded` исключаются
- основной retrieval unit — `LawBlock`
- сначала используются `article` blocks
- если article-блоков по запросу не найдено, допускается аккуратный fallback на другие block types

На этом шаге retrieval остаётся:

- keyword / lexical
- без embeddings
- без vector store
- без reranking
- без OpenAI-вызовов
- без public assistant UI

### Retrieval result shape

Результат retrieval уже сейчас future-proof для будущего legal assistant и включает:

- `server_id`
- `law_id`
- `law_key`
- `law title`
- `law_version_id`
- `law version status`
- `law_block_id`
- `block_type`
- `block_order`
- `article_number_normalized`
- `snippet`
- `block_text`
- `source topic URL`
- source post references
- grounded metadata

Дополнительно добавлен foundation для снимка корпуса:

- список `current version ids`
- `corpus snapshot hash`
- серверный контекст, в рамках которого был выполнен retrieval

### Internal retrieval preview

Для smoke и ручной внутренней проверки в `/app/admin-laws` добавлен минимальный retrieval preview:

- доступен только `super_admin`
- не является public assistant UI
- не является чатом
- нужен только для проверки того, что retrieval реально работает по `current primary laws` выбранного сервера

## Acceptance для 05.4

- `imported_draft` можно подтвердить как `current` только для `super_admin`
- после confirm предыдущая `current` версия становится `superseded`
- `current` версия не меняется автоматически без ручного confirm
- review controls в `/app/admin-laws` недоступны `non-super-admin`
- retrieval возвращает только `current primary laws` выбранного сервера
- `supplement` по умолчанию не попадают в retrieval
- `imported_draft` и `superseded` не попадают в retrieval
- retrieval сначала работает по article-блокам
- retrieval metadata содержит grounded references
- retrieval preview остаётся внутренним инструментом и не превращается в public assistant

## Первый реальный сервер и smoke-подход

Зафиксировано:

- первый реальный сервер law corpus: `Blackberry`
- основной source index для него: `https://forum.gta5rp.com/forums/zakonodatelnaja-baza.262/`
- для smoke и тестов используется отдельный smoke-server dataset
- production-данные реального сервера и smoke-сценарии не смешиваются
- production ID серверов не хардкодятся в коде

## Следующий подшаг блока

Следующий шаг уже не должен расширять 05.4 в public assistant и OpenAI-контур без отдельного согласования.
Внутри текущего блока следующим логическим уровнем может быть только отдельный шаг над retrieval foundation, а не смешивание law corpus с документами, `BBCode`, forum publishing или post-MVP template documents module.

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
