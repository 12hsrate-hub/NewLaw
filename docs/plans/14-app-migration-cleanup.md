# 14 — `/app` Migration / Cleanup

## Статус блока

Блок остаётся в работе.

Текущее состояние:

- `14.1` — архитектурный cleanup plan зафиксирован
- `14.2` — safe auth/default landing cleanup выполнен
- `14.3` — character bridge migration off `/app` выполнен
- `/app/security` migration и global cleanup ещё не начаты

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

Что должно войти:

- перевод self-service security flows на `/account/security`
- сохранение `must-change-password`, `email-change-confirm` и denied semantics
- превращение `/app/security` в compatibility route

### 14.5+ — Long-tail `/app` cleanup

Что должно войти позже:

- деградация `/app` root до honest compatibility shell
- уборка remaining `/app/admin-*` fallback defaults внутри shared internal code
- финальный reconciliation snapshot по surviving `/app` routes
