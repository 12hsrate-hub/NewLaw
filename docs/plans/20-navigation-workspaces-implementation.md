# 20.3+ — План реализации навигации, рабочих зон и document entry

## Кратко

Этот документ фиксирует decision-complete план реализации линии `20-navigation-workspaces` без big-bang рефакторинга.

Линия реализуется безопасными подэтапами и не удаляет текущие compatibility поверхности одним шагом.

Зафиксированные решения:

- `lawyer workspace` идёт по route `/servers/[serverSlug]/lawyer`
- `/app` и `/app/admin-*` пока остаются compatibility surface
- trustors и их data model в этой первой UI-волне не меняются
- `internal` остаётся отдельной скрытой служебной зоной
- новая главная становится product dashboard только после появления shared primary shell
- server switch становится глобальным для основных пользовательских зон
- персонаж не становится обязательным глобальным контекстом
- lawyer-only documents сначала выносятся как отдельный entry layer, а не как полный перенос editor routes
- mobile IA в рамках этой линии не проектируется

## UI baseline в рамках Плана 20

В рамках Плана 20 разрешены только базовые product-safe UI-улучшения для новых и затронутых экранов:

- нормальные карточки
- понятные заголовки
- аккуратные empty states
- единый стиль кнопок
- нормальные отступы
- user-friendly тексты на русском
- понятная шапка
- визуально чистая главная

В рамках Плана 20 запрещены:

- полный visual redesign
- новая дизайн-система
- массовая смена цветов или темы
- сложные анимации
- редизайн всех старых страниц
- mobile-specific IA или mobile-first redesign
- переписывание editor forms только ради красоты
- изменение бизнес-логики ради UI

UI baseline применяется в первой волне только к:

- новой главной / product dashboard
- shared primary shell/header
- documents workspace entry
- lawyer workspace foundation
- access denied states
- empty states
- cards for available tools/actions

UI baseline не применяется в первой волне к:

- persisted document editors
- `BBCode` preview/generation internals
- AI legal core
- AI review
- internal admin diagnostics
- old compatibility routes, если они не затрагиваются напрямую

Acceptance criteria для UI baseline:

- новые экраны используют существующие UI primitives/components, если они уже есть в проекте
- тексты на русском и понятны обычному пользователю
- недоступное действие объясняет причину и следующий шаг
- главная визуально читается как панель инструментов
- кнопки и карточки выглядят единообразно в пределах новых экранов
- в ordinary UI нет технических role/access/internal терминов
- UI changes не меняют capabilities и runtime authorization

## Важные внутренние интерфейсы

В этой линии не меняются:

- внешние API
- Prisma/schema
- AI legal core
- AI review
- `BBCode` generation

Добавляются только внутренние UI/read-model контракты:

- `WorkspaceCapabilities`
- `DocumentEntryCapabilities`
- `CapabilityBlockReason`
- новый route-модуль `/servers/[serverSlug]/lawyer`
- при необходимости для server switcher — optional `returnPath` / `targetPath` input без смены существующих result shapes

Минимальный capability vocabulary для UI entry points:

- `canOpenAssistant`
- `canOpenDocumentsWorkspace`
- `canOpenLawyerWorkspace`
- `canCreateSelfComplaint`
- `canCreateClaims`
- `canCreateAttorneyRequest`
- `canCreateLegalServicesAgreement`
- `canManageCharacters`
- `canManageTrustors`
- `requiresServer`
- `requiresCharacter`
- `requiresAdvocateCharacter`

Минимальный состав `CapabilityBlockReason`:

- `auth_required`
- `server_required`
- `character_required`
- `advocate_character_required`
- `trustor_required_temporarily`
- `materials_unavailable`
- `access_request_required`

## Подэтапы 20.3.1–20.3.9

### 20.3.1 — Capability contract для UI entry points

- Цель:
  - вынести правила видимости и доступности основных product entry points в единый внутренний read-model
- Вероятно менять:
  - `src/server/server-directory/hub.ts`
  - `src/server/document-area/context.ts`
  - `src/server/app-shell/context.ts`
  - новый helper вида `src/server/.../capabilities.ts`
  - `src/components/product/server-directory/server-hub.tsx`
  - `src/components/product/document-area/document-area-foundation.tsx`
- Нельзя трогать:
  - `src/server/actions/trustors.ts`
  - `src/server/actions/characters.ts`
  - document generation
  - AI/retrieval файлы
  - Prisma/schema
- Что именно должно измениться:
  - capability contract считается сервером из уже существующих данных: auth state, selected server, available characters, advocate access, trustor registry, legal materials availability
  - entry UI перестаёт читать `roleKeys` напрямую
  - capability contract покрывает только entry/navigation слой и не заменяет backend guards
  - lawyer-only и general-document flows получают раздельные capability flags
  - trustor-dependent states помечаются как `temporary compatibility`, а не как финальная модель
- Риски:
  - можно случайно поменять реальную доступность flows, если перепутать capability read-model и runtime authorization
  - есть риск несовпадения с текущими `canCreate*` booleans в `document-area/context`
- Какие тесты запускать:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm vitest run src/server/server-directory/hub.test.ts src/server/document-area/context.test.ts src/server/app-shell/context.test.ts`
- Критерии готовности:
  - все primary entry components получают capability contract из server context
  - в entry UI больше нет прямого product-branching от `roleKeys`
  - видимость general/lawyer entry points определяется capability vocabulary
- Нужен ли отдельный коммит:
  - да

### 20.3.2 — Shared primary shell/header

- Цель:
  - вынести общий пользовательский shell из compatibility `/app` в новую primary shell-линию для основных зон
- Вероятно менять:
  - `src/components/product/shell/app-shell-header.tsx`
  - новый primary header/shell component
  - layout-файлы для `/`, `/assistant`, `/servers`, `/account`
  - `src/server/app-shell/context.ts`
- Нельзя трогать:
  - `src/app/internal/*`
  - `src/app/(protected-admin)/app/*`
  - `src/app/(protected-security)/app/*`
  - assistant request/response contracts
  - auth logic
- Что именно должно измениться:
  - появляется shared primary shell для `/`, `/assistant`, `/servers`, `/account`
  - `/internal` сохраняет собственный layout
  - `/app` сохраняет compatibility shell и не становится primary nav owner
  - в верхний shell входят: product navigation, server switch slot, account entry, sign-out, optional internal entry
  - в верхний shell не добавляется глобально обязательный character switch
  - shell и header должны соблюдать UI baseline этой линии: чистая шапка, единый стиль CTA, нормальные spacing, без redesign всей системы
- Риски:
  - можно получить два конкурирующих shell слоя: новый primary и старый `/app`
  - если слишком рано тащить character picker в глобальный header, он снова станет обязательным контекстом
- Какие тесты запускать:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm vitest run src/components/product/shell/app-shell-navigation.test.ts src/components/product/shell/protected-shell-overview-section.test.tsx`
  - manual smoke для `/`, `/assistant`, `/servers`, `/account`
- Критерии готовности:
  - основные пользовательские зоны используют один визуально общий shell
  - `/app` продолжает работать как compatibility surface
  - `internal` не смешан с ordinary navigation
- Нужен ли отдельный коммит:
  - да

### 20.3.3 — Global server switcher вне старого `/app`

- Цель:
  - сделать server switch глобальным для основных пользовательских зон, не перенося туда обязательный character context
- Вероятно менять:
  - новый shell/header из `20.3.2`
  - `src/server/actions/shell.ts`
  - новый pure helper для route-target resolver
  - `src/server/primary-shell/context.ts`
- Нельзя трогать:
  - `src/server/account-zone/characters.ts`
  - `src/server/document-area/context.ts` behavior around snapshots
  - auth/access logic
- Что именно должно измениться:
  - persisted active server используется и в новом primary shell, и в старом `/app`
  - `selectActiveServerAction` остаётся общим action для compatibility `/app` и нового primary shell
  - switching rules фиксируются через pure route-target resolver:
  - `/assistant` -> `/assistant`
  - `/assistant/[serverSlug]` -> `/assistant/[newServerSlug]`
  - `/servers` -> `/servers`
  - `/servers/[serverSlug]` -> `/servers/[newServerSlug]`
  - `/servers/[serverSlug]/documents/...` -> `/servers/[newServerSlug]/documents`
  - `/account/...` сохраняет path и обычные query-параметры, но `server=old` должен заменяться на `server=new`; если заменить значение нельзя, `server` query удаляется
  - root `/` в этой линии не трогается
  - `/app` compatibility behavior не ломается и не переводится на новую ordinary IA
  - global switcher в primary shell реализуется через client-компонент внутри `PrimaryHeader`
  - client-компонент берёт текущий `pathname/search` через `usePathname()` и `useSearchParams()`, собирает `redirectTo` и передаёт его в `selectActiveServerAction`
  - nested layouts не добавляются только ради `currentPath`, чтобы не создавать риск двойного `PrimaryShell/header`
- Риски:
  - попытка сохранять слишком глубокий document route при смене сервера приведёт к битым `documentId`
  - blind-сохранение account query может привести к конфликту между active server в header и account filter по `?server=...`
  - nested layouts для path-aware shell ownership могут создать двойной ordinary header
  - revalidation только `/app` станет недостаточной
- Какие тесты запускать:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm vitest run src/server/actions/shell.test.ts`
  - unit tests для route-target resolver
  - tests для `PrimaryHeader`/server switcher
  - route smoke tests:
  - `/assistant`
  - `/assistant/[serverSlug]`
  - `/servers`
  - `/servers/[serverSlug]`
  - `/servers/[serverSlug]/documents`
  - `/account`
  - затем полный `pnpm vitest run`
- Критерии готовности:
  - active server меняется из основных зон
  - смена сервера не ломает route semantics
  - server switch не требует character selection
  - `/assistant` и `/servers` не уводят пользователя на конкретный server route автоматически
  - `/account/...` не остаётся с устаревшим `server=old` в query после переключения
- Нужен ли отдельный коммит:
  - да

#### 20.3.3a — Route-target resolver и action wiring

- Цель:
  - сначала стабилизировать redirect semantics и persisted active server state без визуального изменения ordinary header
- Что именно должно измениться:
  - появляется pure route-target resolver для primary-shell server switching
  - `selectActiveServerAction` расширяется так, чтобы использовать resolver и корректно поддерживать:
  - `/assistant`
  - `/assistant/[serverSlug]`
  - `/servers`
  - `/servers/[serverSlug]`
  - `/servers/[serverSlug]/documents/...`
  - `/account/...`
  - `/app...`
  - `server` query на `/account/...` обновляется с `old` на `new`, а если корректная замена невозможна, удаляется
  - visual shell/header на этом подшаге не меняется
- Какие тесты запускать:
  - `pnpm lint`
  - `pnpm typecheck`
  - unit tests для route-target resolver
  - `pnpm vitest run src/server/actions/shell.test.ts`
- Критерии готовности:
  - action умеет безопасно считать next target для ordinary routes
  - compatibility `/app` не ломается
- Нужен ли отдельный коммит:
  - да

#### 20.3.3b — Server switcher UI в `PrimaryHeader`

- Цель:
  - после стабилизации route semantics добавить компактный global server switcher в новый primary shell
- Что именно должно измениться:
  - в `PrimaryHeader` появляется client-компонент server switcher
  - он использует `usePathname()` и `useSearchParams()` для сборки `redirectTo`
  - он показывает текущий активный сервер, список серверов и action переключения
  - `character picker` не добавляется
  - `lawyer workspace` link не добавляется
  - `/internal` не смешивается с ordinary switcher UI
- Какие тесты запускать:
  - `pnpm lint`
  - `pnpm typecheck`
  - tests для `PrimaryHeader` и нового server switcher client-компонента
  - route smoke tests для `/assistant`, `/assistant/[serverSlug]`, `/servers`, `/servers/[serverSlug]`, `/servers/[serverSlug]/documents`, `/account`
  - затем полный `pnpm vitest run`
- Критерии готовности:
  - ordinary user может переключить active server из primary shell
  - верхнеуровневые hub pages `/assistant` и `/servers` не делают неожиданный автопереход
  - server-scoped routes переходят только в безопасные server-scoped targets
- Нужен ли отдельный коммит:
  - да

### 20.3.4 — Новая главная как dashboard/tool panel

- Цель:
  - заменить redirect-only landing на product dashboard и только после этого перевести default authenticated landing с `/account` на `/`
- Вероятно менять:
  - `src/app/page.tsx`
  - `src/lib/auth/email-auth.ts`
  - `src/components/product/home/project-overview.tsx` или его replacement
  - `src/app/page.test.tsx`
- Нельзя трогать:
  - sign-in/sign-up forms
  - confirm/reset flows
  - assistant core
  - document editors
- Что именно должно измениться:
  - для гостя `/` остаётся auth-first entry и по-прежнему может вести на `/sign-in`
  - для авторизованного пользователя `/` начинает рендерить dashboard/tool panel
  - dashboard показывает текущий server context и входы в `assistant`, `documents`, `lawyer workspace`, `account`
  - после появления dashboard `defaultAuthenticatedLandingPath` меняется с `/account` на `/`
  - новая главная должна соблюдать UI baseline: визуально читаться как панель инструментов, а не как documents center или settings page
- Риски:
  - можно сломать post-confirm и password-reset redirect chain
  - если поменять landing раньше, чем dashboard готов, user попадёт в пустую зону
- Какие тесты запускать:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm vitest run src/app/page.test.tsx`
  - auth-related tests вокруг `sign-in`, `sign-up`, `confirm`, `reset-password`
  - manual smoke: guest `/`, authenticated `/`, post-confirm redirect
- Критерии готовности:
  - авторизованный пользователь попадает на product dashboard
  - dashboard не требует персонажа
  - account больше не является обязательной первой точкой входа
- Нужен ли отдельный коммит:
  - да

### 20.3.5 — Account cleanup phase 1

- Цель:
  - сузить `account` до зоны настроек/безопасности/доступов без поломки старых ссылок и без немедленного выноса trustors/characters
- Вероятно менять:
  - `src/app/account/layout.tsx`
  - `src/app/account/page.tsx`
  - `src/components/product/document-area/document-area-foundation.tsx`
  - account overview components
- Нельзя трогать:
  - `src/server/account-zone/characters.ts`
  - `src/server/account-zone/trustors.ts`
  - trustor/character CRUD actions
  - document overview data model
- Что именно должно измениться:
  - `/account` landing перестаёт быть рабочим кабинетом
  - из account landing убираются primary CTA в documents/assistant/lawyer workflows
  - account copy фиксируется как зона настроек, безопасности, доступов, персонажей, доверителей и обзора документов
  - subroutes `/account/security`, `/account/characters`, `/account/trustors`, `/account/documents` сохраняются
  - старые deep links остаются рабочими
- Риски:
  - если сделать cleanup до запуска новой главной, пользователи потеряют понятную входную точку
  - слишком ранний перенос trustors из account будет конфликтовать с текущей data model
- Какие тесты запускать:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm vitest run src/app/account/layout.test.ts src/app/account/security/page.test.tsx src/app/account/documents/page.test.tsx`
  - manual smoke по `/account`, `/account/security`, `/account/characters`, `/account/trustors`
- Критерии готовности:
  - `/account` больше не позиционируется как основной рабочий кабинет
  - account routes не удалены и не сломаны
  - characters/trustors остаются как registry/convenience layer до отдельного future step
- Нужен ли отдельный коммит:
  - да

### 20.3.6 — Lawyer workspace foundation

- Цель:
  - добавить отдельный модуль `/servers/[serverSlug]/lawyer` как server-scoped entry layer для lawyer-only сценариев, не трогая пока trustor data model и не перенося editor routes
- Вероятно менять:
  - новый route `/servers/[serverSlug]/lawyer`
  - `src/components/product/server-directory/server-hub.tsx`
  - `src/server/server-directory/hub.ts`
  - локальные lawyer workspace components
  - `src/server/app-shell/context.ts`
- Нельзя трогать:
  - `src/server/account-zone/trustors.ts`
  - `src/server/actions/trustors.ts`
  - `src/components/product/document-area/document-attorney-request-editor-client.tsx`
  - `src/components/product/document-area/document-legal-services-agreement-editor-client.tsx`
  - Prisma/schema
- Что именно должно измениться:
  - появляется отдельный entry screen `Адвокатский кабинет`
  - workspace показывает только lawyer-only actions:
  - `attorney_request`
  - `legal_services_agreement`
  - trustor-related helper entry как связанный lawyer flow
  - workspace требует selected server, local active character for this server и advocate capability
  - если character отсутствует или не адвокат, workspace не fake-ready
  - в первом релизе workspace использует локальный character selector или локальный blocked-state CTA, а не глобальный mandatory character picker
  - attorney/agreement editors пока не переезжают; workspace ведёт в уже существующие document routes как compatibility target
  - trustor behavior остаётся текущим account+server scoped, с явной пометкой, что это compatibility stage
  - foundation screen должен соблюдать UI baseline: clean cards, понятные headings, единый action layout и без попытки делать полный redesign lawyer flows
- Риски:
  - mismatch между local lawyer selection и старым silent fallback в document routes
  - попытка сразу перетащить редакторы превратит этап в big-bang
- Какие тесты запускать:
  - `pnpm lint`
  - `pnpm typecheck`
  - новый route test для `/servers/[serverSlug]/lawyer`
  - `pnpm vitest run src/server/server-directory/hub.test.ts src/server/app-shell/context.test.ts`
  - manual smoke: blocked state without advocate, ready state with advocate
- Критерии готовности:
  - lawyer workspace существует как отдельный модуль
  - ordinary user не ищет lawyer-only документы в `/account`
  - editor routes остаются совместимыми и не мигрируют в этот же коммит
- Нужен ли отдельный коммит:
  - да

### 20.3.7 — Documents workspace entry refactor

- Цель:
  - разделить general documents module и lawyer workspace на уровне входа и убрать свободный mode-switch из create-entry логики
- Вероятно менять:
  - `src/app/servers/[serverSlug]/documents/page.tsx`
  - `src/components/product/document-area/document-area-foundation.tsx`
  - `src/server/document-area/context.ts`
  - create-entry pages/components для OGP и claims
- Нельзя трогать:
  - persisted editors
  - document generation
  - `BBCode` generation
  - attorney/agreement editor internals
  - trustor model
- Что именно должно измениться:
  - general documents hub показывает только general document flows:
  - `ogp_complaint`
  - `rehabilitation`
  - `lawsuit`
  - lawyer-only families больше не показываются как равноправные primary cards внутри общего documents hub
  - вместо них есть явный link/card в `/servers/[serverSlug]/lawyer`
  - create-entry логика general documents строится от capabilities и document-type rules
  - свободный выбор режима `разовый / от себя / для доверителя` не появляется
  - для flows, которым нужен персонаж, UI показывает local readiness state и следующий шаг, а не глобальный блок всего модуля
  - lawyer-only compatibility routes остаются рабочими по прямому URL до позднего cleanup
- Риски:
  - можно случайно спрятать существующие create paths без появления lawyer workspace entry
  - silent fallback current character может маскировать отсутствие явной readiness модели
- Какие тесты запускать:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm vitest run src/app/servers/[serverSlug]/documents/page.test.tsx src/server/document-area/context.test.ts`
  - family create route tests для `ogp-complaints` и `claims`
  - manual smoke по documents hub
- Критерии готовности:
  - general documents и lawyer-only entry визуально разделены
  - new create-entry UI не предлагает free mode switch
  - old direct lawyer document URLs продолжают открываться
- Нужен ли отдельный коммит:
  - да

### 20.3.8 — Access denied и empty states для новых зон

- Цель:
  - унифицировать blocked/empty states в новых primary workspaces по capability reasons, не затрагивая отдельную линию route-level error boundaries
- Вероятно менять:
  - `src/components/product/server-directory/server-hub.tsx`
  - `src/app/assistant/[serverSlug]/page.tsx`
  - `src/app/servers/[serverSlug]/documents/page.tsx`
  - новый lawyer workspace route
  - account landing copy
- Нельзя трогать:
  - `error.tsx` / `not-found.tsx` как отдельную product line
  - internal admin diagnostics
  - assistant answer logic
- Что именно должно измениться:
  - blocked states используют единый смысловой словарь:
  - нет выбранного сервера
  - нужен персонаж
  - нужен персонаж-адвокат
  - нужен запрос на доступ
  - материалов временно недостаточно
  - для текущей compatibility версии нужен сохранённый доверитель
  - каждая blocked state карточка даёт следующий шаг
  - ordinary user не видит raw role/access flags
  - denied и empty states должны соблюдать UI baseline: понятный title, краткое объяснение, единый CTA и визуально чистая card-based подача
- Риски:
  - слишком общий shared copy может стереть локальный контекст
  - нельзя обещать будущую trustor-модель раньше реального data-model step
- Какие тесты запускать:
  - `pnpm lint`
  - `pnpm typecheck`
  - route/component tests для `/assistant/[serverSlug]`, `/servers/[serverSlug]`, `/servers/[serverSlug]/documents`, `/servers/[serverSlug]/lawyer`
  - manual smoke по blocked states
- Критерии готовности:
  - новые entry zones объясняют, почему действие недоступно
  - ordinary UI не показывает прямые role/access/internal слова
  - trustor-related blockers явно помечены как текущая compatibility requirement
- Нужен ли отдельный коммит:
  - да

### 20.3.9 — Final compatibility cleanup later

- Цель:
  - отдельной поздней волной убрать старые primary зависимости от `/app`, сократить legacy entry points и подготовить будущий trustor compatibility/data-model step
- Вероятно менять позже:
  - `src/app/(protected)/app/*`
  - `src/app/(protected-admin)/app/*`
  - `src/app/(protected-security)/app/*`
  - старый shell
  - old overview sections
  - trustor-related document entry helpers
- Нельзя трогать в первой волне:
  - Prisma/schema
  - trustor ownership model
  - attorney/agreement document generation
  - AI core
  - `BBCode` generation
- Что именно должно измениться позже:
  - `/app` остаётся рабочим, но перестаёт быть значимой entry zone
  - `/app/admin-*` и `/app/security` ещё живут как redirects, но не участвуют в новой IA
  - после стабилизации lawyer workspace и documents split можно вычищать старые hub-like дубликаты
  - отдельным будущим планом решается trustor migration к `attorneyCharacter scoped` и in-flow trustor creation for agreement
- Риски:
  - преждевременное удаление compatibility routes сломает bookmark/runbook scenarios
  - попытка совместить navigation cleanup и trustor data-model step перегрузит релиз
- Какие тесты запускать:
  - `pnpm lint`
  - `pnpm typecheck`
  - redirect tests для `/app`, `/app/admin-*`, `/app/security`
  - full regression по account, assistant, servers, documents, internal
- Критерии готовности:
  - новая primary IA полностью рабочая
  - compatibility routes нужны только как мост, а не как основной UX
  - trustor/data-model migration выделена в отдельную линию
- Нужен ли отдельный коммит:
  - да, но как отдельная поздняя серия коммитов

## Порядок реализации

1. `20.3.1` capability contract
2. `20.3.2` shared primary shell
3. `20.3.3` global server switcher
4. `20.3.4` новая главная и смена default landing
5. `20.3.5` account cleanup phase 1
6. `20.3.6` lawyer workspace foundation
7. `20.3.7` documents workspace entry refactor
8. `20.3.8` access denied / empty states
9. `20.3.9` compatibility cleanup later

Этот порядок безопасен, потому что:

- сначала фиксируется capability vocabulary и shell
- потом появляется новый global server UX
- потом появляется новая точка входа
- только после этого сужается `account`
- затем добавляется новый lawyer module
- и только после его появления general documents перестают быть смешанным hub

## Общий набор проверок

Для обычных UI/server read-model изменений достаточно:

- `pnpm lint`
- `pnpm typecheck`
- релевантные `pnpm vitest run ...` по затронутым зонам

`pnpm prisma:validate` запускать только если затронуты Prisma-related файлы.  
`pnpm prisma:generate` запускать только если менялась `schema.prisma`.

Плюс:

- explicit `vitest run ...` по `.test.tsx`, если текущий include их не подхватывает
- manual smoke по `/`, `/assistant`, `/servers`, `/account`, `/servers/[serverSlug]/documents`, `/servers/[serverSlug]/lawyer`, `/internal`

## Явные допущения

- route для lawyer workspace закреплён как `/servers/[serverSlug]/lawyer`
- первая волна не меняет trustor ownership model и не реализует attorneyCharacter-scoped trustors
- первая волна не переносит attorney/agreement editors в новый route family; она добавляет новый curated entry layer
- shared primary shell охватывает `/`, `/assistant`, `/servers`, `/account`
- `/internal` и `/app` остаются отдельными layout/shell контурами
- mobile-specific IA в этой линии не проектируется
