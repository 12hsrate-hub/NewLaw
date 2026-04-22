# 14 — `/app` Migration / Cleanup

## Статус блока

Блок остаётся в работе.

Текущее состояние:

- `14.1` — архитектурный cleanup plan зафиксирован
- `14.2` — safe auth/default landing cleanup выполнен
- `14.3` — character bridge migration off `/app` выполнен
- `14.4` — `/app/security` migration выполнен
- `14.5` — `/app` root degradation выполнен
- global cleanup ещё не начат

## Цель блока

Довести проект до состояния, где `/app` больше не является primary user-facing default zone:

- auth fallback и default landing идут в target account zone
- server-scoped и internal маршруты продолжают жить вне `/app`
- `/app` остаётся только transitional compatibility surface там, где это ещё оправдано

## 14.2 — Auth / Default Landing Cleanup

Что входит:

- default authenticated landing меняется с `/app` на `/account`
- fallback `nextPath` logic больше не использует `/app` как implicit target
- valid explicit deep links сохраняются
- invalid или unsafe `next` возвращается в `/account`

Что сознательно не входит:

- `14.3` character bridge migration
- migration `/app/security`
- server/document empty-state bridge cleanup
- global `/app` cleanup

## Что зафиксировано после 14.2

- auth flows без explicit `next` теперь должны вести в `/account`
- safe fallback для missing/invalid/unsafe `next` = `/account`
- explicit valid `next` по-прежнему может вести в:
  - `/assistant/...`
  - `/servers/...`
  - `/servers/[serverSlug]/documents/...`
  - `/internal/...`
  - `/account/...`
  - `/app`, если это явно переданный bookmark/deep link
- `/app` остаётся рабочим transitional surface, но больше не используется как default landing

## Что зафиксировано после 14.3

- `needs_character` bridges больше не ведут в generic `/app`
- canonical focused bridge для server-scoped create-entry теперь такой:
  - `/account/characters?server=<serverCode>#create-character-<serverCode>`
- server hub и document-area empty states ведут в account zone сразу к нужной server group
- `/account/characters` остаётся profile-management зоной и не превращается в server workflow hub
- `/app/security` и global `/app` cleanup по-прежнему не входят в этот шаг

## Следующие code-steps

### 14.3 — Character bridge migration off `/app`

Что вошло:

- перевод `needs_character` bridges с `/app` на focused `/account/characters`
- server-aware bridge target с `?server=<code>` и focused create entry

### 14.4 — `/app/security` migration

Что вошло:

- canonical self-service security target теперь `/account/security`
- `must-change-password`, `email-change-confirmed`, `email-change-requested` и `admin-access-denied` continuations больше не используют `/app/security` как primary route
- `/app/security` теперь работает как compatibility redirect на `/account/security` с сохранением статуса и legacy query semantics
- `/app` root cleanup и другие `/app` migration steps в этот шаг не входят

### 14.5+ — Long-tail `/app` cleanup

### 14.5 — `/app` root degradation

Что вошло:

- `/app` больше не позиционируется как primary workspace
- route остаётся protected и не уходит в hard redirect
- `/app` теперь работает как honest compatibility surface с safe links в:
  - `/account`
  - `/account/characters`
  - `/servers`
  - `/internal` только для `super_admin`
- active server / active character summary и `UserServerState` не удаляются, но остаются только как compatibility context
- `/app` больше не рендерит character-management block как основной рабочий центр

### 14.6+ — Long-tail `/app` cleanup

Что должно войти позже:

- финальная зачистка оставшегося `/app` после уже выполненной деградации root до compatibility shell
- уборка remaining `/app/admin-*` fallback defaults внутри shared internal code
- финальный reconciliation snapshot по surviving `/app` routes
