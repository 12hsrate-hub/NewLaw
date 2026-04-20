# Lawyer5RP MVP

## Что это

`Lawyer5RP MVP` — единое full-stack веб-приложение для подготовки документных сценариев внутри экосистемы GTA5RP.
Главный сценарий MVP — создание жалобы в ОГП с итоговой генерацией форумного BBCode.

На текущем этапе репозиторий содержит стартовую документацию проекта, инфраструктурные заготовки для production и временную maintenance page.
Прикладной код продукта пока не добавлялся.

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

## Полезные команды

Проверка SSH-доступа:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\check-prod-access.ps1
```

Выкладка текущей maintenance page:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-prod.ps1
```

## Что дальше

Следующий шаг после этой документации — bootstrap самого приложения на зафиксированном стеке и реализация этапов из `docs/plans`.
