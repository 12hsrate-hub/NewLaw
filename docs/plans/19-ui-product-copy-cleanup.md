# План 19. UI Product Copy Cleanup

## Статус

`future / planning-only`

## Назначение

Этот план описывает поэтапную очистку ordinary UI проекта `NewLaw / Lawyer5RP` от лишней технической информации.

Задача плана:

- привести пользовательский интерфейс к зрелому продуктовому виду;
- убрать из обычного UI raw IDs, debug/runtime/provider text, schema/version labels и инженерные формулировки;
- сохранить полезные ошибки, review, warning и diagnostic-контур;
- не менять бизнес-логику, Prisma/schema, API contracts, storage model, snapshots и document generation.

Этот план:

- не является задачей на немедленную реализацию;
- не требует изменения кода на текущем шаге;
- не должен автоматически запускать cleanup по всему проекту одним большим коммитом;
- задаёт только безопасный порядок последующей реализации.

## 1. Цель и критерии зрелого UI

`NewLaw / Lawyer5RP` должен выглядеть как готовый юридический продукт, а не как dev/debug-интерфейс.

### Что считается зрелым ordinary UI

Обычный пользователь в любом ключевом сценарии должен понимать:

- что произошло;
- сохранены ли его данные;
- можно ли повторить действие;
- что делать дальше;
- когда нужна ручная проверка;
- когда нужен администратор или повторная попытка позже.

### Что не должно быть видно ordinary user

В обычном UI нельзя показывать как основной слой интерфейса:

- raw IDs;
- `documentId`, `trustorId`, `characterId`, `userId`;
- `serverSlug`;
- `snapshot`;
- `payload`;
- `schema version`;
- `renderer version`;
- `output format`;
- raw enum values;
- `undefined`, `null`, `NaN`;
- raw JSON;
- stack trace;
- digest;
- provider/runtime/debug text;
- инженерные названия слоёв и контрактов;
- технические AI/review/guard статусы.

### Что ordinary user должен видеть вместо этого

- понятный статус;
- простое описание проблемы;
- короткое пояснение, что это значит;
- безопасную next-step подсказку;
- review-предупреждение в юридическом, а не техническом формате.

## 2. Основной принцип распределения информации по аудиториям

### Ordinary user

Обычный пользователь видит:

- понятный статус;
- объяснение, что произошло;
- сохранены ли данные;
- что сделать дальше;
- можно ли повторить действие;
- когда нужен администратор.

### Admin / support

Admin или support видит:

- понятное описание проблемы;
- зону продукта;
- уровень важности;
- влияние на пользователя;
- рекомендуемое действие;
- technical details в отдельном раскрываемом блоке.

### Internal / logs / server

Внутренние инструменты и логи могут содержать:

- raw error;
- stack trace;
- IDs;
- provider/runtime/debug details;
- schema/version identifiers;
- полную диагностику request/response.

## 3. Порядок выполнения

Реализация этого плана в будущем должна идти только по следующему правилу:

- выполняется только **один этап за раз**;
- после завершения этапа работа останавливается;
- переход к следующему этапу возможен только по отдельной команде владельца проекта;
- после каждого этапа обязательно показывается, где смотреть изменения локально;
- спорные формулировки выносятся в отдельный список для ручной правки владельцем проекта;
- shared mappers и dictionaries добавляются только тогда, когда уже виден реальный повтор строк, а не заранее “на всякий случай”.

### Обязательный стандарт отчёта после каждого этапа

После каждого этапа исполнитель в будущем должен показать:

- что изменено;
- какие файлы изменены;
- какие технические строки убраны;
- какие новые пользовательские формулировки добавлены;
- какие страницы открыть локально;
- какие тексты владелец проекта должен проверить вручную;
- что не менялось;
- какие тесты были запущены.

## 4. Карта зон проекта

### 4.1 Public pages

Что проверить:

- публичные страницы;
- auth entry pages;
- landing / overview copy.

Какая техническая информация может утекать:

- route/internal naming;
- engineering wording;
- debug-like empty states.

Что оставить пользователю:

- понятное описание сервиса;
- доступные действия;
- переходы к основным зонам.

Что заменить:

- технические названия модулей;
- debug-style copy.

Что перенести:

- operational/infrastructure пояснения — в docs/internal, не в ordinary UI.

Предположительно смотреть:

- `src/app/sign-in`
- `src/components/product/home`
- `src/components/product/auth`

### 4.2 `/account`

Что проверить:

- общий overview;
- быстрые переходы;
- карточки документов/серверов.

Какая техническая информация может утекать:

- compatibility/foundation wording;
- server-code badges без пользы пользователю.

Что оставить пользователю:

- доступные разделы;
- состояние аккаунта;
- понятные переходы.

Что заменить:

- инженерные описания layered architecture;
- internal naming account/document surfaces.

Что перенести:

- compatibility/runtime notes — в internal docs или support details.

Предположительно смотреть:

- `src/components/product/document-area/document-area-foundation.tsx`
- `src/components/product/shell/*`

### 4.3 `/account/security`

Что проверить:

- формы смены пароля/почты;
- forum integration;
- access/security banners.

Какая техническая информация может утекать:

- raw codes в error messages;
- technical forum validation errors.

Что оставить пользователю:

- что не удалось;
- нужно ли повторить;
- что сделать дальше.

Что заменить:

- `Код: ...`;
- внутренние operational terms.

Что перенести:

- raw security/forum diagnostics — в admin/internal или logs.

Предположительно смотреть:

- `src/components/product/security/*`
- `src/server/actions/account-security.ts`
- `src/server/actions/forum-integration.ts`

### 4.4 `/account/characters`

Что проверить:

- создание/редактирование персонажа;
- подпись;
- адвокатский доступ;
- group status banners.

Какая техническая информация может утекать:

- raw access flags;
- internal request codes;
- `Код: ...`.

Что оставить пользователю:

- роли;
- доступ;
- нужно ли подать заявку;
- подпись загружена или нет.

Что заменить:

- internal request status wording;
- технические error labels.

Что перенести:

- internal request identifiers и raw diagnostics — в admin/internal.

Предположительно смотреть:

- `src/components/product/characters/*`

### 4.5 `/account/trustors`

Что проверить:

- карточки доверителей;
- создание/удаление;
- empty state;
- адвокатские запросы по доверителю.

Какая техническая информация может утекать:

- raw status codes;
- server code where not needed;
- hidden domain naming leaking into visible helper text.

Что оставить пользователю:

- список доверителей;
- readiness для представительских документов;
- действия по созданию/редактированию.

Что заменить:

- `Код: ...`;
- route/domain technical wording.

Что перенести:

- internal delete/update diagnostics — в logs/admin, не в ordinary UI.

Предположительно смотреть:

- `src/components/product/trustors/*`

### 4.6 `/account/documents`

Что проверить:

- overview cards;
- server grouping;
- empty states;
- transitions into server document area.

Какая техническая информация может утекать:

- foundation wording;
- technical explanation of server/document relation.

Что оставить пользователю:

- какие документы доступны;
- где открыть нужный раздел;
- что нужно для начала работы.

Что заменить:

- internal/foundation copy.

Что перенести:

- architecture/ownership explanations — в docs/internal.

Предположительно смотреть:

- `src/components/product/document-area/document-area-foundation.tsx`

### 4.7 `/assistant`

Что проверить:

- intro copy;
- server selection copy;
- unavailable/error copy.

Какая техническая информация может утекать:

- module/internal wording;
- selected server technical details.

Что оставить пользователю:

- как выбрать сервер;
- куда задать вопрос;
- что значит ограниченный режим.

Что заменить:

- internal assistant runtime wording.

Что перенести:

- technical retrieval/runtime details — в internal/support only.

Предположительно смотреть:

- `src/components/product/legal-assistant/*`
- `src/app/assistant/*`

### 4.8 `/assistant/[serverSlug]`

Что проверить:

- selected server page;
- assistant answer card;
- warnings and source blocks.

Какая техническая информация может утекать:

- `serverSlug`;
- `corpus snapshot`;
- retrieval metadata;
- internal AI wording.

Что оставить пользователю:

- вопрос;
- ответ;
- использованные правовые источники;
- мягкие review notes.

Что заменить:

- `Assistant ready/limited`;
- snapshot/debug labels;
- AI runtime labels.

Что перенести:

- snapshot hashes;
- retrieval diagnostics;
- model/provider details.

Предположительно смотреть:

- `src/app/assistant/[serverSlug]/page.tsx`
- `src/components/product/legal-assistant/assistant-answer-card.tsx`

### 4.9 `/servers`

Что проверить:

- directory cards;
- availability labels;
- module descriptions.

Какая техническая информация может утекать:

- `Documents`, `Assistant`, `Server Module` in half-technical wording;
- maintenance/internal language.

Что оставить пользователю:

- сервер;
- доступность разделов;
- следующий шаг.

Что заменить:

- technical availability copy;
- raw server-system labels.

Что перенести:

- operational infrastructure notes — в internal/admin.

Предположительно смотреть:

- `src/components/product/server-directory/public-server-directory.tsx`
- `src/components/product/server-directory/status-ui.ts`

### 4.10 `/servers/[serverSlug]`

Что проверить:

- server hub;
- assistant/documents cards;
- unavailable states.

Какая техническая информация может утекать:

- `serverSlug`;
- `auth-gated`, `source of truth`, `user-facing module`, `UX-default`.

Что оставить пользователю:

- название сервера;
- доступность помощника и документов;
- нужен ли персонаж.

Что заменить:

- engineering architecture wording.

Что перенести:

- source-of-truth explanations — в docs/internal.

Предположительно смотреть:

- `src/components/product/server-directory/server-hub.tsx`

### 4.11 `/servers/[serverSlug]/documents`

Что проверить:

- document hub;
- family intro cards;
- create/edit entry descriptions.

Какая техническая информация может утекать:

- foundation wording;
- route contract language;
- `documentId` mentions.

Что оставить пользователю:

- какой тип документа доступен;
- как создать черновик;
- куда вернуться.

Что заменить:

- `owner-only route`, `persisted context`, `future route`.

Что перенести:

- implementation notes — в docs/internal.

Предположительно смотреть:

- `src/components/product/document-area/document-area-foundation.tsx`
- `src/components/product/document-area/document-persistence.tsx`

### 4.12 Document area

Что проверить:

- shared document cards;
- persistence and state blocks;
- invalid/unavailable states;
- editor helper texts.

Какая техническая информация может утекать:

- `documentId`;
- `snapshot`;
- `schema version`;
- `renderer version`;
- `output format`;
- foundation/debug text.

Что оставить пользователю:

- статус документа;
- сохранён ли черновик;
- собран ли документ;
- что делать дальше.

Что заменить:

- raw metadata display;
- engineering headings and hints.

Что перенести:

- technical document metadata — в admin/support or collapsed details.

Предположительно смотреть:

- весь `src/components/product/document-area/*`

### 4.13 OGP complaint editor

Что проверить:

- generation info;
- forum publication block;
- AI helper panels;
- narrative improvement panel;
- invalid/unavailable states.

Какая техническая информация может утекать:

- `generatedLawVersion`;
- `generatedTemplateVersion`;
- `generatedFormSchemaVersion`;
- `BBCode` как основной продуктовый термин;
- forum IDs;
- raw error codes.

Что оставить пользователю:

- черновик;
- текст для форума;
- публикация;
- review/warning;
- важные данные жалобы.

Что заменить:

- `Готовый BBCode`-heavy copy;
- raw version fields;
- forum technical statuses.

Что перенести:

- forum IDs;
- generation version details;
- sync diagnostics.

Предположительно смотреть:

- `src/components/product/document-area/document-draft-editor-client.tsx`
- `src/components/product/document-area/document-draft-editor-shared.ts`
- `src/components/product/document-area/document-persistence-states.tsx`

### 4.14 Claims flow

Что проверить:

- family page;
- create page;
- persisted editor;
- preview panels;
- helper texts.

Какая техническая информация может утекать:

- `Claims Family`;
- `claim`;
- `structured preview`;
- `generated checkpoint`;
- `persisted context`;
- raw status text.

Что оставить пользователю:

- тип документа;
- состояние черновика;
- предпросмотр;
- доступные действия.

Что заменить:

- foundation/debug language.

Что перенести:

- route contract and preview implementation details.

Предположительно смотреть:

- `src/components/product/document-area/document-claims-editor-client.tsx`
- `src/components/product/document-area/document-claims-editor-form.tsx`
- `src/components/product/document-area/document-claims-editor-panels.tsx`
- claims sections in `document-persistence.tsx`

### 4.15 Attorney request flow

Что проверить:

- create page;
- persisted editor;
- generation result block.

Какая техническая информация может утекать:

- `generatedOutputFormat`;
- `generatedRendererVersion`;
- technical generation statuses;
- raw error codes.

Что оставить пользователю:

- номер запроса;
- адресат;
- результат генерации;
- файлы для скачивания.

Что заменить:

- renderer/output metadata;
- overly technical generation copy.

Что перенести:

- technical output details — в admin/support only.

Предположительно смотреть:

- `src/components/product/document-area/document-attorney-request-editor-client.tsx`
- attorney request blocks in `document-persistence.tsx`

### 4.16 Legal services agreement flow

Что проверить:

- family page;
- persisted editor;
- generation block.

Какая техническая информация может утекать:

- rigid-template/frozen snapshot wording;
- renderer/schema/output metadata;
- debug-like implementation notes.

Что оставить пользователю:

- стороны договора;
- номер договора;
- статус сборки;
- скачивание результата.

Что заменить:

- technical template/rendering wording.

Что перенести:

- rendering implementation notes — в internal/admin.

Предположительно смотреть:

- `src/components/product/document-area/document-legal-services-agreement-editor-client.tsx`
- agreement blocks in `document-persistence.tsx`

### 4.17 AI helper / review panels

Что проверить:

- grounded rewrite;
- field rewrite;
- complaint narrative preview;
- assistant warnings.

Какая техническая информация может утекать:

- risk flag raw names;
- guard/runtime semantics;
- provider/debug-style explanations.

Что оставить пользователю:

- можно ли использовать текст;
- что уточнить;
- что проверить;
- какие риски остались.

Что заменить:

- model/debug language.

Что перенести:

- raw AI metadata and request diagnostics — в internal/admin/logs.

Предположительно смотреть:

- `src/components/product/document-area/document-field-rewrite-panel.tsx`
- `src/components/product/document-area/complaint-narrative-improvement-panel.tsx`
- `src/components/product/legal-assistant/assistant-answer-card.tsx`

### 4.18 Publication / forum sync

Что проверить:

- publication forms;
- sync labels;
- connection states;
- forum error copy.

Какая техническая информация может утекать:

- thread/post IDs;
- sync-state internals;
- validation error internals.

Что оставить пользователю:

- опубликовано или нет;
- можно ли обновить;
- подключён ли форум.

Что заменить:

- raw sync states;
- provider-like validation copy.

Что перенести:

- forum IDs and raw validation details — в support/admin.

Предположительно смотреть:

- publication block in `document-draft-editor-client.tsx`
- `src/components/product/security/forum-integration-section.tsx`

### 4.19 Admin UI

Что проверить:

- admin/security surfaces;
- mixed operational panels.

Какая техническая информация может утекать:

- raw dumps without interpretation;
- codes without severity/impact framing.

Что оставить пользователю admin/support:

- проблема;
- уровень;
- зона;
- impact;
- recommended action.

Что заменить:

- dump-like screens without summary.

Что перенести:

- deep technical diagnostics — в collapsed details.

Предположительно смотреть:

- `src/components/product/admin-security/*`

### 4.20 Internal UI

Что проверить:

- AI review/internal health/core sections;
- mixed screens that may become support surfaces.

Какая техническая информация может утекать:

- raw internal wording into mixed routes.

Что оставить:

- technical diagnostics are allowed.

Что заменить:

- dump-like primary presentation, if any.

Что перенести:

- nothing from internal/logs unless it leaks into user-facing copy.

Предположительно смотреть:

- `src/components/product/internal/*`

### 4.21 Route-level loading / error / not-found / unavailable states

Что проверить:

- route-level boundary screens;
- custom unavailable states;
- invalid-document states.

Какая техническая информация может утекать:

- `Application error`;
- route/debug text;
- raw IDs;
- framework-like fallback copy.

Что оставить пользователю:

- что произошло;
- куда вернуться;
- сохранены ли данные;
- можно ли повторить действие.

Что заменить:

- framework-style errors and raw identifiers.

Что перенести:

- raw error object/digest/debug details — в logs and admin/internal details.

Предположительно смотреть:

- `src/app/**/loading.tsx`
- `src/app/**/error.tsx`
- `src/app/**/not-found.tsx`
- `src/components/product/document-area/document-persistence-states.tsx`

## 5. Общий стандарт UI-copy

### 5.1 Статусы документов

- `draft` → `Черновик`
- `generated` → `Документ собран`
- `published` → `Опубликован`
- `dirty` → `Есть несохранённые изменения`
- `stale` / `outdated` → `Требуется обновление`
- `review_required` → `Требуется проверка`
- `failed` → `Не удалось выполнить действие`

### 5.2 Статусы генерации

- `Готов к сборке`
- `Нужно заполнить обязательные поля`
- `Документ уже собран`
- `Документ изменён после последней сборки`
- `Чтобы получить актуальный результат, пересоберите документ`

### 5.3 Статусы публикации

- `Ещё не опубликовано`
- `Публикация актуальна`
- `Требуется обновить публикацию`
- `Не удалось обновить публикацию`
- `Подключение форума требует проверки`

### 5.4 Ошибки сохранения

- `Не удалось сохранить изменения. Проверьте заполненные поля и повторите попытку.`
- `Черновик не удалось сохранить. Данные в форме остались, можно исправить поля и попробовать снова.`

### 5.5 Ошибки загрузки

- `Не удалось загрузить данные. Обновите страницу или попробуйте позже.`
- `Часть данных временно недоступна. Попробуйте обновить страницу.`

### 5.6 Ошибки генерации

- `Не удалось сгенерировать документ. Черновик сохранён, можно попробовать ещё раз.`
- `Не удалось подготовить текст. Проверьте обязательные поля и повторите действие.`

### 5.7 Validation messages

- `Укажите объект заявления.`
- `Заполните дату и время.`
- `Для подачи через представителя укажите доверителя.`
- `Добавьте обязательные сведения и повторите действие.`

### 5.8 Empty states

- `Пока нет документов`
- `Здесь появятся ваши черновики и готовые документы`
- `Пока нет доверителей`
- `Пока нет персонажей`
- `Правовые основания пока не выбраны`

### 5.9 Unavailable states

- `Раздел временно недоступен`
- `Документ недоступен`
- `Не удалось открыть документ`
- `Ваши данные не удалены. Попробуйте вернуться позже или откройте список документов.`

### 5.10 AI review statuses

- `Текст требует проверки`
- `Не хватает точной правовой опоры для части выводов`
- `Есть замечания, которые лучше проверить перед подачей`
- `Текст можно использовать как основу`

### 5.11 Admin diagnostic statuses

- `Низкий`
- `Средний`
- `Высокий`
- `Критический`
- `Требуется внимание`
- `Влияет на ordinary UI`
- `Требует ручной проверки`

## 6. Стандарт ошибок

Каждый ordinary user-facing error state должен быть собран по одной модели:

- заголовок;
- понятное описание;
- что делать дальше;
- сохранены ли данные;
- можно ли повторить действие;
- когда нужен администратор.

### Guardrail против слишком общих ошибок

Нельзя заменять полезные ошибки на пустое:

- `Ошибка. Попробуйте позже.`

Каждая ошибка должна объяснять:

- что не получилось;
- сохранены ли данные;
- можно ли повторить действие;
- что сделать дальше;
- когда нужен администратор.

### Что запрещено показывать ordinary user

- raw JSON;
- stack trace;
- digest;
- raw `Prisma`, `Zod`, `OpenAI`, provider/runtime errors;
- `Код: INTERNAL_...`;
- `documentId`;
- `schema mismatch`;
- `provider failed`;
- `undefined`, `null`, `NaN`.

### Что допустимо для admin/support

- internal code;
- raw message;
- request/run identifier;
- service/provider/runtime diagnostics;
- affected IDs;
- stack trace reference.

Но только внутри structured diagnostic card, а не как raw dump.

## 7. Стандарт AI review / warning

AI review / warning — это не error state.

Он должен выглядеть как юридическая проверка:

- можно ли использовать текст;
- что уже хорошо;
- что нужно уточнить;
- какой риск;
- что добавить перед подачей.

### Что должен видеть ordinary user

- `Текст можно использовать как основу`
- `Перед использованием лучше проверить замечания ниже`
- `Не хватает точных оснований для части формулировок`
- `Есть риск слишком категоричного вывода`
- `Нужно уточнить отдельные обстоятельства`

### Guardrail для AI review

Запрещено показывать ordinary user:

- `guard_warn`
- `fallback_used`
- `insufficient_legal_basis`
- `corpus snapshot`
- `provider error`
- `runtime fallback`
- `model guard`

### Что допустимо внутри admin/internal

- raw risk flag keys;
- layer/source metadata;
- provider/runtime notes;
- request diagnostics;
- internal review payload.

## 8. Стандарт admin UI

Admin UI может содержать технические детали, но не должен быть raw dump.

### Обязательная структура admin diagnostic card

- `Проблема`
- `Уровень`
- `Зона`
- `Влияние`
- `Рекомендуемое действие`
- `Технические детали` — collapsed по умолчанию

### Guardrail для admin UI

Даже в админке техническая информация должна сначала интерпретироваться.

Показывать сначала:

- что сломалось;
- насколько это важно;
- кого затрагивает;
- что сделать.

Только потом раскрывать:

- IDs;
- raw errors;
- provider/runtime diagnostics;
- stack-like technical details.

## 9. Этапы реализации

### Этап 1. Document area / persisted editors

Включает:

- OGP complaint editor;
- document persistence states;
- claims;
- attorney request;
- legal services agreement.

Фокус:

- `BBCode`-heavy copy;
- raw version fields;
- forum publication block;
- unavailable/invalid states;
- foundation/debug language.

### Куда смотреть после этапа

- **Файлы/папки:**
  - `src/components/product/document-area/document-draft-editor-client.tsx`
  - `src/components/product/document-area/document-persistence.tsx`
  - `src/components/product/document-area/document-persistence-states.tsx`
  - `src/components/product/document-area/document-claims-editor-client.tsx`
  - `src/components/product/document-area/document-claims-editor-form.tsx`
  - `src/components/product/document-area/document-claims-editor-panels.tsx`
  - `src/components/product/document-area/document-attorney-request-editor-client.tsx`
  - `src/components/product/document-area/document-legal-services-agreement-editor-client.tsx`
- **Страницы/маршруты:**
  - `/servers/[serverSlug]/documents/ogp-complaints/[documentId]`
  - `/servers/[serverSlug]/documents/claims/[documentId]`
  - `/servers/[serverSlug]/documents/attorney-requests/[documentId]`
  - `/servers/[serverSlug]/documents/legal-services-agreements/[documentId]`
- **Что проверить глазами:**
  - generation info
  - publication/forum block
  - unavailable and invalid document states
  - create/edit helper texts
  - preview headings
- **Тексты, которые могут потребовать ручной правки:**
  - `Готовый BBCode`
  - `Копировать BBCode`
  - `Версия правовой базы`
  - `Generated form schema version`
  - `Renderer version`
  - `Claims Family`
  - `persisted context`
  - `generated checkpoint`

### Expected output после этапа

- что изменено;
- какие файлы изменены;
- какие технические строки убраны;
- какие новые пользовательские формулировки добавлены;
- какие страницы открыть;
- какие тексты проверить владельцу;
- что не менялось;
- какие тесты запущены.

### Этап 2. AI review panels

Включает:

- grounded rewrite;
- complaint narrative improvement;
- document field rewrite;
- assistant answer warnings.

Фокус:

- привести review к формату юридической проверки;
- убрать model/debug/runtime semantics.

### Куда смотреть после этапа

- **Файлы/папки:**
  - `src/components/product/document-area/document-field-rewrite-panel.tsx`
  - `src/components/product/document-area/complaint-narrative-improvement-panel.tsx`
  - `src/components/product/legal-assistant/assistant-answer-card.tsx`
- **Страницы/маршруты:**
  - OGP complaint editor
  - `/assistant/[serverSlug]`
- **Что проверить глазами:**
  - warning copy
  - risk labels
  - review sections
  - legal basis block
- **Тексты, которые могут потребовать ручной правки:**
  - `Ответ построен по corpus`
  - `corpus snapshot`
  - overly careful legal warnings
  - too harsh review wording

### Expected output после этапа

- что изменено;
- какие файлы изменены;
- какие технические строки убраны;
- какие новые пользовательские формулировки добавлены;
- какие страницы открыть;
- какие тексты проверить владельцу;
- что не менялось;
- какие тесты запущены.

### Этап 3. Assistant / server pages

Включает:

- `/assistant`
- `/assistant/[serverSlug]`
- `/servers`
- `/servers/[serverSlug]`
- `server directory/status UI`

Фокус:

- убрать `serverSlug`, `corpus`, `Assistant limited`, `auth-gated`, `source of truth`, `Server Hub`, `Server Module`.

### Куда смотреть после этапа

- **Файлы/папки:**
  - `src/components/product/server-directory/server-hub.tsx`
  - `src/components/product/server-directory/status-ui.ts`
  - `src/components/product/legal-assistant/*`
  - `src/app/assistant/*`
- **Страницы/маршруты:**
  - `/servers`
  - `/servers/[serverSlug]`
  - `/assistant`
  - `/assistant/[serverSlug]`
- **Что проверить глазами:**
  - page titles
  - availability labels
  - assistant intro copy
  - unavailable states
- **Тексты, которые могут потребовать ручной правки:**
  - `Server Hub`
  - `Server Module`
  - `Assistant limited`
  - `Documents`
  - `UX-default`
  - `source of truth`

### Expected output после этапа

- что изменено;
- какие файлы изменены;
- какие технические строки убраны;
- какие новые пользовательские формулировки добавлены;
- какие страницы открыть;
- какие тексты проверить владельцу;
- что не менялось;
- какие тесты запущены.

### Этап 4. Account pages

Включает:

- characters;
- trustors;
- documents;
- security;
- forum integration messages.

Фокус:

- убрать `Код: ...`;
- выровнять success/error/empty states;
- не показывать technical access/request wording ordinary user.

### Куда смотреть после этапа

- **Файлы/папки:**
  - `src/components/product/characters/*`
  - `src/components/product/trustors/*`
  - `src/components/product/security/*`
  - `src/components/product/document-area/document-area-foundation.tsx`
- **Страницы/маршруты:**
  - `/account/characters`
  - `/account/trustors`
  - `/account/security`
  - `/account/documents`
- **Что проверить глазами:**
  - status banners
  - create/update/delete feedback
  - empty states
  - forum integration feedback
- **Тексты, которые могут потребовать ручной правки:**
  - все строки с `Код: ...`
  - access request wording
  - forum connection wording
  - default server/character helper texts

### Expected output после этапа

- что изменено;
- какие файлы изменены;
- какие технические строки убраны;
- какие новые пользовательские формулировки добавлены;
- какие страницы открыть;
- какие тексты проверить владельцу;
- что не менялось;
- какие тесты запущены.

### Этап 5. Admin/internal mixed surfaces

Включает:

- admin dashboards;
- security/admin diagnostics;
- support-like panels;
- internal health/review surfaces.

Фокус:

- отделить ordinary summary от technical details;
- убрать raw dump как primary UI.

### Куда смотреть после этапа

- **Файлы/папки:**
  - `src/components/product/admin-security/*`
  - `src/components/product/internal/*`
- **Страницы/маршруты:**
  - `/internal/...`
  - mixed admin/security routes
- **Что проверить глазами:**
  - diagnostic cards
  - presence of collapsed technical details
  - severity/impact/action framing
- **Тексты, которые могут потребовать ручной правки:**
  - admin summary wording
  - severity labels
  - support action recommendations

### Expected output после этапа

- что изменено;
- какие файлы изменены;
- какие технические строки убраны;
- какие новые пользовательские формулировки добавлены;
- какие страницы открыть;
- какие тексты проверить владельцу;
- что не менялось;
- какие тесты запущены.

### Этап 6. Route-level error/loading/not-found/unavailable states

Включает:

- `loading.tsx`
- `error.tsx`
- `not-found.tsx`
- unavailable/invalid states

Фокус:

- убрать framework/debug style;
- сделать route states product-like и actionable.

### Куда смотреть после этапа

- **Файлы/папки:**
  - `src/app/**/loading.tsx`
  - `src/app/**/error.tsx`
  - `src/app/**/not-found.tsx`
  - `src/components/product/document-area/document-persistence-states.tsx`
- **Страницы/маршруты:**
  - missing document routes
  - unavailable document routes
  - route-level error boundaries
- **Что проверить глазами:**
  - empty/unavailable/error copy
  - return links
  - whether raw identifiers or technical phrases still leak
- **Тексты, которые могут потребовать ручной правки:**
  - `Документ недоступен`
  - `Не удалось открыть документ`
  - `Раздел временно недоступен`
  - any route fallback copy that still feels too technical

### Expected output после этапа

- что изменено;
- какие файлы изменены;
- какие технические строки убраны;
- какие новые пользовательские формулировки добавлены;
- какие страницы открыть;
- какие тексты проверить владельцу;
- что не менялось;
- какие тесты запущены.

### Этап 7. Consolidation / tests

Включает:

- shared mappers;
- dictionaries;
- повторяющиеся status/error/review labels;
- test alignment.

Фокус:

- убрать дублирование;
- зафиксировать единый copy standard в коде;
- обновить tests на новые формулировки и отсутствие технических строк.

### Куда смотреть после этапа

- **Файлы/папки:**
  - shared helpers in user-facing UI zones
  - tests of changed components and routes
- **Страницы/маршруты:**
  - повторно пройти все ключевые user flows
- **Что проверить глазами:**
  - consistency of labels
  - consistency of error style
  - consistency of AI review copy
- **Тексты, которые могут потребовать ручной правки:**
  - повторяющиеся empty states
  - repeated error strings
  - labels that are semantically correct but stylistically weak

### Expected output после этапа

- что изменено;
- какие файлы изменены;
- какие технические строки убраны;
- какие новые пользовательские формулировки добавлены;
- какие страницы открыть;
- какие тексты проверить владельцу;
- что не менялось;
- какие тесты запущены.

## 10. Тексты для ручной проверки владельцем

После каждого этапа исполнитель должен отдельно выписывать спорные формулировки по такому шаблону:

- **Файл:**
- **Компонент:**
- **Где видно в UI:**
- **Текущая формулировка:**
- **Почему стоит проверить:**
- **Как безопасно изменить:**

### Когда выносить текст в этот список

Если формулировка:

- юридически корректна, но звучит тяжело;
- слишком сухая или слишком техническая;
- может требовать редакторского вкуса владельца проекта;
- зависит от продуктового tone-of-voice;
- вызывает сомнение, не потеряется ли смысл после упрощения.

## 11. Definition of Done

Cleanup можно считать завершённым только если одновременно выполнены все условия:

- ordinary user-facing UI не показывает raw IDs, schema/version/debug/provider/runtime text;
- ошибки остаются полезными и actionable;
- document editor выглядит как готовый продукт, а не как persisted/foundation/debug editor;
- AI review выглядит как юридическая проверка, а не как debug модели;
- admin UI содержит технические детали только структурировано;
- техническая диагностика не потеряна: она осталась в logs, internal/admin или collapsed details;
- `Prisma schema`, `API contracts`, `server actions`, `snapshots`, `document generation` и `BBCode generation` не изменены;
- тесты обновлены на наличие новых пользовательских формулировок и отсутствие технических строк.

## 12. Тест-план

После каждого реализуемого этапа в будущем запускать:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm prisma:validate`
- `pnpm prisma:generate`
- релевантные `vitest` по изменённым компонентам и маршрутам

### Что должны подтверждать тесты

- technical strings не видны ordinary user;
- ошибки остаются полезными;
- admin technical details доступны только там, где нужно;
- review-блоки выглядят как юридическая проверка;
- `BBCode` в основных user-facing заголовках заменён на `текст для форума`;
- raw IDs/status/schema/debug values не отображаются в ordinary UI.

## 13. Порядок согласования

- После создания этого плана реализация не начинается автоматически.
- Сначала владелец проекта вручную читает и при необходимости правит:
  - словарь пользовательских статусов;
  - стандарт ошибок;
  - стандарт AI review / warning;
  - спорные формулировки в document area;
  - спорные формулировки в assistant / server pages;
  - wording admin diagnostic cards.
- Только после отдельной команды начинается `Этап 1`.
- После каждого этапа работа снова останавливается до следующего подтверждения.

## 14. Первый этап к реализации

Первым этапом к реализации должен идти:

- `Этап 1. Document area / persisted editors`

В нём в первую очередь нужно проверить:

- OGP complaint editor;
- generation info;
- forum publication block;
- unavailable/invalid document states;
- claims flow;
- attorney request flow;
- legal services agreement flow;
- document persistence states;
- `BBCode`-heavy copy;
- raw version fields;
- foundation/debug language.

### Что должен показать исполнитель после завершения первого этапа

- список изменённых document-area зон;
- какие технические строки исчезли;
- какие пользовательские формулировки появились;
- какие страницы открыть локально;
- какие спорные тексты нужно посмотреть владельцу проекта;
- что точно не менялось:
  - `Prisma/schema`
  - API contracts
  - server actions logic
  - snapshots
  - document generation
  - `BBCode generation`
