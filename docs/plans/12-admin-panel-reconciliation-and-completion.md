# План 12: Admin Panel Reconciliation and Completion

## Статус

`partial`

- current repo уже содержит working internal/admin foundations в transitional `/app/admin-laws` и `/app/admin-security`
- `12.2` добавляет target contour `/internal/...`
- `12.3` переносит corpus sections в `/internal/laws` и `/internal/precedents`, но ещё не закрывает security/health migration

## Что уже есть после 12.3

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
- corpus pages внутри `/internal/...` больше не зависят от `AppShellHeader`, active `/app` shell server и `/app` layout assumptions

## Что ещё не сделано

- migration admin account-security flow в `/internal/security`
- internal health details beyond foundation-level skeleton
- release dashboard
- publication/forum diagnostics suite
- global `/app` migration

## Зафиксированная policy

- `/internal/...` — target contour для super_admin и platform tools
- `/account/security` остаётся self-service зоной владельца аккаунта
- `/internal/security` later отвечает за admin actions над чужими аккаунтами
- `/app/admin-laws` и `/app/admin-security` пока остаются transitional и не удаляются на шаге `12.3`
- corpus migration в `/internal/laws` и `/internal/precedents` не расширяет law/precedent functionality, а только переносит уже существующие section-level foundations в новый internal contour
