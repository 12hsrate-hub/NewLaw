# AGENTS.md

## Назначение

Это активный репозиторий проекта `NewLaw / Lawyer5RP MVP`, а не только bootstrap-набор документации.
Если задача ограничена документацией, планами, README, архивом или согласованием формулировок, код приложения менять не нужно.

## Языковая политика

- вся человекочитаемая документация, планы, changelog-описания и комментарии пишутся только на русском языке
- machine keys, кодовые идентификаторы, маршруты, env-переменные, таблицы, колонки и имена файлов продукта — только на английском языке

## Актуальный статус репозитория

- current agreed MVP формально закрыт
- новые крупные изменения нельзя маскировать под “ещё нужно для MVP”
- всё новое должно описываться как:
  - future expansion
  - optional capability
  - post-MVP line
  - operational maturity

В репозитории уже существуют:

- account zone: `/account/...`
- assistant: `/assistant/...`
- server hub и server-scoped documents: `/servers/...`
- internal contour: `/internal/...`
- document families:
  - `ogp_complaint`
  - `rehabilitation`
  - `lawsuit`
  - `attorney_request`
  - `legal_services_agreement`

`/app` больше не является основной product zone и должен трактоваться только как transitional / compatibility surface.

## Актуальная route policy

Перед любыми продуктово-архитектурными решениями сверяться с:

- [docs/product](./docs/product)
- [docs/architecture](./docs/architecture)
- [docs/plans](./docs/plans)

Целевые зоны проекта:

- `/account` — account zone
- `/assistant` — отдельный assistant module
- `/servers` — public/server-scoped entry layer
- `/servers/[serverSlug]/documents/...` — document area
- `/internal` — internal/super-admin contour
- `/app` — только compatibility layer

## Актуальные продуктовые правила

- базовая иерархия: `Account -> Server -> Characters -> Documents`
- trustors привязаны к `user + server`, а document flows остаются snapshot-based
- `/account/trustors` — convenience layer, а не обязательная runtime dependency documents
- подпись для template/PDF/JPG documents хранится на уровне персонажа как отдельный asset и фиксируется в document snapshot
- forum automation — optional / temporary capability, не required MVP success path
- current AI scope уже не пустой:
  - `server legal assistant`
  - document field rewrite v1
  - first grounded legal rewrite v2 rollout

## Deployment truth

Текущий production runtime:

- `systemd`
- immutable `release directories`
- `current` symlink
- shared env вне release-каталогов

`Docker Compose` сейчас не является каноническим runtime и не должен описываться как текущий blocker или обязательный deployment path.
Это future operational target.

## Правила работы с документацией

- перед изменениями сверяться с `docs/product`, `docs/architecture`, `docs/plans`
- если меняется продуктовая логика или архитектурная policy, сначала обновляются документы, потом код
- если задача docs-only, код приложения не меняется
- завершённые планы не оставляются в `docs/plans` как активные задачи:
  - полезную историю переносить в `docs/archive/...`
  - активными оставлять только текущие source-of-truth и реально незакрытые future/post-MVP линии
