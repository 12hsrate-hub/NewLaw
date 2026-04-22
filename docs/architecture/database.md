# База данных

## Общий подход

В MVP прикладные данные хранятся в `PostgreSQL` через `Supabase`.
Основная схема и миграции ведутся через `Prisma`.

Identity-источник:

- аутентификация и первичный `user_id` приходят из `Supabase Auth`

Прикладной слой:

- собственные таблицы приложения хранятся в отдельной прикладной схеме
- все ключевые связи опираются на `user_id`, `server_id`, `character_id`

## Базовые таблицы

### profiles

Профиль аккаунта приложения.

Основные поля:

- `id`
- `user_id`
- `display_name`
- `is_super_admin`
- `created_at`
- `updated_at`

### servers

Справочник серверов.

Основные поля:

- `id`
- `code`
- `name`
- `is_active`
- `sort_order`

### user_server_state

Связка аккаунта и сервера.

Основные поля:

- `id`
- `user_id`
- `server_id`
- `active_character_id`
- `created_at`
- `updated_at`

Назначение:

- фиксировать выбранный серверный контекст пользователя
- хранить активного персонажа внутри конкретного сервера

### characters

Основная карточка персонажа.

Основные поля:

- `id`
- `user_id`
- `server_id`
- `full_name`
- `passport_number`
- `nickname`
- `profile_data_json`
- `is_profile_complete`
- `deleted_at`
- `created_at`
- `updated_at`

Правила:

- `nickname` должен совпадать с `full_name`
- уникальность паспорта действует внутри связки `user_id + server_id` среди не удаленных записей
- ограничение максимум `3` персонажа на `user + server` реализуется прикладной логикой

### character_roles

Роли персонажа.

Основные поля:

- `id`
- `character_id`
- `role_key`
- `created_at`

Примечание:

- минимально ожидаемые значения для MVP: `citizen`, `lawyer`
- роли всегда привязываются к `character_id`

### character_access_flags

Флаги доступа персонажа.

Основные поля:

- `id`
- `character_id`
- `flag_key`
- `created_at`

Примечание:

- один персонаж может иметь несколько флагов доступа
- флаги не зависят от ФИО
- зафиксированные значения для MVP: `advocate`, `server_editor`, `server_admin`, `tester`

### trustors

Карточки доверителей.

Основные поля:

- `id`
- `user_id`
- `server_id`
- `full_name`
- `passport_number`
- `phone`
- `notes`
- `profile_data_json`
- `deleted_at`
- `created_at`
- `updated_at`

Правила:

- доверитель привязан к `user + server`
- карточка может быть создана с минимальным набором полей
- soft delete не влияет на исторические документы

### documents

Основная таблица документов.

Основные поля:

- `id`
- `user_id`
- `server_id`
- `character_id`
- `trustor_id`
- `document_type`
- `title`
- `status`
- `publication_status`
- `publication_url`
- `is_site_forum_synced`
- `law_version`
- `template_version`
- `form_schema_version`
- `snapshot_captured_at`
- `author_snapshot_json`
- `trustor_snapshot_json`
- `form_payload_json`
- `last_generated_bbcode`
- `generated_at`
- `generated_law_version`
- `generated_template_version`
- `generated_form_schema_version`
- `is_modified_after_generation`
- `deleted_at`
- `created_at`
- `updated_at`

Ключевые правила:

- документ хранит слепок
- слепок фиксируется при первом сохранении черновика
- `author_snapshot_json` после фиксации не должен автоматически пересобираться из карточки персонажа
- `trustor_snapshot_json` внутри документа живет отдельно от карточки доверителя
- `publication_url` допускается только одна
- `publication_url` должен валидироваться по домену `forum.gta5rp.com`
- `appeal_number` в полезной нагрузке или отдельных полях не проверяется на уникальность
- soft delete обязателен

### forum_session_connections

Account-scoped foundation для будущей OGP forum automation.

Основные поля:

- `id`
- `account_id`
- `provider_key`
- `state`
- `encrypted_session_payload`
- `forum_user_id`
- `forum_username`
- `validated_at`
- `last_validation_error`
- `disabled_at`
- `created_at`
- `updated_at`

Правила:

- connection принадлежит аккаунту, а не документу и не персонажу
- raw session/cookies хранятся только в зашифрованном виде
- `provider_key` в текущем foundation фиксирован как `forum.gta5rp.com`
- одна account-scoped connection на provider
- claims и другие document families не получают доступ к этому publication capability автоматически

Зафиксированные значения `document_type`:

- `ogp_complaint`
- `rehabilitation`
- `lawsuit`

### ai_requests

Журнал AI-запросов.

Основные поля:

- `id`
- `user_id`
- `server_id`
- `character_id`
- `document_id`
- `feature_key`
- `model`
- `request_payload_json`
- `response_payload_json`
- `status`
- `error_message`
- `created_at`

Назначение:

- логирование всех AI-вызовов
- трассировка единственного AI-сценария MVP

### law_source_indexes

Server-scoped index URL для discovery законодательных тем форума.

Основные поля:

- `id`
- `server_id`
- `index_url`
- `is_enabled`
- `last_discovered_at`
- `last_discovery_status`
- `last_discovery_error`
- `created_at`
- `updated_at`

Правила:

- для одного сервера можно хранить максимум `2` index URL
- URL допускается только с домена `forum.gta5rp.com`
- index URL используется только для discovery тем, не как источник готового текста закона

### laws

Трекер закона на уровне одной forum topic.

Основные поля:

- `id`
- `server_id`
- `law_key`
- `title`
- `topic_url`
- `topic_external_id`
- `law_kind`
- `related_primary_law_id`
- `current_version_id`
- `is_excluded`
- `classification_override`
- `internal_note`
- `created_at`
- `updated_at`

Правила:

- один закон соответствует одной теме форума
- dedupe идёт по `server_id + topic_external_id`
- `law_key` уникален внутри сервера
- supplements хранятся отдельным типом и не смешиваются автоматически с основным текстом закона

### law_versions

Immutable snapshot импортированной редакции закона.

Основные поля:

- `id`
- `law_id`
- `status`
- `normalized_full_text`
- `source_snapshot_hash`
- `normalized_text_hash`
- `imported_at`
- `confirmed_at`
- `confirmed_by_account_id`
- `created_at`
- `updated_at`

Правила:

- новая найденная версия сначала сохраняется как `imported_draft`
- только после ручного подтверждения версия становится `current`
- unchanged import не должен плодить лишние версии
- текст версии не редактируется вручную через внутренний UI

### law_source_posts

Raw source layer для версии закона.

Основные поля:

- `id`
- `law_version_id`
- `post_external_id`
- `post_url`
- `post_order`
- `author_name`
- `posted_at`
- `raw_html`
- `raw_text`
- `normalized_text_fragment`
- `created_at`

Назначение:

- хранить, из каких именно forum posts собрана версия закона
- обеспечивать трассируемость import snapshot

### law_blocks

Логические блоки внутри одной версии закона.

Основные поля:

- `id`
- `law_version_id`
- `block_type`
- `block_order`
- `block_title`
- `block_text`
- `parent_block_id`
- `article_number_normalized`
- `created_at`
- `updated_at`

Правила:

- основной рабочий уровень блока — `article`
- допускаются типы `section`, `chapter`, `article`, `appendix`, `unstructured`
- `article_number_normalized` строковый и нужен для будущего retrieval

### law_import_runs

Служебный журнал discovery/import запусков.

Основные поля:

- `id`
- `server_id`
- `source_index_id`
- `mode`
- `status`
- `lock_key`
- `started_at`
- `finished_at`
- `summary`
- `error`
- `created_at`
- `updated_at`

Назначение:

- foundation для import lock
- foundation для идемпотентного discovery/import workflow
- журнал технического результата запуска без полноценного review UI

### precedent_source_topics

Foundation-таблица отдельного corpus судебных прецедентов.

Основные поля:

- `id`
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
- `created_at`
- `updated_at`

Правила:

- precedents не смешиваются с `laws`
- dedupe source topic идёт минимум по `server_id + topic_external_id`
- source topic пока используется только как foundation для будущего precedent discovery/import

### precedents и связанные snapshot-таблицы

После `05.x` и в рамках отдельного следующего блока добавлен foundation для отдельного precedents corpus:

- `precedents`
- `precedent_versions`
- `precedent_source_posts`
- `precedent_blocks`

Важно:

- это отдельная доменная линия, а не расширение `law_kind`
- `version status` и `validity_status` у precedents разделены
- precedents пока не подмешиваются в retrieval уже работающего assistant

## Предлагаемые ограничения и индексы

### Уникальность персонажа по паспорту

Нужен частичный уникальный индекс по:

- `user_id`
- `server_id`
- `passport_number`

С условием:

- `deleted_at IS NULL`

### Активный персонаж

`user_server_state.active_character_id` должен ссылаться на не удаленного персонажа того же пользователя и того же сервера.
Эта проверка в MVP может быть частично прикладной.

### Флаг аккаунтного доступа

Для аккаунтного уровня фиксируется отдельный `user_access_flag`:

- `super_admin`

### Ссылка на форум

Для `documents.publication_url` требуется прикладная валидация:

- домен строго `https://forum.gta5rp.com/`

### Law corpus constraints

Нужны прикладные и индексные ограничения:

- `laws(server_id, topic_external_id)` — уникально
- `laws(server_id, law_key)` — уникально
- `law_versions(law_id, normalized_text_hash)` — уникально
- `law_source_posts(law_version_id, post_external_id)` — уникально
- `law_blocks(law_version_id, block_order)` — уникально
- `law_import_runs.lock_key` — уникально для active run lock foundation

## Что хранится как слепок

Внутри документа в JSON-структурах должны жить:

- данные автора на момент первого сохранения черновика
- данные доверителя на момент фиксации слепка или ручного редактирования в документе
- поля формы
- данные по доказательствам и строкам ссылок

## Что важно не переусложнить

Для MVP не нужно заранее нормализовывать все поля документа в десятки связанных таблиц.
Главное — зафиксировать надежный `documents`-слой со слепком, версиями и генерацией.

Отдельные JSON-поля здесь оправданы, потому что:

- основной сценарий пока один
- схема формы versioned
- доказательства имеют вложенную структуру
- важнее сохранить целостность документа, чем рано дробить форму на множество таблиц

## Отдельная пометка после MVP

После MVP планируется отдельный модуль сервер-специфичных шаблонных документов.

Важно:

- этот модуль не должен смешиваться с текущими MVP-документами и потоком генерации `BBCode`
- он будет использовать уже существующую модель документных слепков
- на этом этапе не фиксируется финальная Prisma-схема для сервер-специфичных шаблонных документов
