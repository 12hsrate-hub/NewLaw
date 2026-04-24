# NewLaw / Lawyer5RP MVP

## Что это

`NewLaw` — основной репозиторий проекта `Lawyer5RP MVP`: единого full-stack приложения для юридических игровых сценариев внутри экосистемы GTA5RP.

Изначальный якорный сценарий MVP — жалоба в ОГП с генерацией итогового форумного `BBCode`.
По текущему состоянию репозитория проект уже сильно шире исходного bootstrap/foundation-среза: в коде есть account zone, server hub, internal contour, `server legal assistant`, persisted document area, `OGP complaints`, claims family и первые post-MVP template documents.

Текущий agreed MVP можно считать **формально закрытым**.
Это означает, что дальнейшее развитие нужно трактовать не как “ещё нужно для MVP”, а как future expansion, optional capability, post-MVP line или operational maturity.

## Текущий продуктовый срез

В репозитории уже есть:

- account zone: `/account`, `/account/security`, `/account/characters`, `/account/documents`, `/account/trustors`
- public/server-scoped входные зоны: `/assistant`, `/assistant/[serverSlug]`, `/servers`, `/servers/[serverSlug]`
- internal contour: `/internal`, `/internal/laws`, `/internal/precedents`, `/internal/security`, `/internal/health`
- document area: `ogp_complaint`, `rehabilitation`, `lawsuit`, `attorney_request`, `legal_services_agreement`
- character/trustor/document snapshot model
- `server legal assistant`
- document AI helpers: field rewrite v1 и first grounded legal rewrite v2 rollout
- production release foundation через `systemd + release directories + current symlink`

Важно:

- `/app` остаётся только transitional / compatibility surface
- forum automation не считается required user-facing MVP capability
- `/account/trustors` — convenience layer, а не blocker document flows
- template documents уже есть в repo как post-MVP expansion, но не переоткрывают закрытый MVP

## Стек

- `Next.js`
- `TypeScript`
- `App Router`
- `Tailwind CSS`
- `shadcn/ui`
- `Zod`
- `Prisma`
- `PostgreSQL` через `Supabase`
- `Supabase Auth`
- `Supabase Storage`
- `OpenAI API` через server-side proxy layer
- `pnpm`

## Что считать закрытым MVP

В рамках current agreed MVP закрыты:

- account/security foundation
- character management и server context
- law corpus и precedents corpus
- `server legal assistant`
- OGP complaint document flow
- claims family
- server directory / server hub
- internal/admin contour
- production release foundation
- route cleanup enough-for-current-scope, где `/app` уже не primary product zone

Подробно это зафиксировано в:

- [docs/product/mvp-scope.md](./docs/product/mvp-scope.md)
- [docs/product/mvp-closure.md](./docs/product/mvp-closure.md)
- [docs/plans/00-master-plan.md](./docs/plans/00-master-plan.md)

## Что относится к future / post-MVP

Не как blockers, а как отдельные линии развития:

- более широкий document AI beyond current helper scope
- deeper trustors expansion beyond current `/account/trustors` CRUD + optional prefill
- дальнейшее развитие template/PDF/JPG documents beyond уже существующих `attorney_request` и `legal_services_agreement`
- deeper operational maturity
- `Docker Compose` как future operational target, а не current runtime requirement

## Куда смотреть в документации

Актуальная карта документации:

- [docs/product/overview.md](./docs/product/overview.md) — краткий продуктовый обзор
- [docs/product/mvp-scope.md](./docs/product/mvp-scope.md) — что входит в current agreed MVP, а что уже future/post-MVP
- [docs/product/mvp-closure.md](./docs/product/mvp-closure.md) — короткий closure snapshot
- [docs/architecture/route-and-module-policy.md](./docs/architecture/route-and-module-policy.md) — актуальная route policy
- [docs/architecture/domain-model.md](./docs/architecture/domain-model.md) — актуальная доменная модель
- [docs/architecture/database.md](./docs/architecture/database.md) — текущее состояние Prisma/data model
- [docs/architecture/deployment.md](./docs/architecture/deployment.md) — source of truth по current production runtime
- [docs/ops/release-runbook.md](./docs/ops/release-runbook.md) — канонический release runbook
- [docs/plans/00-master-plan.md](./docs/plans/00-master-plan.md) — главный актуальный reconciliation snapshot
- [docs/plans/08-ai-integration.md](./docs/plans/08-ai-integration.md) — активная future-линия по AI
- [docs/plans/12-post-mvp-template-documents.md](./docs/plans/12-post-mvp-template-documents.md) — активная post-MVP линия по template documents
- [docs/archive/2026-04/](./docs/archive/2026-04/) — архив закрытых и исторических планов

## Базовые команды

```powershell
pnpm install
pnpm prisma:generate
pnpm dev
```

Базовый check-set:

```powershell
pnpm lint
pnpm typecheck
pnpm prisma:validate
pnpm prisma:generate
```

Production release policy и runtime model описаны не в этом файле, а в:

- [docs/architecture/deployment.md](./docs/architecture/deployment.md)
- [docs/ops/release-runbook.md](./docs/ops/release-runbook.md)
