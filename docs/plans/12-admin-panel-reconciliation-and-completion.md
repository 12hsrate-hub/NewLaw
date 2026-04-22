# План 12: Admin Panel Reconciliation and Completion

## Статус

`partial`

- current repo уже содержит working internal/admin foundations в transitional `/app/admin-laws` и `/app/admin-security`
- `12.2` добавляет target contour `/internal/...`
- `12.3` переносит corpus sections в `/internal/laws` и `/internal/precedents`
- `12.4` переносит admin account-security flow в `/internal/security`, но health migration ещё не закрыта

## Что уже есть после 12.4

- shared internal layout и nav:
  - `/internal`
  - `/internal/laws`
  - `/internal/precedents`
  - `/internal/security`
  - `/internal/health`
- auth-required + `super_admin`-only guard для нового internal contour
- honest denied flow для авторизованного non-super-admin
- separate internal zone, не смешанная с account zone, server hub и user-facing routes
- `/internal/laws` уже выступает target route для:
  - server-specific law source indexes
  - law discovery/import status
  - current/draft review controls
  - retrieval preview
  - bootstrap/corpus readiness summary
- `/internal/precedents` уже выступает target route для:
  - source topics
  - discovery/import state
  - extracted precedents
  - validity/current review controls
  - import summaries
- `/internal/security` уже выступает target route для:
  - account lookup по `email`, `login` и `accountId`
  - admin security actions над чужими аккаунтами
  - account-level status summary
- `/internal/security` использует shared `/internal` nav/layout и не зависит от `AppShellHeader`, active `/app` shell server и account zone layout assumptions
- corpus pages внутри `/internal/...` больше не зависят от `AppShellHeader`, active `/app` shell server и `/app` layout assumptions

## Что ещё не сделано

- internal health details beyond foundation-level skeleton
- release dashboard
- publication/forum diagnostics suite
- global `/app` migration

## Зафиксированная policy

- `/internal/...` — target contour для super_admin и platform tools
- `/account/security` остаётся self-service зоной владельца аккаунта
- `/internal/security` отвечает за admin actions над чужими аккаунтами и не смешивается с `/account/security`
- `/app/admin-laws` и `/app/admin-security` пока остаются transitional и не удаляются на шагах `12.3`–`12.4`
- corpus migration в `/internal/laws` и `/internal/precedents` не расширяет law/precedent functionality, а только переносит уже существующие section-level foundations в новый internal contour
- internal security migration в `/internal/security` не расширяет admin-security feature scope, а только переносит уже существующий account lookup и admin actions в новый internal contour
