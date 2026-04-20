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

Дополнение `03.3 protected account security flows` выполнено.

Дополнение `03.4 admin account-security server-side actions` выполнено.

Дополнение `03.5 minimal super_admin UI for admin account-security actions` выполнено.

## Что вошло в этап по факту

- добавлена публичная страница входа `/sign-in`
- добавлена публичная страница регистрации `/sign-up`
- добавлен экран `/sign-up/check-email`
- подключён вход по `email` или `login` и паролю через `Supabase Auth`
- подключена регистрация по email и паролю через `Supabase Auth`
- добавлен callback-обработчик подтверждения email `/auth/confirm`
- `email confirmation flow` переведён на `token_hash + type + verifyOtp`
- добавлена публичная страница `/forgot-password`
- добавлена публичная страница `/forgot-password/check-email`
- добавлена публичная страница `/reset-password`
- signup flow сохранён на `login + email + password`
- forgot-password flow переведён на единое поле `identifier`
- lookup `login -> Account.email` для recovery выполняется только на сервере
- lookup `login -> Account.email` для sign-in тоже выполняется только на сервере
- forgot-password публично всегда возвращает нейтральный результат без раскрытия существования аккаунта
- `/auth/confirm` теперь поддерживает:
  - `type=email`
  - `type=recovery`
  - `type=email_change`
- для `recovery` после `verifyOtp` выставляется короткоживущий recovery-cookie и выполняется redirect на `/reset-password`
- для `email_change` добавлен базовый confirm/result flow с безопасным redirect и стыком к account reconciliation
- reset-password flow обновляет пароль через `Supabase Auth`, очищает recovery-cookie, пишет audit log, обновляет `passwordChangedAt` и снимает `mustChangePassword`
- добавлен защищённый экран `/app/security`
- на `/app/security` показываются:
  - текущий подтверждённый email
  - `account login`
  - баннер `pendingEmail`, если смена email ожидает подтверждения
- добавлена self-service смена пароля:
  - форма `currentPassword + newPassword + confirmNewPassword`
  - после успеха снимается `mustChangePassword`
  - обновляется `passwordChangedAt`
  - пишется `audit log`
  - текущая сессия завершается
  - выполняется redirect на `/sign-in?status=password-changed-success`
- добавлена self-service смена email:
  - форма `newEmail + currentPassword`
  - перед сменой выполняется reauth через текущий подтверждённый email
  - `Account.email` не меняется напрямую
  - через security-layer в `Prisma` пишутся `pendingEmail` и `pendingEmailRequestedAt`
  - после confirm и reconciliation `pendingEmail` очищается, а `Account.email` синхронизируется с `Supabase Auth`
- `email_change` confirm flow теперь возвращает пользователя на `/app/security`
- добавлен protected guard для `mustChangePassword`:
  - остальные защищённые `/app` маршруты редиректят на `/app/security`
  - header и server actions в защищённой части уважают этот guard
  - пока `mustChangePassword=true`, self email change заблокирован
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
- реализованы server-side admin security use-cases:
  - `sendRecoveryEmail(targetAccountId, comment)`
  - `resetPasswordWithTempPassword(targetAccountId, comment)`
  - `changeEmailAsAdmin(targetAccountId, newEmail, comment)`
- все admin security use-cases доступны только для `super_admin`
- доступ к admin security use-cases не зависит от активного персонажа или серверного контекста
- для каждого admin security use-case обязателен `comment`
- denied access и failure cases проходят через единый security-layer и пишут безопасный `audit log`
- `sendRecoveryEmail` использует текущий подтвержденный `Account.email`, а не `pendingEmail`
- `resetPasswordWithTempPassword`:
  - генерирует временный пароль только в рантайме
  - не сохраняет temp password в `Prisma`
  - не пишет temp password в `audit log` и metadata
  - после reset выставляет `mustChangePassword=true`
  - выставляет `mustChangePasswordReason=admin_reset`
  - запрашивает revoke пользовательских сессий
- `changeEmailAsAdmin`:
  - использует привилегированный `Supabase Admin API`
  - синхронизирует `Account.email` через security-layer
  - очищает `pendingEmail` и `pendingEmailRequestedAt`
  - запрашивает revoke пользовательских сессий
  - не меняет `account login`
- добавлен минимальный `super_admin`-only экран `/app/admin-security`
- на экране можно найти аккаунт только по `email`, `account login` или `account id`
- найденный аккаунт показывает `id`, `email`, `login`, `pendingEmail`, `mustChangePassword`
- UI подключён к уже существующим server-side admin actions:
  - `sendRecoveryEmail`
  - `resetPasswordWithTempPassword`
  - `changeEmailAsAdmin`
- admin reset password показывает временный пароль только как одноразовый результат действия, без URL/query param/history-переноса
- denied access для не-super_admin уходит в безопасный flow через `/app/security`
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
- app-side mailer внутри `Next.js`
- admin navigation framework и полноценная админка

## Зафиксированные правила этапа

- персонажи создаются только вручную
- минимально обязательные поля: ФИО и паспорт
- email не является полем персонажа и живёт на уровне аккаунта
- после signup пользователь не логинится сразу, а получает экран с ожиданием письма
- forgot-password принимает только `email` или `account login`
- sign-in принимает `email` или `account login`
- recovery никогда не работает по персонажу, ФИО, паспорту или любым character identifiers
- protected security flow строится только вокруг аккаунта, а не вокруг персонажа
- `Account.login` обязателен для новых регистраций
- `Account.login` хранится в lowercase и в MVP неизменяемый
- reserved logins запрещены
- для старых аккаунтов без login используется безопасный backfill из email local-part с уникальным fallback
- `Account.email` нельзя менять напрямую из UI, actions и обычного repository-слоя
- server-side admin security actions доступны только `super_admin`
- admin security действия требуют обязательный `comment`
- temp password при admin reset генерируется системой, показывается один раз и не должен попадать в БД, логи, metadata и snapshots
- минимальный admin UI не превращается в полноценную админку и не ищет по character-level идентификаторам
- `Supabase Auth` остаётся источником истины для identity/email
- `Prisma Account` остаётся источником истины для app-level security flags
- публичный recovery flow допускается только через email-based Supabase Auth сценарии
- доступ к `/reset-password` разрешён только при recovery-cookie и валидной recovery session
- до confirm новый email не начинает работать для sign-in/recovery
- старый подтверждённый email остаётся рабочим, пока `pendingEmail` не подтверждён
- `login` продолжает работать на тот же аккаунт и не меняется во время `pendingEmail` и после confirm email change
- повторный запрос смены email заменяет предыдущий `pendingEmail`
- после confirm email change и reconciliation `pendingEmail` очищается
- при `mustChangePassword=true` пользователь может проходить только на `/app/security`, logout и технические auth routes
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
- `src/app/(protected-security)/app/security/page.tsx`
- `src/components/product/auth/sign-in-form.tsx`
- `src/components/product/auth/sign-up-form.tsx`
- `src/components/product/auth/forgot-password-form.tsx`
- `src/components/product/auth/reset-password-form.tsx`
- `src/components/product/auth/check-email-card.tsx`
- `src/components/product/security/account-security-section.tsx`
- `src/components/product/security/change-password-form.tsx`
- `src/components/product/security/change-email-form.tsx`
- `src/components/product/shell/app-shell-header.tsx`
- `src/components/product/characters/character-form-card.tsx`
- `src/components/product/characters/character-management-section.tsx`
- `src/server/actions/auth.ts`
- `src/server/actions/account-security.ts`
- `src/server/actions/public-auth.ts`
- `src/server/actions/shell.ts`
- `src/server/actions/characters.ts`
- `src/server/auth/protected.ts`
- `src/server/auth/confirm.ts`
- `src/server/auth/recovery.ts`
- `src/server/auth/security.ts`
- `src/server/auth/account.ts`
- `src/server/app-shell/context.ts`
- `src/server/app-shell/state.ts`
- `src/server/app-shell/selection.ts`
- `src/lib/auth/email-auth.ts`
- `src/lib/supabase/public-server.ts`
- `src/lib/supabase/service-role.ts`
- `src/server/auth/admin-security.ts`
- `src/db/repositories/auth-session.repository.ts`
- `src/app/(protected-admin)/app/admin-security/page.tsx`
- `src/components/product/admin-security/admin-security-section.tsx`
- `src/components/product/admin-security/admin-security-actions-panel.tsx`
- `src/server/actions/admin-security.ts`
- `src/server/admin-security/account-search.ts`
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

- пользователь может войти по `email` или `login` и попасть в защищённую часть приложения
- пользователь может зарегистрироваться по email и паролю
- после регистрации пользователь видит экран ожидания письма, а не мгновенный вход
- переход по ссылке из письма создаёт рабочую сессию и приводит в защищённую часть
- пользователь может открыть `/forgot-password`, указать `email` или `login` и получить нейтральный recovery-result
- переход по recovery-ссылке создаёт recovery-session и открывает `/reset-password`
- после reset-password пароль обновляется, recovery-cookie очищается, а пользователь возвращается на `/sign-in`
- пользователь может открыть `/app/security`, увидеть текущий email, `login` и `pendingEmail`
- пользователь может сменить пароль из `/app/security`
- пользователь может запросить смену email из `/app/security` без прямого update `Account.email`
- пока `mustChangePassword=true`, остальные protected routes недоступны и переводят на `/app/security`
- после confirm email change и reconciliation новый email синхронизируется с аккаунтом, а `pendingEmail` очищается
- sign-in по `login` не ломается ни во время `pendingEmail`, ни после подтверждённой смены email
- foundation account-security зафиксирован в схеме, миграции, репозиториях и тестах
- server-side admin security use-cases готовы без отдельного admin UI
- минимальный `super_admin` экран готов и безопасно использует существующие admin security use-cases
- старые аккаунты не ломаются из-за появления обязательного `login`
- SMTP foundation для production auth email delivery зафиксирован в документации и operational notes
- защищённый shell показывает активный сервер и активного персонажа
- пользователь может выбрать сервер и персонажа
- пользователь видит empty state при отсутствии персонажей
- пользователь может создать и отредактировать персонажа в рамках зафиксированных ограничений
