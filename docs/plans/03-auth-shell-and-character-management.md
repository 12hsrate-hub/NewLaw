# План 03: Auth Shell and Character Management

## Цель этапа

Собрать минимальный рабочий пользовательский контур поверх уже подключенного `Supabase Auth` и foundation-слоя данных:

- публичный вход
- защищённый app shell
- выбор активного сервера
- выбор активного персонажа
- список, создание и редактирование персонажей

## Статус

Этап выполнен.

Дополнение `03.1 account-security foundation` выполнено.

Дополнение `03.1a SMTP foundation для auth-писем` выполнено.

Дополнение `03.2 public auth recovery flows` выполнено.

## Что вошло в этап по факту

- добавлена публичная страница входа `/sign-in`
- добавлена публичная страница регистрации `/sign-up`
- добавлен экран `/sign-up/check-email`
- подключён вход по email и паролю через `Supabase Auth`
- подключена регистрация по email и паролю через `Supabase Auth`
- добавлен callback-обработчик подтверждения email `/auth/confirm`
- `email confirmation flow` переведён на `token_hash + type + verifyOtp`
- добавлена публичная страница `/forgot-password`
- добавлена публичная страница `/forgot-password/check-email`
- добавлена публичная страница `/reset-password`
- signup flow сохранён на `login + email + password`
- forgot-password flow переведён на единое поле `identifier`
- lookup `login -> Account.email` для recovery выполняется только на сервере
- forgot-password публично всегда возвращает нейтральный результат без раскрытия существования аккаунта
- `/auth/confirm` теперь поддерживает:
  - `type=email`
  - `type=recovery`
  - `type=email_change`
- для `recovery` после `verifyOtp` выставляется короткоживущий recovery-cookie и выполняется redirect на `/reset-password`
- для `email_change` добавлен базовый confirm/result flow с безопасным redirect и стыком к account reconciliation
- reset-password flow обновляет пароль через `Supabase Auth`, очищает recovery-cookie, пишет audit log, обновляет `passwordChangedAt` и снимает `mustChangePassword`
- добавлено server action для выхода
- защищённая часть приложения вынесена в `/app`
- неавторизованный пользователь перенаправляется из защищённой части на страницу входа
- собран минимальный app shell с:
  - отображением текущего аккаунта
  - выбором активного сервера
  - выбором активного персонажа
  - явным отображением активного сервера и персонажа
- реализован минимальный экран управления персонажами:
  - список персонажей по выбранному серверу
  - empty state при пустом сервере
  - ручное создание персонажа
  - редактирование существующего персонажа
  - просмотр и редактирование ролей и `access_flags`
- добавлены server actions и helper'ы для:
  - выбора активного сервера
  - выбора активного персонажа
  - создания персонажа
  - редактирования персонажа
- добавлены helper'ы и тесты для:
  - signup flow
  - confirm flow
  - success/error веток подтверждения email
  - forgot-password flow
  - recovery confirm flow
  - reset-password flow
- расширен foundation account-security:
  - `Account.login`
  - `Account.pendingEmail`
  - `Account.pendingEmailRequestedAt`
  - `Account.mustChangePassword`
  - `Account.mustChangePasswordReason`
  - `Account.passwordChangedAt`
  - `AuditLog`
- добавлены enum'ы для:
  - `AccountSecurityReason`
  - `AuditActionKey`
  - `AuditLogStatus`
- добавлен migration backfill для старых аккаунтов:
  - `login` сначала добавляется как nullable
  - затем заполняется из email local-part с fallback
  - затем переводится в required + unique
- добавлены foundation helper'ы и репозитории для:
  - reconciliation `Supabase user -> Prisma Account`
  - pending email state
  - must-change-password state
  - audit log
- добавлен service-role helper для будущих admin security use-cases
- signup foundation обновлён:
  - `login` обязателен уже на этапе регистрации
  - `login` передаётся в `Supabase user metadata`
- зафиксирован production SMTP foundation для auth-писем:
  - delivery идёт через `Supabase Custom SMTP`
  - встроенный email provider Supabase не считается production-ready
  - SMTP credentials не хранятся в git и настраиваются вручную в `Supabase Dashboard`
  - для Mail.ru фиксируются `smtp.mail.ru`, официальный documented port `465`, `SSL/TLS`, `lawyer5rp@inbox.ru`
  - альтернативный порт `2525` можно отдельно проверять, но не считать дефолтом

## Что сознательно не вошло

- документы
- доверители
- мастер жалобы
- генерация `BBCode`
- форумная публикация
- AI-функции
- полноценная админка
- лишние `e2e`
- логика запрета переключения активного персонажа во время редактирования документа
- OAuth providers
- полноценное восстановление пароля
- `/app/security`
- self-service password/email actions
- admin reset/change-email use-cases
- app-side mailer внутри `Next.js`

## Зафиксированные правила этапа

- персонажи создаются только вручную
- минимально обязательные поля: ФИО и паспорт
- email не является полем персонажа и живёт на уровне аккаунта
- после signup пользователь не логинится сразу, а получает экран с ожиданием письма
- forgot-password принимает только `email` или `account login`
- recovery никогда не работает по персонажу, ФИО, паспорту или любым character identifiers
- `Account.login` обязателен для новых регистраций
- `Account.login` хранится в lowercase и в MVP неизменяемый
- reserved logins запрещены
- для старых аккаунтов без login используется безопасный backfill из email local-part с уникальным fallback
- `Account.email` нельзя менять напрямую из UI, actions и обычного repository-слоя
- `Supabase Auth` остаётся источником истины для identity/email
- `Prisma Account` остаётся источником истины для app-level security flags
- публичный recovery flow допускается только через email-based Supabase Auth сценарии
- доступ к `/reset-password` разрешён только при recovery-cookie и валидной recovery session
- production auth email delivery идёт через `Supabase Custom SMTP`
- встроенный Supabase email provider не считать production-ready для Lawyer5RP MVP
- SMTP-секреты не хранятся в репозитории, tracked env files, коде, тестах и документации
- для Mail.ru использовать пароль внешнего приложения, а не обычный пароль почты
- сценарии `signup confirm`, `forgot password`, `reset password`, `change email confirm` зависят от корректно настроенного SMTP-контура
- после перехода по ссылке подтверждения сессия должна появиться через SSR/cookies и открыть защищённую часть
- максимум `3` персонажа на сервер для одного аккаунта
- одинаковые паспорта в рамках `account + server` запрещены
- `nickname` приравнивается к `fullName`
- роли и `access_flags` привязаны к `character_id`, а не к ФИО
- активный сервер и активный персонаж хранятся через state-слой на базе `UserServerState`
- если в окружении стоят placeholder `Supabase` env, UI должен оставаться доступным, но auth flow обязан давать понятное безопасное сообщение

## Основные файлы этапа

- `src/app/sign-in/page.tsx`
- `src/app/sign-up/page.tsx`
- `src/app/sign-up/check-email/page.tsx`
- `src/app/forgot-password/page.tsx`
- `src/app/forgot-password/check-email/page.tsx`
- `src/app/reset-password/page.tsx`
- `src/app/auth/confirm/route.ts`
- `src/app/(protected)/app/layout.tsx`
- `src/app/(protected)/app/page.tsx`
- `src/components/product/auth/sign-in-form.tsx`
- `src/components/product/auth/sign-up-form.tsx`
- `src/components/product/auth/forgot-password-form.tsx`
- `src/components/product/auth/reset-password-form.tsx`
- `src/components/product/auth/check-email-card.tsx`
- `src/components/product/shell/app-shell-header.tsx`
- `src/components/product/characters/character-form-card.tsx`
- `src/components/product/characters/character-management-section.tsx`
- `src/server/actions/auth.ts`
- `src/server/actions/public-auth.ts`
- `src/server/actions/shell.ts`
- `src/server/actions/characters.ts`
- `src/server/auth/protected.ts`
- `src/server/auth/confirm.ts`
- `src/server/auth/recovery.ts`
- `src/server/auth/account.ts`
- `src/server/app-shell/context.ts`
- `src/server/app-shell/state.ts`
- `src/server/app-shell/selection.ts`
- `src/lib/auth/email-auth.ts`
- `src/lib/supabase/public-server.ts`
- `src/lib/supabase/service-role.ts`
- `src/schemas/auth.ts`
- `src/schemas/account-security.ts`
- `src/db/repositories/user-server-state.repository.ts`
- `src/db/repositories/character.repository.ts`
- `src/db/repositories/account.repository.ts`
- `src/db/repositories/account-security.repository.ts`
- `src/db/repositories/audit-log.repository.ts`
- `src/server/characters/manual-character.ts`
- `prisma/migrations/20260420043055_auth_shell_and_character_management/migration.sql`
- `prisma/migrations/20260420103000_account_security_foundation/migration.sql`

## Проверки этапа

Для этапа успешно пройдены:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test:ci`
- `pnpm prisma:validate`
- `pnpm prisma:generate`

## Обязательные ручные настройки Supabase

Для рабочего сценария `signup -> confirm email -> authenticated session` должны быть вручную настроены:

- включён `Confirm email`
- задан `Site URL`
- добавлен `Redirect URL` для `/auth/confirm`
- обновлён email template подтверждения signup
- recovery flow тоже должен возвращаться в `/auth/confirm`
- задан `APP_URL` в окружении приложения
- задан `SUPABASE_SERVICE_ROLE_KEY` для foundation service-role helper
- в `Supabase Dashboard -> Authentication -> Email -> SMTP Settings` включён `Custom SMTP`
- для SMTP Mail.ru вручную заданы:
  - `host`: `smtp.mail.ru`
  - официальный documented port: `465`
  - encryption: `SSL/TLS`
  - sender/user: `lawyer5rp@inbox.ru`
- альтернативный порт `2525` можно проверять отдельно, но он не считается официальным дефолтом
- для входа в SMTP используется пароль внешнего приложения Mail.ru

Точные значения для local:

- `Site URL`: `http://localhost:3000`
- `Redirect URL`: `http://localhost:3000/auth/confirm`

Точные значения для production:

- `Site URL`: `https://lawyer5rp.ru`
- `Redirect URL`: `https://lawyer5rp.ru/auth/confirm`

Шаблон письма подтверждения:

```text
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
```

Recovery flow тоже должен идти через `/auth/confirm`, чтобы route handler смог:

- завершить `verifyOtp`
- выставить recovery-cookie
- перевести пользователя на `/reset-password`

Если используются placeholder env, UI можно безопасно открыть и проверить визуально, но реальный auth flow работать не будет до подстановки настоящих Supabase-значений.

## Критерии завершения

- пользователь может войти по email и попасть в защищённую часть приложения
- пользователь может зарегистрироваться по email и паролю
- после регистрации пользователь видит экран ожидания письма, а не мгновенный вход
- переход по ссылке из письма создаёт рабочую сессию и приводит в защищённую часть
- пользователь может открыть `/forgot-password`, указать `email` или `login` и получить нейтральный recovery-result
- переход по recovery-ссылке создаёт recovery-session и открывает `/reset-password`
- после reset-password пароль обновляется, recovery-cookie очищается, а пользователь возвращается на `/sign-in`
- foundation account-security зафиксирован в схеме, миграции, репозиториях и тестах
- старые аккаунты не ломаются из-за появления обязательного `login`
- SMTP foundation для production auth email delivery зафиксирован в документации и operational notes
- защищённый shell показывает активный сервер и активного персонажа
- пользователь может выбрать сервер и персонажа
- пользователь видит empty state при отсутствии персонажей
- пользователь может создать и отредактировать персонажа в рамках зафиксированных ограничений
