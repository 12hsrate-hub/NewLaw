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

## Что вошло в этап по факту

- добавлена публичная страница входа `/sign-in`
- подключён минимальный вход по email через `Supabase Auth`
- добавлен callback-обработчик подтверждения входа
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

## Зафиксированные правила этапа

- персонажи создаются только вручную
- минимально обязательные поля: ФИО и паспорт
- email не является полем персонажа и живёт на уровне аккаунта
- максимум `3` персонажа на сервер для одного аккаунта
- одинаковые паспорта в рамках `account + server` запрещены
- `nickname` приравнивается к `fullName`
- роли и `access_flags` привязаны к `character_id`, а не к ФИО
- активный сервер и активный персонаж хранятся через state-слой на базе `UserServerState`

## Основные файлы этапа

- `src/app/sign-in/page.tsx`
- `src/app/auth/confirm/route.ts`
- `src/app/(protected)/app/layout.tsx`
- `src/app/(protected)/app/page.tsx`
- `src/components/product/auth/sign-in-form.tsx`
- `src/components/product/shell/app-shell-header.tsx`
- `src/components/product/characters/character-form-card.tsx`
- `src/components/product/characters/character-management-section.tsx`
- `src/server/actions/auth.ts`
- `src/server/actions/shell.ts`
- `src/server/actions/characters.ts`
- `src/server/auth/protected.ts`
- `src/server/app-shell/context.ts`
- `src/server/app-shell/state.ts`
- `src/server/app-shell/selection.ts`
- `src/db/repositories/user-server-state.repository.ts`
- `src/db/repositories/character.repository.ts`
- `src/server/characters/manual-character.ts`
- `prisma/migrations/20260420043055_auth_shell_and_character_management/migration.sql`

## Проверки этапа

Для этапа успешно пройдены:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test:ci`
- `pnpm prisma:validate`
- `pnpm prisma:generate`

## Критерии завершения

- пользователь может войти по email и попасть в защищённую часть приложения
- защищённый shell показывает активный сервер и активного персонажа
- пользователь может выбрать сервер и персонажа
- пользователь видит empty state при отсутствии персонажей
- пользователь может создать и отредактировать персонажа в рамках зафиксированных ограничений
