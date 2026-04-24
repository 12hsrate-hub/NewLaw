# План 01: Bootstrap

## Цель этапа

Подготовить инженерный каркас приложения без прикладной бизнес-логики.

## Что входит

- инициализация проекта на `Next.js + TypeScript + App Router`
- настройка `Tailwind CSS`
- подключение `shadcn/ui`
- настройка `pnpm`
- базовая структура каталогов приложения
- подключение `Zod`
- подключение `Prisma`
- подключение `Supabase` SDK
- подготовка `env`-шаблона для `local`, `staging`, `production`
- базовые lint и typecheck команды
- минимальный тестовый контур на `Vitest`
- фиксация базовой структуры кода по архитектурным правилам

## Что не входит

- прикладные страницы персонажей
- прикладные страницы документов
- реализация мастера жалобы
- production-ready бизнес-функциональность

## Основные задачи

1. Создать приложение без monorepo.
2. Настроить `pnpm` как единственный пакетный менеджер.
3. Определить базовую структуру каталогов.
4. Подключить `Tailwind CSS`, `shadcn/ui` и базовый UI-каркас.
5. Подключить `Zod` как единый слой схем и валидации.
6. Подключить `Prisma` и заготовить `schema.prisma`.
7. Подключить `Supabase` для `Auth`.
8. Подготовить `env.example`.
9. Зафиксировать базовые скрипты разработки и проверки.
10. Подготовить baseline CI для `pnpm lint`, `pnpm typecheck`, `pnpm prisma validate`, `pnpm prisma generate`.
11. Подготовить базовые seed-данные из репозитория для справочников и первого рабочего сервера.
12. Добавить минимальный тестовый контур на `Vitest` с базовыми smoke/unit тестами для bootstrap-слоя.
13. Зафиксировать начальную структуру каталогов по [docs/architecture/code-structure.md](../architecture/code-structure.md), [frontend.md](../architecture/frontend.md) и [testing-and-debug.md](../architecture/testing-and-debug.md).

## Ожидаемый результат

- проект запускается локально
- типизация и базовые проверки работают
- каркас готов к реализации auth и БД

## Статус по факту выполнения

Выполнено на этом шаге:

- подготовлен корневой каркас `Next.js` проекта на `TypeScript` и `App Router`
- добавлены `pnpm`-ориентированные scripts
- подключена базовая конфигурация `Tailwind CSS`
- подготовлена база для `shadcn/ui` через `components.json`, aliases и `cn` utility
- подключены `Prisma` и базовая `schema.prisma`
- подключен `Zod`
- разложена базовая структура каталогов по архитектурным правилам
- подготовлены `.env.local.example`, `.env.staging.example`, `.env.production.example`
- добавлены базовые заготовки для `server actions`, `route handlers`, `db/server modules`, `ui/components`
- добавлены `.gitattributes` и `.gitignore`
- подготовлена seed-структура из репозитория для первого рабочего сервера
- добавлен минимальный контур `Vitest`
- добавлены базовые тесты для `health` и `ping`
- добавлен baseline `GitHub Actions` workflow для `lint`, `typecheck`, `test`, `prisma validate`, `prisma generate`

Не подтверждено автоматической проверкой в текущей среде:

- `pnpm install`
- `pnpm lint`
- `pnpm test`
- `pnpm typecheck`
- `pnpm prisma validate`
- `pnpm prisma generate`

Причина:

- в текущей среде отсутствуют `node` и `pnpm` в `PATH`, поэтому bootstrap был собран вручную в совместимой структуре без реального install/runtime-прогона

## Критерии завершения

- есть стартовое приложение на `Next.js`
- `pnpm-lock.yaml` появится после первого локального `pnpm install`
- подготовлена конфигурация для `Prisma`
- подготовлена базовая документация по запуску
- структура каталогов не противоречит `code-structure.md`
- UI-основа на `Tailwind CSS` и `shadcn/ui` подключена
- `Zod` подключен как единый слой схем
- baseline CI-проверки описаны и подготовлены в workflow
- минимальный тестовый контур на `Vitest` подготовлен
