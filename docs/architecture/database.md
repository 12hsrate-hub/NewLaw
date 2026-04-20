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
