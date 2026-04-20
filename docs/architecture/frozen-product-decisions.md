# Frozen Product Decisions

## Цель документа

Собрать в одном месте уже согласованные продуктовые и архитектурные решения проекта, чтобы:

- не дублировать их в разных `plan` и `architecture` файлах
- не переобсуждать уже закрытые решения без отдельной причины
- иметь единый reference для новых блоков, рефакторов и route-policy решений

## Как использовать документ

- если новое решение уже покрывается этим документом, его не нужно заново согласовывать как open question
- если новый план или архитектурная note зависит от уже зафиксированного правила, на него нужно ссылаться, а не переписывать правило целиком
- если нужно изменить frozen decision, это должно быть отдельным явным решением, а не неявной правкой в одном из plan-файлов

## Что считается frozen decision

Frozen decision — это правило, которое уже согласовано как рабочий ориентир для реализации и дальнейшего проектирования.

Это означает:

- оно считается действующим default
- оно не считается открытым вопросом
- новые крупные модули не должны ему противоречить без отдельного пересмотра

## Что остаётся open question / решается позже

Open question — это всё, что ещё не зафиксировано окончательно на уровне продукта или архитектуры.

В том числе позже отдельно решаются:

- конкретные UI-детали и визуальная композиция будущих модулей
- точные migration-path с текущего transitional `/app` на target route structure
- детали future review UX, diff UX и rollback UX для corpus tools
- частные operational thresholds для лимитов, retention и alerting

## A. Route and module placement

Зафиксировано:

- `/account` — личный кабинет
- `/account/security`
- `/account/characters`
- `/account/documents` — агрегатор, а не главный рабочий центр
- `/assistant` и `/assistant/[serverSlug]` — отдельный assistant-модуль вне кабинета
- `/servers/[serverSlug]` — server hub
- `/servers/[serverSlug]/documents/...` — server-scoped document area
- `/servers/[serverSlug]/documents/templates/...` — route-zone для post-MVP template documents
- `/internal/...` — internal/super_admin contour
- `/app` — transitional state, а не target-default для новых крупных модулей
- server context для server-scoped модулей берётся из URL
- last-used state допустим только как UX-default, но не как source of truth

## B. Character context and document context

Зафиксировано:

- в document flow сервер определяется только URL
- персонаж может подставляться как last-used для этого сервера
- выбранные сервер и персонаж всегда должны быть явно показаны
- после первого сохранения черновика персонаж фиксируется в snapshot
- документ не может “переехать” на другой сервер
- если у пользователя нет персонажа на сервере, создание документов по этому серверу блокируется
- `/account/characters` — profile-management зона, а не рабочий центр

## C. Document lifecycle

Зафиксировано:

- используется `autosave` вместе с ручным сохранением
- `/account/documents` — единый агрегатор документов по всем серверам и типам
- update law corpus не мутирует черновик автоматически
- допустим warning и ручная пересборка
- используется единая верхнеуровневая модель document statuses
- `publication_url` и forum sync существуют только у document types, которым это реально нужно
- soft delete позже допустим для документов
- soft delete персонажей требует осторожности и не должен ломать исторические snapshot-связи

## D. Ownership and audit

Зафиксировано:

- owner документа = аккаунт
- actor документа = персонаж в snapshot
- изменение ролей и флагов персонажа не меняет ретроактивно уже созданные документы
- чувствительные действия требуют immutable audit log
- если у пользователя пропал последний персонаж на сервере, старые документы остаются историческими snapshot-объектами
- командной и совместной модели пока нет

## E. Law corpus and legal assistant policy

Зафиксировано:

- assistant отвечает только по `current primary laws` выбранного сервера
- supplements не участвуют автоматически
- если подтверждённой нормы нет, assistant честно об этом говорит
- ответ должен быть подробным и grounded
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
- assistant должен поддерживать proxy-only AI access
- proxy architecture должна поддерживать несколько proxy entries
- нужен emergency switch и server-level disable
- нужен stale corpus warning

## F. Supplements and precedents

Зафиксировано:

- supplements — отдельный слой, а не auto-merge с `primary laws`
- precedents — отдельный corpus, не `law_kind` и не `supplement`
- precedents позже должны учитываться assistant, но только через отдельный precedents workflow
- действует laws-first policy:
  - сначала закон
  - потом precedent layer
  - потом интерпретация
- `obsolete` precedents по умолчанию не участвуют в assistant
- `imported_draft / current / superseded` precedent lifecycle остаётся review-controlled

## G. Internal corpus workflow

Зафиксировано:

- только `super_admin` управляет `law` и `precedent` corpus
- перед `promote draft -> current` нужен diff или summary
- нужен rollback на предыдущую `current version`
- только один активный draft на сущность
- нужен ручной `reimport / reparse`
- `raw HTML snapshot` сохраняется
- нужен corpus health screen
- частичный сбой import не должен автоматически ломать старый валидный `current`
- structurally weak draft, например почти весь `unstructured`, должен давать warning, но не обязательно жёсткий блок

## H. Anti-abuse / safety / operations

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
- нужен retention policy для assistant logs
- retrieval metadata сохраняется даже если answer pipeline или модель вернули плохой ответ
