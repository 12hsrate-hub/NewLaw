# План 09: Deploy and Release

## Цель этапа

Подготовить первый production rollout на VPS и зафиксировать повторяемый релизный процесс.

## Что входит

- production build и запуск приложения
- настройка `Docker Compose`
- настройка reverse proxy
- подключение production `env`
- проверка Prisma-миграций
- smoke-check после выкладки

## Что не входит

- полноценный автоматический CI/CD как обязательная часть MVP
- kubernetes и сложная orchestration-схема

## Основные задачи

1. Подготовить production-каталог приложения на VPS.
2. Подготовить `Docker Compose` для production и staging процессов.
3. Перенастроить reverse proxy с maintenance page на приложение.
4. Подготовить deployment-команду или deployment-скрипт для production rollout.
5. Подключить `/api/health`, runtime logs и ручной smoke-check к релизному процессу.
6. Зафиксировать release checklist.
7. Проверить `feature/* -> staging -> main` как рабочий поток.

## Release checklist

1. Все обязательные документы и миграции в репозитории актуальны.
2. Локальная проверка успешно завершена.
3. Изменения закоммичены и отправлены в GitHub.
4. Merge-путь через нужную ветку завершен корректно.
4. На VPS установлены актуальные `env`-переменные.
5. Prisma-миграции применены.
6. Production build завершен.
7. Контейнеры подняты через `Docker Compose`.
8. Reverse proxy проксирует запросы корректно.
9. `/api/health` отвечает корректно.
10. Выполнен smoke-check основных пользовательских сценариев.
11. При необходимости сохранены `Playwright` trace и `HTML report`.

## Критические правила этапа

- production хостится на `Ubuntu 24.04 LTS`
- деплой идет через GitHub как источник актуального кода
- приложение остается единым full-stack проектом
- secrets не попадают в репозиторий
- staging и production используют раздельные `env` и отдельные процессы

## Критерии завершения

- production обслуживает приложение, а не только maintenance page
- релизный путь повторяем и документирован
- базовые smoke-check проверки проходят успешно
