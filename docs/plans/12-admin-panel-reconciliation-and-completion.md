# План 12: Admin Panel Reconciliation and Completion

## Статус

`partial`

- current repo уже содержит working internal/admin foundations в transitional `/app/admin-laws` и `/app/admin-security`
- `12.2` добавляет target contour `/internal/...`, но ещё не переносит туда feature content

## Что уже есть после 12.2

- shared internal layout и nav:
  - `/internal`
  - `/internal/laws`
  - `/internal/precedents`
  - `/internal/security`
  - `/internal/health`
- auth-required + `super_admin`-only guard для нового internal contour
- honest denied flow для авторизованного non-super-admin
- separate internal zone, не смешанная с account zone, server hub и user-facing routes

## Что ещё не сделано

- migration содержимого из `/app/admin-laws` в `/internal/laws` и `/internal/precedents`
- migration admin account-security flow в `/internal/security`
- internal health details beyond foundation-level skeleton
- release dashboard
- publication/forum diagnostics suite
- global `/app` migration

## Зафиксированная policy

- `/internal/...` — target contour для super_admin и platform tools
- `/account/security` остаётся self-service зоной владельца аккаунта
- `/internal/security` later отвечает за admin actions над чужими аккаунтами
- `/app/admin-*` пока остаются transitional и не удаляются на шаге `12.2`
