# План 02: Database and Auth

## Цель этапа

Поднять рабочий foundation для `Supabase Auth`, аккаунта, серверов и персонажей внутри одного `Next.js`-приложения без выхода в слой документов.

## Статус

Этап выполнен.

## Что вошло в этап по факту

- подключен runtime `Supabase Auth` для `Next.js App Router`
- добавлены browser/server/middleware helper'ы для `Supabase`
- добавлены server-side auth helper'ы:
  - получение текущей сессии
  - получение текущего пользователя
  - безопасная server-side проверка авторизации
  - принудительная проверка авторизации через `requireAuthenticatedUser`
- добавлена Prisma-схема foundation:
  - `Account`
  - `Server`
  - `UserServerState`
  - `Character`
  - `CharacterRole`
  - `CharacterAccessFlag`
- подготовлена Prisma migration для foundation
- добавлен минимальный repository/helper слой:
  - получение серверов
  - получение персонажей пользователя по серверу
  - ручное создание персонажа
  - проверка лимита персонажей
  - проверка уникальности паспорта в рамках аккаунта и сервера
- добавлены минимальные `Zod`-схемы для auth/env, аккаунта, сервера и персонажа
- добавлены тесты на auth-helper'ы и ключевые бизнес-ограничения персонажей

## Что сознательно не вошло

- документы
- доверители
- генерация `BBCode`
- форумная публикация
- AI-логика
- полноценная админка
- лишние `e2e`

## Зафиксированные решения этапа

- `Supabase Auth` используется как источник user identity
- email живет на уровне `Account`, а не персонажа
- персонажи создаются вручную
- в рамках одного аккаунта и одного сервера нельзя создать больше трех активных персонажей
- в рамках одного аккаунта и одного сервера нельзя иметь двух активных персонажей с одинаковым паспортом
- `nickname` при ручном создании приравнивается к `fullName`
- роли и флаги доступа привязаны к `character_id`, а не к ФИО
- `user_server_state` хранится в БД, а не только в сессии
- soft delete для персонажей учитывается уже на уровне выборок и ограничений

## Основные файлы этапа

- `middleware.ts`
- `src/lib/supabase/browser.ts`
- `src/lib/supabase/server.ts`
- `src/lib/supabase/middleware.ts`
- `src/server/auth/helpers.ts`
- `src/server/auth/account.ts`
- `src/server/characters/manual-character.ts`
- `src/db/repositories/account.repository.ts`
- `src/db/repositories/server.repository.ts`
- `src/db/repositories/character.repository.ts`
- `src/schemas/account.ts`
- `src/schemas/server.ts`
- `src/schemas/character.ts`
- `src/schemas/env.ts`
- `prisma/schema.prisma`
- `prisma/migrations/20260420035107_database_and_auth_foundation/migration.sql`

## Проверки этапа

Для этапа успешно пройдены:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test:ci`
- `pnpm prisma:validate`
- `pnpm prisma:generate`

## Критерии завершения

- `Supabase Auth` подключен на runtime-уровне для `App Router`
- сервер умеет безопасно получить текущего пользователя и сессию
- foundation-таблицы описаны в Prisma и покрыты миграцией
- серверы можно сидировать из репозитория
- ограничения по персонажам и паспорту защищены на серверном слое и покрыты тестами
