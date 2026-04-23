# Lawyer5RP MVP

## Что это

`Lawyer5RP MVP` — единое full-stack веб-приложение для подготовки документных сценариев внутри экосистемы GTA5RP.
Главный сценарий MVP — создание жалобы в ОГП с итоговой генерацией форумного BBCode.

На текущем этапе репозиторий содержит стартовую документацию проекта, bootstrap-каркас приложения, foundation для `Supabase Auth` и минимального data layer, account-security foundation, transitional protected shell foundation для `/app` c сохранённым active server / active character state, минимальные `super_admin` экраны для admin account-security и law corpus source management, law corpus schema foundation, ручной discovery/import pipeline для law corpus с normalizing и segmentation, hardening discovery coverage для forum index layout/pagination cases, manual current-version workflow, retrieval foundation для current primary laws, отдельный public `server legal assistant` модуль вне `/app`, а также полный separate precedent-pipeline с discovery/import/split, current-review/validity workflow и assistant integration по laws-first policy.
Прикладная бизнес-логика документов пока не реализована полностью, но document area уже вышла из чистого route foundation: добавлены отдельная account zone `/account` с обзорными `/account/documents`, `/account/security`, `/account/characters` и новым post-MVP `/account/trustors`, server-scoped hub `/servers/[serverSlug]/documents`, persisted family routes для `OGP complaints`, реальная `Document`-модель со snapshot foundation, first-save capture из `/new` в owner-account `[documentId]` route, базовый draft persistence layer и minimal autosave/manual save foundation, а также рабочий `OGP complaint` editor flow с `self / representative` branching, trustor snapshot внутри документа, evidence links, deterministic `BBCode` generation и owner-only publication layer для forum publish create и update/resync. Для OGP forum automation уже заведён отдельный account-scoped forum integration foundation: зашифрованная forum session хранится отдельно от документа, валидируется server-side и используется automation только как account-owned identity самого владельца документа. В OGP editor теперь уже видны publication readiness, `forum sync state`, persisted external forum identity и safe attempt/error state с различием `current / outdated / failed / manual_untracked`. Поверх этого generation flow теперь уже доведён до предсказуемого gating: используется единый shared validation contract для character profile, trustor snapshot и самого OGP payload, нормализация `passportNumber`/`phone`/`passportImageUrl`, а вместо vague `профиль не заполнен` editor показывает точный checklist по блокирующим полям с раздельными секциями character / trustor / document. Рядом с `OGP complaints` уже заведена отдельная `Claims` family: `/servers/[serverSlug]/documents/claims`, `/claims/new` и `/claims/[documentId]`. Для `rehabilitation` и `lawsuit` теперь уже работает не только persisted draft foundation, но и реальный claims editor MVP: first-save snapshot capture, immutable `server/character/subtype` после создания, owner-only `[documentId]` route, общий claims payload, subtype-specific поля, `self / representative` branching, trustor snapshot inside document, evidence links flow, отдельный deterministic structured preview renderer с copy-friendly text и persisted generated checkpoint/status integration без publication слоя. Регистрация по `login + email + password`, подтверждение email по ссылке, forgot-password, reset-password, вход по `email` или `login`, protected shell на `/app` c active server / active character selection, canonical self-service security route `/account/security`, compatibility `/app/security`, self change password, self change email, server-side admin account-security actions, а также foundation для law corpus, server-scoped источников законодательной базы, ручного discovery/import pipeline, bootstrap-health проверки полноты current corpus по серверу, ручного confirm imported draft версий, server-scoped retrieval foundation, public assistant по current primary laws и reviewed precedents, а также separate precedent-pipeline уже подготовлены. При этом character UX уже больше не ограничен transitional `/app`: в `/account/characters` теперь есть account-scoped grouped overview, shared account subnav и встроенные create/edit entry points с `fullName`, `nickname`, ролями, `access flags`, compact profile subsection и безопасной policy для default character без молчаливого перетягивания active selection. Для trustors теперь уже есть отдельный reusable registry в `/account/trustors`: grouped overview по серверам уже дополнен inline create/edit/soft-delete UX внутри account zone, а в document-side representative flows допускается только optional snapshot prefill без live link, без `trustorId` dependency в `documents` и без подмены current snapshot-only document model.
Поверх уже существующих OGP и claims editors теперь появился и первый document-AI block: field-level action `Улучшить текст` для согласованных long-text секций. Этот AI-слой работает только от persisted document payload и persisted snapshots, не превращает editor в chat, не делает silent overwrite, не сохраняет suggestion автоматически и использует только existing proxy/logging foundation через `ai_requests`.
Следующим post-MVP расширением поверх этого foundation уже стал первый grounded document AI v2 block внутри existing editors. Для `OGP violation_summary`, `claims legal_basis_summary` и `claims requested_relief` теперь доступен отдельный action `Улучшить с опорой на нормы`: он reuse-ит existing law/precedent retrieval foundation, сохраняет laws-first policy, честно различает `law_grounded`, `precedent_grounded` и `insufficient_corpus`, не превращает editor в chat и по-прежнему меняет только local editor state до обычного save/autosave.
Следующим user-facing слоем над этими модулями теперь уже появился public server directory `/servers`: он не зависит от `/app` shell, доступен гостю и авторизованному пользователю, показывает compact server availability, assistant availability и viewer-aware documents availability без утечки private document data. Рядом с ним теперь появился и auth-gated server hub `/servers/[serverSlug]`: он использует только `serverSlug` из URL, связывает пользователя с уже существующими `Assistant` и `Documents` модулями и честно показывает `server_not_found`, `server_unavailable` и `needs_character` состояния. Для `needs_character` user-facing bridge теперь уже ведёт не в generic `/app`, а в focused `/account/characters?server=<serverCode>#create-character-<serverCode>`.
Для internal/admin линии теперь уже появился и отдельный target contour `/internal`: это super_admin-only internal zone с shared nav. Внутри него `/internal/laws` и `/internal/precedents` уже переиспользуют реальные corpus management sections из transitional admin surface без зависимости от `AppShellHeader` и active `/app` shell server. Рядом с ними `/internal/security` теперь уже выступает target admin-security section для поиска аккаунта по `email/login/accountId`, account-level summary и admin actions над чужими аккаунтами, а `/internal/health` собирает compact internal summary по corpus health by server, assistant availability и runtime readiness без раздувания в full ops suite. Transitional `/app/admin-laws` и `/app/admin-security` больше не считаются primary admin surface и работают только как bridge в новый `/internal/*` contour, а shared fallback defaults для admin/corpus UI теперь тоже смотрят сразу в `/internal/*`, а не в legacy `/app/admin-*`.
Production email delivery для auth-писем зафиксирован через `Supabase Custom SMTP`, а не через встроенный email provider Supabase.

## Зафиксированный стек

- `Next.js`
- `TypeScript`
- `App Router`
- `Tailwind CSS`
- `shadcn/ui`
- `Zod`
- `Prisma`
- `PostgreSQL` через `Supabase`
- `Supabase Auth`
- `Supabase Storage`
- `OpenAI API`
- `pnpm`

## Принципы MVP

- Один full-stack проект без monorepo
- Одна общая кодовая база для пользовательской части и админки
- Поток разработки: локальная проверка -> GitHub -> VPS production
- Окружения: `local`, `staging`, `production`
- Базовый UI-слой MVP: `Tailwind CSS` + `shadcn/ui`
- Внутренние UI-действия строятся на `Server Actions`
- Технические endpoint’ы строятся на `Route Handlers`
- Единый слой валидации: `Zod`
- В document flow MVP используются ссылки, а не загрузка файлов
- `Supabase Storage` остается частью платформы, но не нужен на этапе bootstrap MVP
- AI вызывается только с сервера
- Шаблоны AI prompt’ов хранятся в коде, а не в БД
- Канонический MVP runtime на VPS: `systemd + release directories + current symlink`
- `Docker Compose` остаётся future target и не считается текущим blocker для production release hardening

## Основная модель

Базовая иерархия продукта:

`Account -> Server -> Characters -> Documents`

Дополнительные сущности:

- `trustors` живут в контексте `user + server`
- роли и флаги доступа живут в контексте `character_id`
- `super_admin` задается на уровне аккаунта
- серверное состояние пользователя хранится в `user_server_state`

## Зафиксированные machine keys

- `document_types`: `ogp_complaint`, `rehabilitation`, `lawsuit`
- `access_flags`: `advocate`, `server_editor`, `server_admin`, `tester`
- `user_access_flags`: `super_admin`

## Текущий состав репозитория

- [AGENTS.md](./AGENTS.md) — правила ведения репозитория и границы проекта
- [package.json](./package.json) — базовые зависимости и `pnpm`-scripts
- [src/app](./src/app) — `App Router`, корневой layout, стартовая страница и `/api/health`
- [src/app/sign-in](./src/app/sign-in) — публичная страница входа по `email` или `login`
- [src/app/sign-up](./src/app/sign-up) — публичная страница регистрации по `login`, email и паролю
- [src/app/sign-up/check-email](./src/app/sign-up/check-email) — экран ожидания подтверждения email
- [src/app/forgot-password](./src/app/forgot-password) — публичная страница запроса письма для восстановления пароля
- [src/app/forgot-password/check-email](./src/app/forgot-password/check-email) — нейтральный экран проверки почты для recovery flow
- [src/app/reset-password](./src/app/reset-password) — публичная страница установки нового пароля после recovery-ссылки
- [src/app/auth/confirm](./src/app/auth/confirm) — callback-обработчик подтверждения входа
- [src/app/assistant](./src/app/assistant) — публичная входная страница `server legal assistant` с явным выбором сервера
- [src/app/assistant/[serverSlug]](./src/app/assistant/%5BserverSlug%5D) — публичная страница вопроса-ответа по law corpus конкретного сервера
- [src/app/servers](./src/app/servers) — публичный server directory с viewer-aware summary по assistant и documents availability
- [src/app/servers/[serverSlug]](./src/app/servers/%5BserverSlug%5D) — auth-gated server hub с top-level cards `Assistant` и `Documents`
- [src/app/account](./src/app/account) — foundation-level account zone вне `/app`
- [src/app/internal](./src/app/internal) — internal contour для `super_admin` с shared nav; `/internal/laws`, `/internal/precedents`, `/internal/security` и `/internal/health` уже выступают target sections
- [src/app/account/characters](./src/app/account/characters) — owner-only grouped overview персонажей по серверам со встроенными create/edit entry points, default-character summary и compact profile subsection
- [src/app/account/documents](./src/app/account/documents) — account-level обзор persisted документов по всем серверам и типам
- [src/app/account/trustors](./src/app/account/trustors) — owner-only grouped reusable trustor registry по серверам со встроенными create/edit/soft-delete entry points; document-side использование допускается только как optional snapshot prefill
- [src/app/account/security](./src/app/account/security) — account-scoped security и forum integration foundation для будущей OGP automation
- [src/app/servers/[serverSlug]/documents](./src/app/servers/%5BserverSlug%5D/documents) — server-scoped document hub
- [src/app/servers/[serverSlug]/documents/ogp-complaints](./src/app/servers/%5BserverSlug%5D/documents/ogp-complaints) — persisted family route для документов `ogp_complaint`
- [src/app/servers/[serverSlug]/documents/ogp-complaints/new](./src/app/servers/%5BserverSlug%5D/documents/ogp-complaints/new) — first-save entry с фиксацией snapshot
- [src/app/servers/[serverSlug]/documents/ogp-complaints/[documentId]](./src/app/servers/%5BserverSlug%5D/documents/ogp-complaints/%5BdocumentId%5D) — owner-account editor route с BBCode generation, manual publication metadata и OGP-specific forum create/update automation
- [src/app/servers/[serverSlug]/documents/claims](./src/app/servers/%5BserverSlug%5D/documents/claims) — отдельная claims family рядом с OGP complaints
- [src/app/servers/[serverSlug]/documents/claims/new](./src/app/servers/%5BserverSlug%5D/documents/claims/new) — subtype choice и first-save entry для persisted claims drafts
- [src/app/servers/[serverSlug]/documents/claims/[documentId]](./src/app/servers/%5BserverSlug%5D/documents/claims/%5BdocumentId%5D) — owner-account claims editor MVP для `rehabilitation | lawsuit` с structured preview renderer и persisted generated checkpoint, но без publication слоя
- [src/app/(protected)/app](./src/app/%28protected%29/app) — protected transitional `/app` root с compatibility summary и safe links в target zones
- [src/app/account/security](./src/app/account/security) — canonical self-service security screen
- [src/app/(protected-security)/app/security](./src/app/%28protected-security%29/app/security) — compatibility redirect на `/account/security`
- [src/app/(protected-admin)/app/admin-security](./src/app/%28protected-admin%29/app/admin-security) — transitional `super_admin` bridge route в `/internal/security`
- [src/app/(protected-admin)/app/admin-laws](./src/app/%28protected-admin%29/app/admin-laws) — transitional `super_admin` bridge route в `/internal/laws`
- [src/server/internal](./src/server/internal) — access-context и foundation-логика для нового `/internal/...` contour
- [src/server/internal/corpus.ts](./src/server/internal/corpus.ts) — internal-only data/context layer для `/internal/laws` и `/internal/precedents` без зависимости от `/app` shell state
- [src/components](./src/components) — разделение базовых UI-компонентов и продуктовых компонентов
- [src/server](./src/server) — серверные действия, технические обработчики и серверные модули
- [src/server/auth](./src/server/auth) — server-side auth helpers для текущей сессии, пользователя и безопасной проверки авторизации
- [src/server/auth/admin-security.ts](./src/server/auth/admin-security.ts) — server-side admin account-security use-cases
- [src/server/actions/admin-security.ts](./src/server/actions/admin-security.ts) — server action-обвязка для `super_admin` UI
- [src/server/actions/forum-integration.ts](./src/server/actions/forum-integration.ts) — owner-only server actions для сохранения, validate и disable forum session connection
- [src/server/admin-security/account-search.ts](./src/server/admin-security/account-search.ts) — поиск account-level цели по email, login или account id
- [src/server/forum-integration](./src/server/forum-integration) — account-scoped foundation для forum session encryption, validate/connect/disconnect и provider client `forum.gta5rp.com`
- [src/server/document-area/publication.ts](./src/server/document-area/publication.ts) — OGP-specific publish create/update service с idempotency/gating, persisted forum identity и sync-state handling
- [src/server/document-ai/rewrite.ts](./src/server/document-ai/rewrite.ts) — owner-only field rewrite flow для OGP/claims editors с persisted-only input, safe metadata logging и proxy-only AI integration
- [src/server/law-corpus](./src/server/law-corpus) — foundation services для law corpus, import lock, current-version workflow и server-scoped retrieval
- [src/server/precedent-corpus](./src/server/precedent-corpus) — separate precedent-pipeline: source topic foundation, discovery/import/split, manual current-review, validity workflow, rollback foundation и retrieval provider для assistant
- [src/server/legal-assistant](./src/server/legal-assistant) — guest access layer, proxy-aware answer pipeline и public assistant services
- [src/server/account-security](./src/server/account-security) — foundation-логика login normalization, reserved logins и runtime backfill
- [src/server/characters](./src/server/characters) — доменная логика ручного создания и редактирования персонажей с ограничениями аккаунта и сервера
- [src/server/app-shell](./src/server/app-shell) — SSR логика shell, fallback состояния и server-side selection helper’ы
- [src/components/product/shell/protected-shell-overview-section.tsx](./src/components/product/shell/protected-shell-overview-section.tsx) — обзорный экран shell для `/app`
- [src/components/product/characters](./src/components/product/characters) — UI-контур списка, создания и редактирования персонажей с минимальным слоем ролей и `access flags`
- [src/db](./src/db) — Prisma client, seed-структура и репозитории, включая `documents`
- [src/db/repositories/auth-session.repository.ts](./src/db/repositories/auth-session.repository.ts) — security helper для revoke пользовательских auth-сессий
- [src/lib/supabase](./src/lib/supabase) — runtime-обвязка `Supabase Auth` для browser/server/middleware
- [src/lib/supabase/service-role.ts](./src/lib/supabase/service-role.ts) — helper для service-role сценариев account-security
- [src/schemas](./src/schemas) — `Zod`-схемы, включая law corpus и precedent corpus source validation, review и retrieval input validation
- [src/schemas/legal-assistant.ts](./src/schemas/legal-assistant.ts) — схема вопроса, `serverSlug` и proxy-config foundation для assistant
- [vitest.config.ts](./vitest.config.ts) — минимальная конфигурация `Vitest`
- [.github/workflows/ci.yml](./.github/workflows/ci.yml) — baseline CI для lint/typecheck/test/prisma
- [prisma/schema.prisma](./prisma/schema.prisma) — Prisma-схема foundation для account-security, shell/characters, documents, law corpus, precedents corpus и guest/AI assistant storage
- [prisma/migrations](./prisma/migrations) — миграции Prisma
- [docs/product/overview.md](./docs/product/overview.md) — краткая продуктовая рамка
- [docs/product/mvp-scope.md](./docs/product/mvp-scope.md) — фиксированный scope MVP
- [docs/architecture/stack.md](./docs/architecture/stack.md) — технологический стек и ограничения
- [docs/architecture/frontend.md](./docs/architecture/frontend.md) — UI-стек и границы фронтенд-слоя
- [docs/architecture/domain-model.md](./docs/architecture/domain-model.md) — доменная модель и правила
- [docs/architecture/database.md](./docs/architecture/database.md) — целевая схема хранения данных
- [docs/architecture/deployment.md](./docs/architecture/deployment.md) — окружения и деплой
- [docs/architecture/code-structure.md](./docs/architecture/code-structure.md) — правила разбиения кода и модулей
- [docs/architecture/git-workflow.md](./docs/architecture/git-workflow.md) — ветвление и релизный поток
- [docs/architecture/testing-and-debug.md](./docs/architecture/testing-and-debug.md) — baseline проверок, smoke и наблюдаемость
- [docs/plans/00-master-plan.md](./docs/plans/00-master-plan.md) — общий план реализации
- [docs/plans/05-law-corpus-and-server-legal-assistant.md](./docs/plans/05-law-corpus-and-server-legal-assistant.md) — текущий план блока law corpus, retrieval foundation и server legal assistant
- [docs/plans/06-judicial-precedents-corpus.md](./docs/plans/06-judicial-precedents-corpus.md) — план и текущий статус separate precedent-pipeline, current-review/validity workflow и будущей assistant integration
- [docs/plans/01-bootstrap.md](./docs/plans/01-bootstrap.md) и остальные поэтапные планы — исторические и текущие шаги проекта
- [docs/prod-access.md](./docs/prod-access.md) — текущий доступ к production-серверу
- [scripts/check-prod-access.ps1](./scripts/check-prod-access.ps1) — быстрая проверка SSH-доступа
- [scripts/deploy-prod.ps1](./scripts/deploy-prod.ps1) — текущая команда выкладки maintenance page
- [deploy/nginx/newlaw.conf](./deploy/nginx/newlaw.conf) — текущий `nginx`-конфиг
- [site/index.html](./site/index.html) — временная страница технических работ

## Production сейчас

Сейчас production-сервер обслуживает временную заглушку и HTTPS уже настроен на домене `lawyer5rp.ru`.
Это техническая стадия до старта прикладной разработки.

## Текущий пользовательский контур

В приложении уже собран минимальный рабочий контур шагов `03`, `04.1`, `04.2`, `04.3`, `04.4`, а также `03.1 account-security foundation`:

- регистрация по `login + email + password` через `Supabase Auth`
- экран “проверьте почту” после регистрации
- подтверждение email по ссылке через `/auth/confirm`
- forgot-password page с одним полем `identifier`
- нейтральный recovery flow по `email` или `account login`
- reset-password page с recovery-cookie и recovery session
- публичный вход по `email` или `login` и паролю
- protected transitional root `/app`
- canonical self-service security screen `/account/security`
- compatibility route `/app/security`
- compatibility shell на `/app`
- SSR context для аккаунта, списка серверов, активного сервера, персонажей выбранного сервера и активного персонажа
- выбор активного сервера через `Server Action`
- выбор активного персонажа через `Server Action`
- сохранение active server / active character в `UserServerState`
- безопасный fallback при отсутствии или битом `UserServerState`
- empty state, если нет доступных серверов
- empty state, если сервер есть, но персонажей на нём пока нет
- список персонажей пользователя по текущему active server
- ручное создание персонажа с обязательными полями `fullName` и `passportNumber`
- базовое редактирование существующего персонажа текущего аккаунта
- минимальное редактирование ролей и `access flags` на уровне `character_id`
- автоподстановка нового персонажа в active character после первого успешного создания на сервере
- foundation для `Account.login`, `pendingEmail`, `mustChangePassword` и `AuditLog`
- reconciliation-слой `Supabase user -> Prisma Account`
- self-service смена пароля с обязательным текущим паролем
- self-service смена email через `pendingEmail` и confirm flow
- protected guard для `mustChangePassword`, который ограничивает остальные `/app` маршруты до смены пароля
- server-side admin security use-cases:
  - `sendRecoveryEmail`
  - `resetPasswordWithTempPassword`
  - `changeEmailAsAdmin`
- super_admin-only guard для admin security действий
- audit log для admin security действий без утечки temp password
- revoke пользовательских сессий после admin reset password и admin change email
- минимальный `super_admin` экран `/app/admin-security`
- поиск целевого аккаунта только по `email`, `account login` или `account id`
- безопасный UI для admin recovery email, admin password reset и admin email change без полноценной админки
- foundation для law corpus:
  - `LawSourceIndex`
  - `Law`
  - `LawVersion`
  - `LawSourcePost`
  - `LawBlock`
  - `LawImportRun`
- foundation для отдельного precedents corpus:
  - `PrecedentSourceTopic`
  - `Precedent`
  - `PrecedentVersion`
  - `PrecedentSourcePost`
  - `PrecedentBlock`
- минимальный `super_admin` экран `/app/admin-laws`
- server-scoped source management для 1–2 index URL законодательной базы форума на сервер
- manual override foundation: `isExcluded`, `classificationOverride`, `internalNote`
- import lock / idempotency foundation через `LawImportRun.lockKey` и dedupe по `normalized_text_hash`
- ручной discovery по `LawSourceIndex` внутри `/app/admin-laws`
- hardening discovery coverage:
  - более устойчивый парсинг topic links в forum index
  - обход pagination links форума с дедупликацией topics
  - retry для временных forum `5xx` ответов без автоматической порчи старого corpus
- классификация topics в `primary`, `supplement`, `ignored`
- import конкретной forum topic в raw source layer
- сбор непрерывной нормативной цепочки постов сверху темы
- `normalized_full_text`, `source_snapshot_hash`, `normalized_text_hash`
- segmentation в `LawBlock` с типами `section`, `chapter`, `article`, `appendix`, `unstructured`
- создание новой версии закона только как `imported_draft`, без auto-current workflow
- ручное подтверждение `imported_draft -> current` только через `super_admin`
- автоматический перевод предыдущей `current` версии в `superseded`
- internal bootstrap-health summary по серверу:
  - `corpus_bootstrap_incomplete`
  - `usable_with_gaps`
  - `current_corpus_ready`
- internal retrieval preview по `current primary laws` выбранного сервера
- retrieval foundation только по `current` версиям `primary` laws, без `supplement`, `imported_draft` и `superseded`
- retrieval metadata с grounded references на `law`, `version`, `block` и source topic/source posts
- public `server legal assistant` вне `/app`
- маршруты `/assistant` и `/assistant/[serverSlug]`
- явный выбор server context через route param, а не через `/app` shell
- 1 тестовый guest question с сохранением одного Q/A pair
- proxy-only AI layer для assistant без прямых client-side и direct OpenAI calls
- SMTP foundation для production auth email delivery через `Supabase Custom SMTP`
- audit log для `forgot_password_requested` и `password_reset_completed`
- audit log для `password_changed_self`, `email_change_requested_self` и `email_change_completed`
- audit log для `recovery_email_sent_admin`, `password_reset_admin_temp` и `email_changed_admin`
- public assistant:
  - `/assistant` для выбора сервера
  - `/assistant/[serverSlug]` для вопроса-ответа по law corpus
  - guest access с лимитом `1` вопрос
  - сохранение одного guest Q/A pair и corpus snapshot metadata
- document area foundation:
  - `/account/documents` как агрегатор, а не как create/edit route
  - `/servers/[serverSlug]/documents` как server-scoped рабочая зона документов
  - route family foundation для `OGP complaints`
  - auth + serverSlug + character-availability guards без persistence и без wizard logic
- document persistence foundation:
  - реальная `Document`-модель c `document_type`, `status`, `author_snapshot_json`, `form_payload_json` и generation/publication foundation-полями
  - first-save snapshot capture из `/servers/[serverSlug]/documents/ogp-complaints/new`
  - immutable `serverId` и `characterId`/author snapshot после первого сохранения
  - owner-account editor route с базовым autosave/manual save для persisted drafts
  - `/account/documents` как рабочий persisted aggregator по всем серверам и типам
  - `/servers/[serverSlug]/documents/ogp-complaints` как persisted family list для `ogp_complaint`
- trustors registry foundation:
  - отдельная `Trustor` entity внутри связки `account + server`
  - `/account/trustors` как owner-only grouped overview reusable trustor cards по серверам
  - trustor registry не подменяет current trustor snapshot inside document
  - `documents` не получают `trustorId` dependency
- OGP complaint MVP editor flow:
  - `/servers/[serverSlug]/documents/ogp-complaints/new` работает как реальный pre-draft create entry
  - filing mode `self / representative`
  - representative branch доступна только персонажу с `access flag advocate`
  - trustor snapshot хранится внутри документа, а не как обязательная runtime-зависимость от внешнего registry
  - `evidenceGroups` и `evidenceRows` со ссылками уже сохраняются в persisted payload
  - `[documentId]` работает как owner-only complaint editor с реальным manual save и autosave foundation
  - deterministic `BBCode` generation уже работает для persisted `ogp_complaint` drafts
  - generation блокируется при неполном profile/payload и честно показывает причину
  - сохраняются `last_generated_bbcode`, `generated_at`, generation versions metadata, `publication_url` и manual forum sync marker
  - owner-only publish create/update уже работает только из latest generated `BBCode`
  - сохраняются `forumThreadId`, `forumPostId`, `forumPublishedBbcodeHash`, `forumLastPublishedAt`, `forumSyncState` и safe attempt logs
  - update/resync умеет возвращать automation-owned публикацию из `outdated` или `failed` обратно в `current`, не теряя external identity
 - Claims editor + output flow:
  - `/servers/[serverSlug]/documents/claims/[documentId]` работает как owner-only claims editor для `rehabilitation | lawsuit`
  - claims используют отдельный structured renderer вместо OGP `BBCode`
  - preview и `copyText` строятся детерминированно только из persisted document + snapshot
  - successful claims generation checkpoint сохраняет output-neutral artifact, `generated_at`, `generated_form_schema_version`, renderer/output metadata и переводит документ в `generated`
  - повторная генерация обновляет persisted artifact и metadata
  - последующая правка persisted claims payload помечает документ как `modified_after_generation`
  - publication/forum workflow для claims по-прежнему не активируется
  - server-side answer pipeline по `current primary laws` и reviewed/current precedents с `validity_status in (applicable, limited)`
  - laws-first ответ с разделением на `Краткий вывод`, `Что прямо следует из норм закона`, `Что подтверждается судебными прецедентами`, `Вывод / интерпретация`
  - grounded references на law/version/block/source и precedent/version/block/source
  - proxy-aware AI layer с поддержкой нескольких proxy entries
- foundation для отдельного precedents corpus внутри `/app/admin-laws`:
  - ручное заведение `precedent source topic`
  - manual override поля `isExcluded`, `classificationOverride`, `internalNote`
  - отдельные `version status` и `validity status`
  - precedents не смешиваются с `Law`, `LawVersion`, `LawBlock` и попадают в assistant только как отдельный typed source layer после review/current/validity workflow
- precedent discovery/import foundation:
  - precedent discovery через существующие `LawSourceIndex`, но отдельным pipeline
  - обновление `PrecedentSourceTopic` по `server_id + topic_external_id`
  - ручной import полного source topic snapshot
  - split одной forum topic в один или несколько extracted precedents
  - multi-post support без копирования law-правила про непрерывную нормативную цепочку
  - `normalized_full_text`, `source_snapshot_hash`, `normalized_text_hash` для каждого extracted precedent
  - segmentation в `PrecedentBlock` с типами `facts`, `issue`, `holding`, `reasoning`, `resolution`, `unstructured`
  - создание новых precedent versions только как `imported_draft`, без auto-current
- precedent current-review foundation:
  - manual `imported_draft -> current` workflow только для `super_admin`
  - отдельный `validity_status` workflow (`applicable`, `limited`, `obsolete`)
  - minimal review summary по source topic, source posts, blocks и hashes
  - rollback foundation на superseded precedent version без поломки version history

Бизнес-ограничения этого слоя уже работают на серверной стороне:

- максимум `3` персонажа на сервер для одного аккаунта
- запрет одинакового паспорта в рамках `account + server`
- если отдельный `nickname` не задан, остаётся безопасный fallback `nickname = fullName`
- роли и `access_flags` привязаны к `character_id`
- `Account.login` обязателен для новых регистраций, хранится в lowercase и в MVP не меняется
- reserved logins запрещены
- `Account.email` нельзя менять напрямую вне security/use-case слоя
- при `mustChangePassword=true` остальные protected-маршруты переводятся на `/account/security`
- пока `pendingEmail` не подтверждён, sign-in и recovery продолжают опираться на текущий подтверждённый email или на `login`
- law source management доступен только `super_admin`
- для одного сервера допускается максимум `2` law source index URL
- law source index URL допускается только с домена `forum.gta5rp.com`
- law text не редактируется вручную через internal source management слой
- discovery/import law corpus запускаются только вручную и только `super_admin`
- один закон трактуется как одна тема форума
- supplements хранятся отдельно и по умолчанию не смешиваются с `primary` laws
- судебные прецеденты не импортируются
- precedents corpus остаётся отдельной доменной линией и не хранится как `law_kind`
- precedent text не редактируется вручную через internal foundation-слой
- manual override и source topic foundation для precedents доступны только `super_admin`
- precedent discovery/import запускаются только вручную и только `super_admin`
- source topic precedents могут split-иться в один или несколько extracted precedents
- если split precedents ненадёжен, pipeline fallback-ится в один precedent на весь topic snapshot
- imported precedent versions создаются только как `imported_draft` и не переключаются в `current` автоматически
- precedent current-review и validity workflow доступны только `super_admin`
- у одного precedent в один момент времени может быть только одна `current` версия
- rollback возвращает superseded precedent version в `current` без удаления history
- structurally weak precedent draft даёт warning для review, а не автоматический запрет confirm
- подтверждение `imported_draft -> current` доступно только `super_admin`
- retrieval law corpus работает только в контексте выбранного `server_id`
- в retrieval по умолчанию участвуют только `primary` laws со статусом `current`
- `supplement`, `imported_draft` и `superseded` в retrieval не попадают
- основной retrieval unit — `LawBlock` уровня `article`, с аккуратным fallback на другие block types только если article-блоки не дали результата
- assistant живёт вне `/app` и не зависит от active server, active character, character roles/access flags и account-security screens
- assistant отвечает только по confirmed corpus выбранного `serverSlug`
- laws и precedents остаются разными corpus-линиями и объединяются только на уровне typed retrieval envelope
- precedents участвуют в assistant только если `status=current` и `validity_status in (applicable, limited)`
- `obsolete`, `imported_draft`, `superseded` и `supplement` в assistant не участвуют
- assistant не отвечает вне подтвержденного корпуса и не делает вид, что норма найдена, если retrieval её не нашёл
- guest учитывается по `anonymous session cookie + IP + user-agent`
- после первого guest вопроса старый ответ остаётся доступным, а новый вопрос требует вход или регистрацию
- после входа или регистрации guest лимит больше не блокирует пользователя
- все AI-вызовы assistant идут только через proxy-layer

## Полезные команды

После установки `Node.js` и `pnpm`:

```powershell
pnpm install
pnpm prisma:generate
pnpm dev
```

Для локального auth/db foundation также нужны переменные окружения из `.env.local.example`:

- `APP_URL`
- `DATABASE_URL`
- `DIRECT_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FORUM_SESSION_ENCRYPTION_KEY`

Важно:

- `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_ANON_KEY` обязательны для реального `signup/signin/confirm` flow.
- `APP_URL` обязателен для server-side redirect URL в security-сценариях.
- `SUPABASE_SERVICE_ROLE_KEY` нужен для service-role helper и уже реализованных server-side admin security actions.
- `DIRECT_URL` должен быть задан явно во всех окружениях. Для `local` допускается тот же URL, что и `DATABASE_URL`, но для `staging/production` лучше использовать отдельный direct connection string для Prisma migrations.
- `FORUM_SESSION_ENCRYPTION_KEY` обязателен для account-scoped forum integration foundation. Это чисто server-side секрет для шифрования сохранённой forum session; он не должен попадать в UI, тестовые fixtures, docs со значениями или repo.
- `AI_PROXY_ACTIVE_KEY`, `AI_PROXY_CONFIGS_JSON`, `AI_PROXY_INTERNAL_TOKEN` и `OPENAI_API_KEY` нужны для public `server legal assistant`.
- те же `AI_PROXY_*` env используются и для document field rewrite v1 и grounded document AI v2 внутри editors; отдельного document-AI route или отдельного provider config не нужно.
- placeholder-значения из `.env.*.example` позволяют открыть UI и безопасно посмотреть auth-экраны, но не дают рабочую регистрацию, письмо подтверждения и вход.
- placeholder-значения `AI_PROXY_*` позволяют собрать assistant UI, но не дают реальную генерацию ответа через proxy.
- в `AI_PROXY_CONFIGS_JSON` нельзя хранить секреты: там лежит только metadata proxy entry и имя env-переменной с секретом.
- production-ready auth email delivery требует не только боевых `Supabase` env, но и вручную настроенного `Supabase Custom SMTP`.
- встроенный email provider Supabase не считается production-ready для проекта Lawyer5RP MVP.
- public assistant 05.5 не делает прямых вызовов к `OpenAI API`; он работает только через server-side proxy abstraction.
- `OPENAI_API_KEY` и `AI_PROXY_INTERNAL_TOKEN` должны существовать только на серверной стороне и не должны попадать в UI, тестовые fixtures, tracked JSON-конфиги и логи.

Operational notes:

- локально вместо сырого `pnpm prisma generate` лучше использовать `pnpm prisma:generate`: этот script уже умеет автоматически повторить генерацию на Windows, если Prisma один раз упёрлась в типичный `EPERM` на rename engine file.
- если `pnpm prisma generate` всё же запускается вручную и падает на `EPERM`, это обычно не продуктовая проблема, а Windows file-locking; повторный запуск или `pnpm prisma:generate` обычно снимают проблему.
- в production `.env.production` переменная `DIRECT_URL` должна существовать заранее и не должна оставаться неявным fallback из deploy-команды.
- канонический production deploy sequence теперь реализован отдельным server-side script: `scripts/deploy-release.sh <target-sha-or-ref>`.

## Ручная настройка Supabase Auth

Для рабочего auth flow в каждом отдельном `Supabase` project нужно вручную проверить следующее:

1. Включён `Confirm email`.
2. В `Authentication -> URL Configuration` настроен корректный `Site URL`.
3. В `Redirect URLs` добавлен callback подтверждения email.
4. В `Authentication -> Email Templates -> Confirm signup` используется SSR-friendly ссылка с `token_hash`.
5. Recovery flow тоже должен быть направлен в `/auth/confirm`, чтобы route handler мог выставить recovery-cookie и перевести пользователя на `/reset-password`.
6. Для account-security уже должны быть готовы `APP_URL` и `SUPABASE_SERVICE_ROLE_KEY`, потому что server-side admin flows и минимальный `super_admin` UI используют service-role сценарии.
7. Для production и staging auth email delivery включён `Supabase Custom SMTP`.

Сценарии, которые зависят от корректного SMTP-контура:

- `signup confirm`
- `forgot password`
- `reset password`
- `change email confirm`

### Supabase Custom SMTP для Mail.ru

В проекте зафиксирован такой SMTP foundation:

- `host`: `smtp.mail.ru`
- официальный подтверждённый порт Mail.ru из справки: `465`
- шифрование: `SSL/TLS`
- `sender email` / `smtp user`: `lawyer5rp@inbox.ru`

Отдельная operational note:

- порт должен оставаться конфигурируемым и не должен быть жёстко зашит как `2525`
- порт `2525` можно отдельно проверять как альтернативный, но он не считается официальным documented default
- для Mail.ru нужен именно пароль внешнего приложения, а не обычный пароль почты
- SMTP credentials не хранятся в `git`, tracked env-файлах, README, docs, тестах и коде
- SMTP настраивается вручную в `Supabase Dashboard -> Authentication -> Email -> SMTP Settings` или через project config/API
- приложение `Next.js` не читает SMTP-секреты напрямую и пока не содержит app-side mailer

Минимальные поля в `Supabase Custom SMTP`:

- `Sender email`: `lawyer5rp@inbox.ru`
- `Host`: `smtp.mail.ru`
- `Port`: `465` по официальной справке Mail.ru
- `Username`: `lawyer5rp@inbox.ru`
- `Password`: пароль внешнего приложения Mail.ru
- `Encryption`: `SSL/TLS`

Минимальные точные значения для local:

- `Site URL`: `http://localhost:3000`
- `Redirect URL`: `http://localhost:3000/auth/confirm`

Минимальные точные значения для production:

- `Site URL`: `https://lawyer5rp.ru`
- `Redirect URL`: `https://lawyer5rp.ru/auth/confirm`

Шаблон письма подтверждения signup должен быть таким:

```text
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
```

Для recovery и будущего `email change confirm` публичный callback тоже должен приходить в:

```text
{{ .SiteURL }}/auth/confirm
```

В текущем коде `emailRedirectTo` дополнительно передаёт `next`, поэтому после подтверждения пользователь уходит в нужный внутренний маршрут, по умолчанию в `/account`.
Но сам факт настроенного `emailRedirectTo` ещё не делает почтовый контур production-ready без `Supabase Custom SMTP`.

Базовые проверки:

```powershell
pnpm lint
pnpm test
pnpm typecheck
pnpm prisma:validate
pnpm prisma:generate
```

Foundation-проверка шага `02-database-and-auth`:

```powershell
pnpm test:ci
pnpm lint
pnpm typecheck
pnpm prisma:validate
pnpm prisma:generate
```

Проверка шага `03-auth-shell-and-character-management`:

```powershell
pnpm lint
pnpm typecheck
pnpm test:ci
pnpm prisma:validate
pnpm prisma:generate
```

Для ручной проверки auth flow:

1. Подставить реальные `Supabase` env в `.env.local`.
2. Убедиться, что в `Supabase Dashboard` настроены `Confirm email`, `Site URL`, `Redirect URL`, email template и `Custom SMTP`.
3. Запустить `pnpm dev`.
4. Открыть `/sign-up`, зарегистрировать аккаунт с `login`, email и паролем, затем проверить экран “проверьте почту”.
5. Перейти по ссылке из письма и убедиться, что после `/auth/confirm` без explicit `next` открывается `/account`, а explicit deep link сохраняется.
6. Открыть `/forgot-password`, указать email или `login` и убедиться, что показывается нейтральный экран проверки почты.
7. Перейти по recovery-ссылке из письма, открыть `/reset-password`, задать новый пароль и убедиться, что после этого происходит redirect на `/sign-in?status=password-reset-success`.
8. После входа открыть `/account/security`, сменить пароль и убедиться, что сессия завершается, а sign-in возвращает статус `password-changed-success`.
9. На `/account/security` запросить смену email, убедиться, что в интерфейсе появляется `pendingEmail`, а после перехода по confirm-ссылке новый email синхронизируется и старый pending state очищается.
10. Проверить `/sign-in` дважды: сначала по email, затем по `login`, и убедиться, что обе ветки приводят к одному и тому же входу в аккаунт, в том числе после подтверждённой смены email.

Запуск тестов в watch-режиме:

```powershell
pnpm test:watch
```

Проверка SSH-доступа:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\check-prod-access.ps1
```

Выкладка текущей maintenance page:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-prod.ps1
```

## Что дальше

После `field-level rewrite v1` и первого grounded document AI v2 rollout следующий шаг уже не должен без отдельного согласования расширять editor до chat UI, full-document rewrite, broad drafting suite, embeddings/vector search, feedback/history или полноценной AI-админки.
