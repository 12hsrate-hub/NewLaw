# Frozen Product Decisions

## Цель документа

Собрать в одном месте уже согласованные продуктовые и архитектурные решения проекта, чтобы:

- не дублировать их в разных `plan`, `product` и `architecture` документах
- не переобсуждать уже закрытые решения без отдельной причины
- иметь единый reference для новых блоков, route-policy, corpus workflow и future migration

## Как использовать документ

- если новый план опирается на уже зафиксированное правило, на него нужно ссылаться, а не переписывать правило заново
- если решение уже покрыто этим документом, его не нужно повторно оформлять как open question
- если frozen decision нужно изменить, это должно быть отдельным явным решением, а не тихой локальной правкой в одном из plan-файлов

## Что считается frozen decision

Frozen decision — это правило, которое уже согласовано как рабочий ориентир для реализации, будущих блоков и рефакторов.

Это означает:

- оно считается действующим default
- оно не считается открытым вопросом
- новые крупные модули не должны ему противоречить без отдельного пересмотра

## Что пока остаётся future step / open implementation detail

Не всё в проекте уже зафиксировано на уровне финальной реализации.

Позже отдельно решаются:

- конкретные UI-детали, визуальная композиция и навигационные паттерны будущих модулей
- точная форма future migration с transitional `/app` на target route structure
- конкретные thresholds для limits, retention, alerts и maintenance behavior
- точная реализация `diff`, `rollback`, `health screen` и corpus review UX
- точная форма future assistant expansion поверх уже зафиксированной policy

## A. Route and module placement

Зафиксировано:

- `/account` — личный кабинет
- `/account/security`
- `/account/characters`
- `/account/documents` — агрегатор, а не основной рабочий маршрут
- `/assistant`
- `/assistant/[serverSlug]`
- `/servers/[serverSlug]` — server hub
- `/servers/[serverSlug]/documents/...`
- `/servers/[serverSlug]/documents/templates/...`
- `/internal/...` — internal/super_admin contour
- `/app` — transitional state, а не target-default для новых модулей
- default authenticated landing без explicit `next` = `/account`
- для server-scoped модулей server context берётся из URL
- last-used state допустим только как UX-default, но не как source of truth

## B. Character and document context

Зафиксировано:

- в document flow сервер определяется только URL
- персонаж может подставляться как last-used для этого сервера
- выбранные сервер и персонаж всегда явно показываются пользователю
- после первого сохранения черновика персонаж фиксируется в snapshot
- документ не может сменить сервер после создания
- если у пользователя нет персонажа на сервере, создание документов по этому серверу блокируется
- focused bridge для `needs_character` ведёт в `/account/characters?server=<serverCode>#create-character-<serverCode>`
- `/account/characters` — profile-management зона, а не рабочий центр

Отдельно по trustor policy:

- trustor inside document всегда живёт как snapshot
- уже созданный документ не должен зависеть от live trustor registry entity
- standalone trustors registry не является обязательной частью MVP
- если reusable trustor registry позже появится, его target route = `/account/trustors`
- registry later может использоваться только как convenience prefill, а не как обязательная runtime dependency document flows

## C. Document lifecycle and ownership

Зафиксировано:

- используется `autosave` вместе с ручным сохранением
- `/account/documents` — единый агрегатор документов по всем серверам и типам
- обновление law corpus не мутирует черновик автоматически
- допустим `warning` и ручная пересборка
- используется единая верхнеуровневая модель document statuses
- `publication_url` и forum sync существуют только у тех document types, которым это реально нужно
- owner документа = аккаунт
- actor документа = персонаж в snapshot
- изменение ролей и флагов персонажа не меняет ретроактивно уже созданные документы
- если у пользователя пропал последний персонаж на сервере, старые документы остаются историческими snapshot-объектами
- командной и совместной модели пока нет
- live forum automation не является обязательной частью пользовательского document workflow
- `publication_url` допустим только как optional metadata у тех document types, которым это действительно нужно
- user success state для `ogp_complaint` не зависит от реальной публикации на форуме
- cookies / forum session не считаются обязательным пользовательским вводом
- future document families по умолчанию не должны ориентироваться на forum automation
- document AI, если используется, работает только как helper внутри editor
- document AI не делает silent overwrite persisted text
- document AI suggestion всегда отделена от final field value до explicit apply
- document AI v1 использует только persisted document payload + persisted snapshots
- document AI v1 не превращает editor в chat UI и не смешивается с `/assistant`

## D. Law corpus and assistant policy

Зафиксировано:

- assistant отвечает только по `current primary laws` выбранного сервера
- supplements не участвуют автоматически
- если подтверждённой нормы нет, assistant честно об этом говорит
- ответ должен быть grounded
- assistant разделяет:
  - что прямо следует из норм
  - что является интерпретацией
- у ответа есть `corpus snapshot` metadata
- assistant не отвечает “вне корпуса”
- assistant и document generation — разные модули
- для гостя assistant доступен как тестовая функция на `1` вопрос
- после `1` вопроса:
  - старый ответ виден
  - новый вопрос блокируется
  - показывается `CTA` на регистрацию или вход
- для авторизованных пользователей отдельный жёсткий лимит пока не введён
- если corpus сервера stale или неполный, assistant может показывать warning
- если у сервера нет `current corpus`, assistant должен честно показывать `unavailable` или `no_corpus` сценарий
- если retrieval слабый, допустим warning или честное “недостаточно подтверждённой нормы”
- “близкие нормы” позже допустимы только с явной пометкой, что это не прямой ответ

## E. Supplements and precedents

Зафиксировано:

- supplements — отдельный слой, а не auto-merge с `primary laws`
- precedents — отдельный corpus, не `law_kind` и не `supplement`
- precedents позже должны учитываться assistant, но только через отдельный precedents workflow
- действует laws-first policy:
  - сначала закон
  - потом precedent layer
  - потом интерпретация
- `obsolete` precedents по умолчанию не участвуют в assistant
- precedents не должны автоматически попадать в уже работающий assistant до отдельного integration step

## F. Internal corpus workflow

Зафиксировано:

- только `super_admin` управляет `law` и `precedent` corpus
- перед `promote draft -> current` нужен `diff` или `summary`
- нужен rollback на предыдущую `current version`
- только один активный draft на сущность
- нужен ручной `reimport / reparse`
- `raw HTML snapshot` сохраняется
- нужен corpus health screen
- частичный сбой import не должен ломать старый валидный `current` автоматически
- structurally weak draft, например почти весь `unstructured`, должен давать warning, но не обязательно жёсткий блок

## G. Anti-abuse, proxy and operations

Зафиксировано:

- для assistant нужен safety и anti-abuse guard
- нужен лимит длины вопроса
- нужен лимит на объём retrieval context
- нужен maintenance mode по серверам
- нужны monitoring и alerts для:
  - import failures
  - stale corpus
  - proxy failures
  - assistant error spikes
- если parser ломается из-за изменения форумной вёрстки, старый `current` сохраняется, а не заменяется автоматически
- retrieval metadata сохраняется даже если answer pipeline или модель вернули плохой ответ

## H. Assistant proxy and retention policy

Зафиксировано:

- все AI-запросы идут только через proxy-layer
- direct `OpenAI` calls запрещены
- proxy entries может быть несколько
- архитектура ориентирована на server-side балансировку и failover, даже если на старте реально используется один proxy entry
- misconfigured proxy означает честный `unavailable`, а не фейковый ответ
- для авторизованных пользователей храним `question + answer + metadata`
- для guest assistant хранится один `Q/A pair`
- нужен retention policy для assistant logs
- отдельная кнопка очистки guest-ответа в MVP не требуется

## I. Server / corpus health model

Единый набор server/corpus health states:

- `no_corpus`
- `corpus_bootstrap_incomplete`
- `current_corpus_ready`
- `corpus_stale`
- `assistant_disabled`
- `maintenance_mode`

Смысл состояний:

- `no_corpus` — у сервера нет usable confirmed corpus, assistant не должен делать вид, что готов к ответу
- `corpus_bootstrap_incomplete` — corpus уже начат, но confirmed coverage ещё недостаточен для полного доверия
- `current_corpus_ready` — есть usable confirmed current corpus для реальной работы assistant
- `corpus_stale` — confirmed corpus существует, но требует attention из-за давности, gaps или operational signals
- `assistant_disabled` — assistant по серверу принудительно выключен независимо от состояния corpus
- `maintenance_mode` — сервер временно находится в обслуживании и normal assistant flow не должен считаться доступным

Эти статусы должны использоваться:

- в assistant UX
- во внутренних corpus tools
- в future health screen
- в monitoring и alerts

## J. Blackberry operational baseline

Зафиксировано:

- `Blackberry` — первый fully bootstrapped real server
- law corpus status для `Blackberry` — `current_corpus_ready`
- assistant по `Blackberry` можно использовать как по реальному confirmed corpus
- supplements для `Blackberry` пока не подключены
- precedents для `Blackberry` пока не подключены
- `Blackberry` можно использовать как baseline для future smoke и regression checks по assistant и corpus

## K. Future migration policy from `/app`

Зафиксировано:

- позже нужен отдельный migration/refactor block для route migration
- старые `/app` маршруты не должны остаться “временно навсегда”
- направления будущего migration:
  - character-related user routes -> `/account/characters`
  - `/app/admin-laws` и похожие internal tools -> `/internal/...`
  - новые user-facing modules -> `/assistant` и `/servers/[serverSlug]/...`
- уже выполнено:
  - canonical self-service security route = `/account/security`
  - `/app/security` = compatibility redirect для legacy bookmarks и continuation flows
- user-facing navigation позже должна быть перестроена под новую target structure
- допускается прямой перевод на новые маршруты без долгого периода параллельной жизни, если это не ломает продуктовую логику и пользователей
- в текущей документации уже выполненные шаги нужно помечать как выполненные, а remaining `/app` migration — как future policy до полного cleanup

## L. Temporary forum automation policy

Зафиксировано:

- реализованная линия OGP forum automation считается временной optional integration, а не core user feature
- MVP acceptance не зависит от live create/update against `forum.gta5rp.com`
- после MVP forum automation должна быть удалена из продукта полностью
- её нельзя использовать как продуктовый ориентир для claims, template documents и будущих document families
- если forum integration когда-либо понадобится позже, это должно быть новым отдельным решением, а не автоматическим продолжением текущей линии
