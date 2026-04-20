# Lawyer5RP MVP

## Что это

`Lawyer5RP MVP` — единое full-stack веб-приложение для подготовки документных сценариев внутри экосистемы GTA5RP.
Главный сценарий MVP — создание жалобы в ОГП с итоговой генерацией форумного BBCode.

На текущем этапе репозиторий содержит стартовую документацию проекта, bootstrap-каркас приложения, foundation для `Supabase Auth` и минимального data layer, базовый защищённый пользовательский контур для работы с персонажами, инфраструктурные заготовки для production и временную maintenance page.
Прикладная бизнес-логика документов пока не реализована, но вход, защищённый shell, выбор сервера, выбор активного персонажа и ручное управление персонажами уже подготовлены.

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
- Deployment на VPS целится в `Docker Compose`

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
- [src/app/sign-in](./src/app/sign-in) — публичная страница входа по email
- [src/app/auth/confirm](./src/app/auth/confirm) — callback-обработчик подтверждения входа
- [src/app/(protected)/app](./src/app/%28protected%29/app) — защищённая часть приложения с app shell
- [src/components](./src/components) — разделение базовых UI-компонентов и продуктовых компонентов
- [src/server](./src/server) — серверные действия, технические обработчики и серверные модули
- [src/server/auth](./src/server/auth) — server-side auth helpers для текущей сессии, пользователя и безопасной проверки авторизации
- [src/server/characters](./src/server/characters) — минимальная серверная логика ручного создания персонажа с бизнес-ограничениями
- [src/server/app-shell](./src/server/app-shell) — серверная логика активного сервера и активного персонажа
- [src/db](./src/db) — Prisma client, seed-структура и репозитории
- [src/lib/supabase](./src/lib/supabase) — runtime-обвязка `Supabase Auth` для browser/server/middleware
- [src/schemas](./src/schemas) — `Zod`-схемы
- [vitest.config.ts](./vitest.config.ts) — минимальная конфигурация `Vitest`
- [.github/workflows/ci.yml](./.github/workflows/ci.yml) — baseline CI для lint/typecheck/test/prisma
- [prisma/schema.prisma](./prisma/schema.prisma) — Prisma-схема foundation для `Account`, `Server`, `UserServerState`, `Character`, `CharacterRole`, `CharacterAccessFlag`
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
- [docs/plans/01-bootstrap.md](./docs/plans/01-bootstrap.md) ... [docs/plans/09-deploy-and-release.md](./docs/plans/09-deploy-and-release.md) — поэтапные планы
- [docs/prod-access.md](./docs/prod-access.md) — текущий доступ к production-серверу
- [scripts/check-prod-access.ps1](./scripts/check-prod-access.ps1) — быстрая проверка SSH-доступа
- [scripts/deploy-prod.ps1](./scripts/deploy-prod.ps1) — текущая команда выкладки maintenance page
- [deploy/nginx/newlaw.conf](./deploy/nginx/newlaw.conf) — текущий `nginx`-конфиг
- [site/index.html](./site/index.html) — временная страница технических работ

## Production сейчас

Сейчас production-сервер обслуживает временную заглушку и HTTPS уже настроен на домене `lawyer5rp.ru`.
Это техническая стадия до старта прикладной разработки.

## Текущий пользовательский контур

В приложении уже собран минимальный рабочий контур шага `03`:

- публичный вход по email через `Supabase Auth`
- защищённая часть `/app`
- app shell с выбором активного сервера
- выбор активного персонажа в контексте сервера
- список персонажей по выбранному серверу
- ручное создание и редактирование персонажей

Бизнес-ограничения этого слоя уже работают на серверной стороне:

- максимум `3` персонажа на сервер для одного аккаунта
- запрет одинакового паспорта в рамках `account + server`
- `nickname = fullName`
- роли и `access_flags` привязаны к `character_id`

## Полезные команды

После установки `Node.js` и `pnpm`:

```powershell
pnpm install
pnpm prisma:generate
pnpm dev
```

Для локального auth/db foundation также нужны переменные окружения из `.env.local.example`:

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

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

Следующий шаг после auth shell и управления персонажами — развивать документные сценарии поверх уже подготовленного пользовательского контура по этапам из `docs/plans`.
