# Testing and Debug

## Назначение

Этот документ фиксирует baseline проверок, smoke-тестов и наблюдаемости для MVP.

## CI baseline

В baseline CI должны входить:

- `GitHub Actions`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm prisma validate`
- `pnpm prisma generate`

## Smoke e2e

Для MVP нужен базовый smoke e2e-контур.

Минимальная цель:

- запуск нескольких smoke-сценариев
- проверка, что приложение поднимается и ключевые точки входа отвечают

Конкретная реализация smoke e2e может меняться по мере operational maturity и не должна становиться скрытой зависимостью production deploy.

## Trace и HTML report

Для smoke e2e должны быть доступны:

- `trace`
- `HTML report`

Они нужны для разборов падений и ручной диагностики после CI или предрелизной проверки.

## Health endpoint

В приложении должен быть технический endpoint:

- `/api/health`

Он используется для:

- smoke-check после деплоя
- базовой автоматической проверки доступности приложения

## Runtime logs

В production и staging должны быть доступны runtime logs приложения.

Они нужны для:

- быстрой диагностики падений
- проверки серверных ошибок
- разбора проблем после релиза

## Audit и AI журналы

Для MVP должны существовать и использоваться:

- `audit_logs`
- `ai_requests`

`audit_logs` нужны для фиксации значимых действий внутри приложения.
`ai_requests` нужны для логирования всех AI-вызовов.

## Ручной smoke-check перед релизом

Перед релизом обязателен ручной smoke-check.

Минимально он должен включать:

- проверку `/api/health`
- вход в приложение
- базовую загрузку ключевых экранов
- проверку критического сценария без явных ошибок

## Связанные документы

- [deployment.md](./deployment.md)
- [git-workflow.md](./git-workflow.md)
- [stack.md](./stack.md)
