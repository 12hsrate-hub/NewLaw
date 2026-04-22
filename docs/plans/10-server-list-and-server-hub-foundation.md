# 10 — Server List and Server Hub Foundation

## Статус блока

Блок открыт.

Зафиксировано:

- `/servers` — public server directory
- `/servers/[serverSlug]` — future auth-gated server hub
- source of truth по серверу — только `serverSlug` из URL
- новые user-facing модули не должны возвращаться в `/app`
- server list / hub не должны ломать уже работающие `/assistant` и `/servers/[serverSlug]/documents/...`

## Цель блока

Добавить отдельную server-scoped entry zone так, чтобы:

- пользователь видел публичный список серверов и состояние доступных модулей
- server-scoped модули не зависели от active server из `/app` shell
- `/assistant` и document area получили понятную навигационную точку входа
- future server hub можно было добавить отдельным следующим шагом без route migration и без product refactor

## Зафиксированная архитектура

### Route contract

- `/servers`
- `/servers/[serverSlug]`

На текущем подшаге реализуется только:

- `/servers`

`/servers/[serverSlug]` остаётся следующим шагом и не должен появляться раньше времени как half-ready hub.

### Visibility policy

- `/servers` видят и гость, и авторизованный пользователь
- `/servers/[serverSlug]` later требует auth
- `/assistant/[serverSlug]` остаётся public module route
- `/servers/[serverSlug]/documents` остаётся private server-scoped route

### Summary contract

Public directory summary layer должен уметь отдавать минимум:

- `id`
- `code`
- `slug`
- `name`
- `directoryAvailability`
  - `active`
  - `maintenance`
  - `unavailable`
- `assistantStatus`
  - `no_corpus`
  - `corpus_bootstrap_incomplete`
  - `current_corpus_ready`
  - `corpus_stale`
  - `assistant_disabled`
  - `maintenance_mode`
- `documentsAvailabilityForViewer`
  - `requires_auth`
  - `needs_character`
  - `available`
  - `unavailable`
- `availableModules`
  - `assistant`
  - `documents`

### UI policy

На карточке сервера показываются:

- server name
- `serverSlug/code`
- compact availability label
- compact assistant availability label
- module actions:
  - `Assistant`
  - `Documents`

Не показываются:

- private document counts
- private document titles
- internal corpus diagnostics
- raw import failures
- internal recovery actions

### Viewer-aware documents availability

- guest -> `requires_auth`
- auth + no character on server -> `needs_character`
- auth + has character on server -> `available`
- unavailable server -> `unavailable`

Это только summary layer. Новый documents workflow и новый auth flow в этот блок не входят.

## Подшаги

### 10.2 — Public server directory

Что входит:

- public route `/servers`
- отдельный directory summary service без зависимости от `/app` shell
- server cards с `Assistant` и `Documents`
- viewer-aware documents availability
- honest empty / unavailable states

Что не входит:

- `/servers/[serverSlug]` hub
- public laws viewer
- route migration старого `/app`
- новые document flows
- internal corpus refactor

Текущий результат шага:

- `/servers` уже существует как public route и не требует auth
- directory summary layer больше не зависит от active server из `/app`
- карточки серверов уже показывают:
  - `name`
  - `slug/code`
  - compact availability
  - compact assistant availability
  - `Assistant` action на существующий `/assistant/[serverSlug]`
  - viewer-aware `Documents` state
- guest видит честный `requires_auth` для documents
- авторизованный viewer получает `available` или `needs_character`
- unavailable servers не исчезают из directory, а остаются видимыми как состояние

Operational note текущего шага:

- в persisted model сервера пока нет отдельного explicit maintenance flag
- поэтому `10.2` уже резервирует contract для `maintenance`, `assistant_disabled`, `corpus_stale` и `maintenance_mode`, но текущий summary layer реально вычисляет только те состояния, которые можно честно вывести из уже существующих сигналов
- это не считается internal corpus refactor и не меняет future health vocabulary

### 10.3 — Auth-gated server hub

Что later должно войти:

- `/servers/[serverSlug]`
- owner/auth-aware module cards:
  - `Assistant`
  - `Documents`
- honest states:
  - `server_not_found`
  - `server_unavailable`
  - `needs_character`
- навигационные links в уже существующие:
  - `/assistant/[serverSlug]`
  - `/servers/[serverSlug]/documents`

Что не должно смешиваться:

- route migration старого `/app`
- forum automation
- claims/template docs implementation
- public laws viewer
- internal law corpus refactor

## Acceptance criteria

### Архитектура готова

- `/servers` зафиксирован как public entry point
- `/servers/[serverSlug]` зафиксирован как future auth-gated hub
- source of truth по серверу — URL, а не active shell server
- directory summary отделён от private document data
- claims и OGP остаются внутри `Documents`, а не превращаются в top-level module cards

### Можно идти в code-step

- route contract для `/servers` и `/servers/[serverSlug]` уже зафиксирован
- summary contract server directory уже определён
- access policy для guest/auth viewer уже зафиксирована
- relation с `/assistant` и `/servers/[serverSlug]/documents` уже описана
- health/status vocabulary уже согласован на user-facing уровне
