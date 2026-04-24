# 10 — Server List and Server Hub Foundation

## Статус блока

Блок реализован в согласованном scope.

Зафиксировано:

- `/servers` — public server directory
- `/servers/[serverSlug]` — auth-gated server hub
- source of truth по серверу — только `serverSlug` из URL
- новые user-facing модули не должны возвращаться в `/app`
- server list / hub не должны ломать уже работающие `/assistant` и `/servers/[serverSlug]/documents/...`
- account zone уже дополнена через `/account/characters`, shared account subnav и account-scoped character editor completion

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

Текущее фактическое состояние:

- `/servers` уже реализован
- `/servers/[serverSlug]` уже реализован
- follow-up линии `10.5` и `10.6` тоже закрыты и больше не считаются только future notes

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

Что входит:

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

Текущий результат шага:

- `/servers/[serverSlug]` теперь существует как auth-gated server hub
- source of truth по серверу берётся только из `serverSlug` в URL
- guest уходит на sign-in с корректным `next`
- hub показывает только две top-level cards:
  - `Assistant`
  - `Documents`
- unknown `serverSlug` даёт honest `server_not_found`
- inactive server даёт honest `server_unavailable`
- отсутствие персонажа не ломает hub:
  - `Assistant` остаётся доступным по policy
  - `Documents` честно показывает `needs_character` и ведёт во временный bridge персонажей
- claims и OGP complaints не становятся top-level cards hub и остаются внутри `Documents`

Что не должно смешиваться:

- route migration старого `/app`
- forum automation
- claims/template docs implementation
- public laws viewer
- internal law corpus refactor

## Acceptance criteria

### Архитектура реализована

- `/servers` зафиксирован как public entry point
- `/servers/[serverSlug]` уже реализован как auth-gated hub
- source of truth по серверу — URL, а не active shell server
- directory summary отделён от private document data
- claims и OGP остаются внутри `Documents`, а не превращаются в top-level module cards

### Что осталось вне блока

- route migration старого `/app`
- public laws viewer
- новые top-level module cards beyond `Assistant + Documents`
- internal corpus refactor

## Follow-up: 10.5 — `/account/characters` overview + account nav

Этот follow-up не меняет server list / hub policy, но завершает account zone так, чтобы она не конкурировала с server-scoped routes.

Текущий результат шага:

- в общем `account layout` теперь есть shared subnav:
  - `Overview`
  - `Security`
  - `Characters`
  - `Documents`
- появился owner-only маршрут `/account/characters`
- route не зависит от active shell server из `/app`
- страница показывает account-wide grouped overview персонажей по серверам
- для каждой server group теперь видны:
  - `server name`
  - `server code / slug`
  - `character count`
  - informational `default character`
  - список персонажей текущего аккаунта
- на character card показываются:
  - `fullName`
  - `nickname`
  - `passportNumber`
  - `roles`
  - `accessFlags`
  - `isProfileComplete`
  - `hasProfileData` как compact profile summary
  - `isDefaultForServer`
- серверы без персонажей остаются видимыми как отдельные empty-state groups
- create CTA пока ведёт только во временный transitional bridge и не считается migration off `/app`

Что шаг сознательно не делает:

- не переносит full create/edit flows из `/app`
- не превращает `/account/characters` в server hub
- не переносит documents или assistant в account zone
- не меняет route policy для `/servers/[serverSlug]` и `/servers/[serverSlug]/documents/...`

## Follow-up: 10.6 — account-scoped character editor completion

Этот follow-up по-прежнему не меняет server list / hub policy, а только доводит account zone до полноценного character-management уровня.

Текущий результат шага:

- `/account/characters` больше не ограничен read-only overview
- create/edit character UX теперь доступен прямо внутри grouped-by-server account route
- основной экран остаётся account-scoped grouped list, без обязательного nested detail route
- для каждой server group теперь есть:
  - empty state
  - create entry point
  - edit entry points для существующих персонажей
- character editor внутри account zone теперь включает:
  - `fullName`
  - `nickname`
  - `passportNumber`
  - `roles`
  - `accessFlags`
  - compact profile subsection поверх существующего `profileDataJson`
  - `isProfileComplete`
  - informational default-character badge
- `/account/characters` по-прежнему не зависит от active shell server из `/app`
- create/edit в account zone не делают silent active-selection mutation
- реализовано только одно безопасное исключение:
  - если на сервере создаётся первый персонаж
  - и default для этого сервера ещё отсутствует
  - system может сохранить initial default character без скрытого перетягивания active server в transitional `/app`
- focus pattern `/account/characters?server=...` сохранён и пригоден для future bridge CTA
- transitional `/app` characters flow остаётся working и не удаляется

Что шаг сознательно не делает:

- не выполняет route migration старого `/app`
- не удаляет текущий `/app` character flow
- не превращает `/account/characters` в assistant/documents hub
- не меняет document flow logic
- не меняет assistant routes
