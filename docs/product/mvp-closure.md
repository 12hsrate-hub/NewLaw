# MVP Closure Snapshot

## Статус

Текущий agreed MVP можно считать формально закрытым.

Это решение опирается на фактическое состояние репозитория и production release flow:

- account zone, server hub и internal contour уже существуют как реальные рабочие зоны
- `server legal assistant` уже существует как отдельный модуль
- OGP complaint flow уже существует как рабочий persisted document flow
- claims family уже существует как отдельная user-facing document line
- current production runtime и release runbook уже зафиксированы и реально используются

## Что считается закрытым в рамках current agreed MVP

- `/account`, `/account/security`, `/account/characters`, `/account/documents`
- `/assistant`, `/assistant/[serverSlug]`
- `/servers`, `/servers/[serverSlug]`, `/servers/[serverSlug]/documents/...`
- `/internal`, `/internal/laws`, `/internal/precedents`, `/internal/security`, `/internal/health`
- OGP complaint flow
- claims family
- current MVP AI scope
- production release foundation через `systemd + release directories + current symlink`

## Что не считается незакрытым MVP-блокером

- `/account/trustors` как convenience layer
- forum automation как обязательная пользовательская capability
- broader document-AI suite beyond current helper scope
- template documents как отдельная post-MVP линия
- `Docker Compose` migration

## Что уже есть в repo как post-MVP expansion

Эти линии не переоткрывают MVP, а живут поверх него:

- `attorney_request`
- `legal_services_agreement`

## Freeze policy

После этой точки:

- новые обязательные MVP-блоки не добавляются задним числом
- `trustors` не возвращаются в required MVP scope
- forum automation не возвращается в required MVP scope
- broad AI-suite не притворяется частью незакрытого MVP
- `/app` остаётся compatibility surface, а не primary product zone
