# MVP Closure Snapshot

## Статус

Текущий agreed MVP можно считать формально закрытым.

Это решение опирается на фактическое состояние репозитория, production release flow и уже закрытые reconciliation-линии:

- deploy/release hardening закрыт enough-for-current-scope
- `/app` cleanup закрыт enough-for-current-scope
- admin/internal contour закрыт enough-for-current-scope
- account zone, server hub, document area, claims family и internal contour уже существуют как реальные рабочие модули

## Что считается закрытым в рамках MVP

- account zone:
  - `/account`
  - `/account/security`
  - `/account/characters`
  - `/account/documents`
- public and server-scoped routes:
  - `/assistant`
  - `/assistant/[serverSlug]`
  - `/servers`
  - `/servers/[serverSlug]`
  - `/servers/[serverSlug]/documents/...`
- internal contour:
  - `/internal`
  - `/internal/laws`
  - `/internal/precedents`
  - `/internal/security`
  - `/internal/health`
- production release model:
  - `systemd`
  - immutable releases
  - `current` symlink
  - shared env
  - preflight / smoke / rollback helpers

## Что не считается незакрытым MVP-блокером

- standalone trustors registry
- forum automation как обязательная пользовательская capability
- deeper deploy tooling beyond already proven release flow
- broad document-AI suite beyond current MVP AI scope

## Как трактовать оставшиеся линии

### Future expansion

- grounded document AI v2
- optional trustors registry
- deeper admin/internal maturity

### Optional / temporary

- forum automation line

### Post-MVP

- template documents
- removal of temporary forum automation capability

## Freeze Policy

После этой точки:

- новые обязательные MVP-блоки не добавляются задним числом
- `trustors` не возвращаются в required MVP scope
- forum automation не возвращается в required MVP scope
- `AI partial` трактуется только как future expansion beyond current MVP AI scope
- `/app` остаётся compatibility surface, а не primary product zone
