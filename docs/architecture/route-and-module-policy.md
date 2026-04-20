# Route and Module Policy

## Цель документа

Зафиксировать целевую архитектуру размещения модулей на сайте так, чтобы:

- личный кабинет оставался отдельной account zone
- server-scoped пользовательские модули жили отдельно от кабинета
- internal `super_admin` и platform tools жили отдельно от пользовательской зоны
- текущее transitional состояние на `/app` не воспринималось как долгосрочный default для всех новых блоков

Детальные frozen product decisions, которые опираются на эту route-policy, собраны отдельно в [frozen-product-decisions.md](./frozen-product-decisions.md).

## Почему `/app` не должен быть универсальным контейнером

`/app` в текущем коде уже используется как transitional protected shell и внутренняя рабочая зона ранних блоков.

Этого недостаточно как target-архитектуры для всего проекта, потому что:

- личный кабинет и рабочие server-scoped модули имеют разную смысловую роль
- assistant не зависит от active character и не должен жить внутри account zone
- document modules работают в явном server context и не должны брать сервер из last-used shell state
- internal corpus tools и другие platform-level инструменты не являются частью пользовательского кабинета

Поэтому новые крупные модули не должны автоматически проектироваться внутрь `/app`.

## Target route policy

### Account zone

- `/account`
- `/account/security`
- `/account/characters`
- `/account/documents`

Смысл:

- `/account` — это личный кабинет пользователя
- `/account/security` — безопасность аккаунта
- `/account/characters` — profile-management персонажей
- `/account/documents` — личный обзор “мои документы”, а не основной рабочий маршрут document flow

### Assistant

- `/assistant`
- `/assistant/[serverSlug]`

Смысл:

- assistant живёт отдельно от кабинета
- `serverSlug` является source of truth для server context
- assistant не зависит от `/app` shell, active character и account zone

### Server-scoped user modules

- `/servers/[serverSlug]`
- `/servers/[serverSlug]/documents`
- `/servers/[serverSlug]/documents/ogp-complaints`
- `/servers/[serverSlug]/documents/claims`
- `/servers/[serverSlug]/documents/templates`
- `/servers/[serverSlug]/documents/templates/advocate-request`

Смысл:

- это server-scoped функциональные зоны
- они не описываются как разделы личного кабинета
- complaint flow, claims и post-MVP template documents — это отдельные document modules, а не подразделы account zone

### Internal contour

- `/internal/...`

Смысл:

- law corpus
- precedents corpus
- import workflows
- review/current workflows
- другие platform-level internal инструменты

Эти инструменты не должны описываться как часть пользовательского кабинета.
`/admin/...` не считается target-default namespace для таких platform tools.

## Что относится к личному кабинету

К account zone относятся:

- профиль аккаунта
- безопасность
- персонажи как profile-management сущность
- персональные данные и настройки
- личный обзор документов

Кабинет не должен трактоваться как универсальный контейнер для всех рабочих пользовательских сценариев.

## Что относится к отдельным server-scoped functional modules

К отдельным server-scoped модулям относятся:

- assistant
- complaint flow
- claims
- server-specific template documents
- другие future document modules, завязанные на конкретный сервер

Для таких модулей сервер задаётся через URL, а не через last-used state.

## Что относится к internal / super_admin contour

К internal contour относятся:

- law corpus
- precedents corpus
- import/review/current workflows
- platform-level internal инструменты

Это отдельный `super_admin` и platform слой, а не часть личного кабинета пользователя.

## Правило server context

- source of truth по серверу для server-scoped модулей — URL
- `serverSlug` должен быть стабильным machine key
- display name сервера может меняться отдельно
- `serverSlug` не должен рассматриваться как свободно редактируемое пользовательское имя
- last-used state допустим только как UX-default, но не как реальный source of truth

## Правило character context

- персонаж может подставляться как last-used UX-default для выбранного сервера
- пользователь всегда должен явно видеть, какой сервер и какой персонаж выбраны
- после старта документа персонаж фиксируется в snapshot документа
- `/account/characters` описывается как profile-management зона, а не как рабочий центр document flow

## Переходное правило

Проект ещё не считается полностью переехавшим с `/app` на новую структуру.

На данный момент:

- `/app` и связанные текущие маршруты — это текущее transitional состояние реализации
- это не должно трактоваться как долгосрочный ориентир для всех новых крупных модулей

Новые блоки и будущий рефактор должны ориентироваться на:

- `/account`
- `/assistant`
- `/assistant/[serverSlug]`
- `/servers/[serverSlug]`
- `/servers/[serverSlug]/documents/...`
- `/internal/...`

## Что новые блоки должны делать

Новые крупные блоки должны:

- явно выбирать, являются ли они account zone, server-scoped module или internal tool
- использовать route policy, соответствующую их смыслу
- не проектироваться автоматически внутрь `/app`
- не смешивать account zone, assistant, document modules и internal platform tools в один универсальный namespace
