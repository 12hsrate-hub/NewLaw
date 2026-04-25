# 14 — Codebase maintainability, DB stability follow-up and safe refactor

## Статус блока

Статус: `active / technical maintainability + DB stability follow-up`

Этот блок:

- не reopening MVP
- не новая продуктовая фича
- не DB migration plan
- не замена плана `13-character-access-requests-and-role-approval`
- не замена [../architecture/database.md](../architecture/database.md)
- не замена [../ops/release-runbook.md](../ops/release-runbook.md)
- не включает переход на другой runtime DB hosting; этот вопрос вынесен в [15-vps-postgres-cutover-from-supabase-db.md](./15-vps-postgres-cutover-from-supabase-db.md)

Это отдельная техническая линия после production DB stability hotfix, которая должна снизить риск дальнейших регрессий и сделать safe refactor decision-complete без изменения agreed product scope.

## Цель

Цель этого плана:

- подготовить кодовую базу к дальнейшей разработке
- уменьшить крупные файлы и агрегаторы
- снизить риск регрессий при последующих изменениях
- закрепить resilient read-path для старых и повреждённых document JSON
- не допускать падения list/editor route из-за одного повреждённого документа
- снизить query pressure на DB-backed routes
- облегчить добавление и сопровождение document families
- сохранить текущее пользовательское поведение

## Что этот план НЕ делает

Этот план:

- не меняет Prisma schema
- не добавляет migrations
- не меняет routes
- не меняет document payload schemas
- не меняет server action contracts
- не удаляет forum automation
- не добавляет новые document families
- не реализует access request flow заново
- не меняет production connection strings напрямую

## Problem areas

### 1. Production DB/runtime stability follow-up

Текущий production follow-up уже зафиксировал:

- `Prisma P2024`
- `Prisma P1001`
- возможный `Supabase pooler / connection pressure`
- риск `DIRECT_URL = DATABASE_URL` в production/staging
- необходимость разделять pooled runtime connection и direct migration connection
- необходимость снижать тяжесть read queries на `/account`, `/account/trustors`, `/account/documents`, `/account/characters` и editor read-path

Правила:

- connection strategy не менять в generic refactor PR
- Prisma schema не менять без отдельного DB-safe плана
- migrations не добавлять в generic refactor PR
- `DIRECT_URL = DATABASE_URL` допустим только как emergency/bootstrap workaround, но не как целевая production схема

### 2. Document JSON read-path brittleness

Потенциально битые или legacy-данные:

- `formPayloadJson`
- `authorSnapshotJson`
- `signatureSnapshotJson`
- `generatedArtifactJson`

Они не должны ронять:

- `/account/documents`
- `/account/trustors`
- `/account/characters`
- `/servers/[serverSlug]/documents`
- family list routes
- persisted editor routes

Правила:

- list route показывает degraded карточку
- editor route показывает `InvalidDocumentDataState` или аналогичный safe state
- broken document не скрывается полностью
- broken document не удаляется автоматически
- write-path validation остаётся strict
- recovery/manual repair остаётся отдельной future/internal task

### 3. Large client editor files

Проблемные файлы:

- `src/components/product/document-area/document-draft-editor-client.tsx`
- `src/components/product/document-area/document-claims-editor-client.tsx`

Проблема:

- editor state
- fields rendering
- evidence rendering
- trustor snapshot handling
- AI controls
- generation/publication panels
- save/generate side effects

смешаны в одном клиентском модуле.

### 4. document-persistence UI aggregator

Проблемный файл:

- `src/components/product/document-area/document-persistence.tsx`

Проблема:

- persisted document list
- family lists
- create entries
- labels
- href builders
- invalid/degraded states
- editor wrappers

собраны в одном крупном UI-агрегаторе.

### 5. server/actions/documents.ts aggregator

Проблемный файл:

- `src/server/actions/documents.ts`

Проблема:

- create actions
- save action
- generation actions
- publication actions
- rewrite actions
- grounded rewrite actions
- revalidation logic

собраны в одном server-action агрегаторе.

### 6. server/document-area/context.ts aggregator

Проблемный файл:

- `src/server/document-area/context.ts`

Проблема:

- account documents context
- server documents context
- family contexts
- editor contexts
- selected character logic
- trustor registry preparation
- persisted list item mapping
- invalid document data handling

смешаны в одном read-model модуле.

### 7. server/document-area/persistence.ts aggregator

Проблемный файл:

- `src/server/document-area/persistence.ts`

Проблема:

- errors
- schema versions
- author snapshot readers
- signature snapshot readers
- payload normalizers
- createInitial logic
- document readers
- access rules

собраны в одном persistence-агрегаторе.

### 8. AI infrastructure duplication risk

Потенциально пересекающиеся infrastructure-паттерны:

- `src/server/legal-assistant/answer-pipeline.ts`
- `src/server/document-ai/grounded-rewrite.ts`

Проблема:

- retrieval
- proxy call
- AI request logging
- grounded references
- prompt context assembly

могут повторять похожую infrastructure-механику.

Правило:

- не объединять сами prompt flows
- можно выносить только infrastructure helpers, если дублирование останется очевидным после основных refactor steps

### 9. Character access UI correction as pre-refactor blocker

Source of truth по security correction остаётся:

- [13-character-access-requests-and-role-approval.md](./13-character-access-requests-and-role-approval.md)

Фактический current repo-state:

- backend self-service уже закрыт
- `createCharacterManually` уже создаёт `citizen + []`
- `updateCharacterManually` уже не меняет роли и access flags
- role/access чекбоксы в текущем self-service UI уже убраны

Правила:

- план 14 не подменяет и не переоткрывает план 13
- если понадобится future hardening или дополнительная ревизия character access UI, это остаётся внутри линии 13, а не 14

## Work order

Строгий порядок работ:

0. `Docs-only` фиксация плана  
   Expected outcome: единый source of truth для maintainability и DB stability follow-up без изменения кода.

1. Character access UI correction  
   Expected outcome: подтвердить, что current self-service UI и backend уже остаются в safe-модели; если останется residual UI debt, закрывать его отдельным маленьким шагом без reopening plan 13.  
   Важно: этот пункт выполняется только если после отдельной ревизии останется UI debt; current repo-state уже закрывает базовую self-service correction.

2. DB/read-path audit follow-up  
   Expected outcome: формально закрепить coverage degraded/invalid states и тяжёлых DB-backed routes, не меняя schema и connection strings.

3. Document family registry  
   Expected outcome: labels, href builders, family metadata и related document-family wiring уходят в единый registry-подход без изменения routes и payload contracts.

4. Split `document-persistence.tsx`  
   Expected outcome: list UI, family entries, degraded states и editor wrappers разделены по ответственности при сохранении текущего поведения.

5. Split OGP editor client  
   Expected outcome: state, form sections, AI controls и generation/publication panels вынесены из одного большого client file по ответственности.

6. Split claims editor client  
   Expected outcome: state, evidence, trustor snapshot, AI controls и generation panels разделены по ответственности.

7. Split `server/actions/documents.ts`  
   Expected outcome: create/save/generation/publication/rewrite action groups вынесены в smaller modules с compatibility barrel-export.

8. Split `server/document-area/context.ts`  
   Expected outcome: account/server/family/editor contexts и list-item mapping разделены на smaller read-model modules с сохранением публичных входов.

9. Split `server/document-area/persistence.ts`  
   Expected outcome: readers, normalizers, createInitial logic, access rules и errors разделены по ответственности без изменения write-path contracts.

10. AI infrastructure helper extraction  
   Expected outcome: только если после предыдущих шагов дублирование останется явным, выносить общие infrastructure helpers без слияния разных prompt flows.

## DB-safe rules

- Prisma schema changes запрещены в generic refactor PR
- migrations запрещены в generic refactor PR
- любое schema change = отдельный DB-safe план + rollback note
- `DATABASE_URL` и `DIRECT_URL` должны рассматриваться отдельно
- `DIRECT_URL = DATABASE_URL` не считается целевой production схемой
- read-path должен быть tolerant
- write-path должен оставаться strict
- broken JSON должен вести к degraded/invalid state, а не к route crash
- data repair не выполняется silently

## Safe refactor rules

- один PR = один смысловой шаг
- нельзя совмещать refactor и behavior change
- нельзя совмещать refactor и DB migration
- compatibility barrel-export обязателен для публичных exports
- routes менять нельзя
- document types менять нельзя
- payload schema names менять нельзя
- server action signatures менять нельзя
- новые крупные модули нельзя переносить в `/app`
- forum automation в рамках плана 14 не удаляется
- legacy/degraded document support не удаляется

## Check-set

После каждого code-step:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm prisma:validate`
- `pnpm prisma:generate`

Если затронуты DB/read-path/release-related files:

- `pnpm test:ci`

Если затронуты deploy/release scripts:

- сверяться с [../ops/release-runbook.md](../ops/release-runbook.md)

## Acceptance criteria

План считается созданным, если:

- создан `docs/plans/14-codebase-maintainability-db-stability-and-safe-refactor.md`
- в нём есть:
  - статус
  - цель
  - что план НЕ делает
  - problem areas
  - work order
  - DB-safe rules
  - safe refactor rules
  - check-set
  - acceptance criteria
- план явно отделяет:
  - maintainability
  - DB stability follow-up
  - security correction plan 13
  - product expansion
  - DB migration work
- документ не утверждает code/database mutations как уже выполненные
