# Route and Module Policy

## Цель документа

Зафиксировать актуальную route-policy проекта так, чтобы:

- личный кабинет оставался отдельной account zone
- server-scoped пользовательские модули жили отдельно от кабинета
- internal `super_admin` и platform tools жили отдельно от пользовательской зоны
- `/app` не воспринимался как долгосрочный default для новых модулей

## Текущая целевая карта зон

### Account zone

- `/account`
- `/account/security`
- `/account/characters`
- `/account/documents`
- `/account/trustors`

Смысл:

- это личный кабинет и account-scoped convenience layers
- `/account/documents` — обзор “мои документы”, а не основной editor center
- `/account/trustors` — reusable registry convenience layer, а не центр document flow

### Assistant

- `/assistant`
- `/assistant/[serverSlug]`

Смысл:

- assistant живёт отдельно от кабинета
- server context для assistant берётся из URL
- assistant не зависит от `/app`, active character и account zone

### Server-scoped user modules

- `/servers`
- `/servers/[serverSlug]`
- `/servers/[serverSlug]/documents`
- `/servers/[serverSlug]/documents/ogp-complaints`
- `/servers/[serverSlug]/documents/claims`
- `/servers/[serverSlug]/documents/attorney-requests`
- `/servers/[serverSlug]/documents/legal-services-agreements`

Смысл:

- это отдельные server-scoped functional modules
- они не должны описываться как подразделы личного кабинета
- новые document families должны получать явный family slug внутри `/servers/[serverSlug]/documents/...`, а не уходить в generic `/templates/...`

### Internal contour

- `/internal/...`

Смысл:

- law corpus
- precedents corpus
- internal security
- internal health
- другие `super_admin`/platform tools

## Правило server context

- source of truth для server-scoped модулей — URL
- `serverSlug` не подменяется last-used shell state
- last-used state допустим только как UX-default

## Правило character context

- персонаж может подставляться как last-used UX-default для выбранного сервера
- пользователь всегда должен явно видеть, какой сервер и какой персонаж выбраны
- после first save персонаж фиксируется в snapshot документа
- `/account/characters` остаётся profile-management зоной

## Правило trustor context

- trustor inside document всегда живёт как snapshot
- `/account/trustors` не становится обязательной runtime dependency document flows
- choose-from-registry допустим только как convenience prefill

## Переходное правило для `/app`

Проект больше не должен проектировать новые крупные user-facing модули внутрь `/app`.

На текущем этапе:

- `/app` и legacy подмаршруты допустимы только как compatibility surface
- canonical target zones: `/account`, `/assistant`, `/servers`, `/internal`

## Что должны делать новые блоки

Новые крупные блоки должны:

- явно определять, являются ли они account zone, server-scoped module или internal tool
- использовать route policy, соответствующую их смыслу
- не проектироваться автоматически внутрь `/app`
- не смешивать account zone, assistant, document modules и internal/platform tools в один namespace
