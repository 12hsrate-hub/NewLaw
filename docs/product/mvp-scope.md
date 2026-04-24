# Scope MVP

## Closure Status

Текущий agreed MVP можно считать формально закрытым.

Это означает:

- обязательных продуктовых блокеров для current agreed MVP больше нет
- remaining work больше не должен описываться как “ещё нужно, чтобы дойти до MVP”
- всё дальнейшее развитие должно оформляться как future expansion, optional capability, post-MVP line или operational maturity

## Что входит в current agreed MVP

### Общая рамка

- единое приложение на `Next.js + TypeScript + App Router`
- встроенная админка и internal-инструменты внутри того же приложения
- `Supabase Auth` + `Prisma` + `PostgreSQL` через `Supabase`
- `OpenAI API` только через server-side layer
- account zone, server-scoped user modules и internal contour как отдельные зоны
- `/app` только как transitional / compatibility surface

### Account / server / character foundation

- server context выбирается явно и остаётся source of truth для server-scoped модулей
- character management уже существует как account-scoped profile-management линия
- роли и `access_flags` привязаны к `character_id`
- `super_admin` — признак уровня аккаунта
- `Account -> Server -> Characters -> Documents` остаётся базовой иерархией проекта

### Обязательная correction-policy для character access model

Согласованная модель доступа для персонажей такая:

- пользователь не выбирает роли сам
- пользователь не выбирает `accessFlags` сам
- self-service создание персонажа включает только профильные поля
- новый персонаж получает безопасную базовую роль `citizen`
- адвокатский доступ выдаётся только после заявки пользователя и одобрения администратора
- представительские document flows доступны только персонажу с `accessFlag: advocate`

Важно:

- это не новая продуктовая линия и не расширение scope
- это обязательная security correction текущей access-model
- текущий repo-state уже приведён к этой модели:
  - self-service create/update не читает и не применяет `roleKeys/accessFlags`
  - пользовательский UI больше не возвращает чекбоксы ролей и доступов
  - `/account/characters` показывает статус адвокатского доступа и даёт отправить заявку
  - `/internal/access-requests` даёт `super_admin` approve/reject и отдельный review-list уже выданных назначений
- source-of-truth для correction-линии: [docs/plans/13-character-access-requests-and-role-approval.md](../plans/13-character-access-requests-and-role-approval.md)

### Документы внутри закрытого MVP

В current agreed MVP уже входят и считаются закрытыми:

- `ogp_complaint` как исходный главный сценарий
- claims family:
  - `rehabilitation`
  - `lawsuit`

Для этих линий уже зафиксированы:

- snapshot-based document lifecycle
- first-save snapshot capture
- persisted drafts
- generation metadata
- `/account/documents` как агрегатор, а не основной editor center
- server-scoped document routes в `/servers/[serverSlug]/documents/...`

### Trustors

- document flows остаются snapshot-based
- trustor snapshot внутри документа не зависит от последующих изменений registry entry
- standalone trustors registry не является MVP blocker
- существующий `/account/trustors` трактуется как convenience layer, а не как обязательная runtime dependency документов
- изменение или удаление registry entry не меняет уже созданные документы

### AI

Current MVP AI scope уже считается покрытым:

- `server legal assistant` как отдельный модуль
- document field rewrite v1
- first grounded document AI v2 rollout для согласованных legal sections

Это значит:

- AI больше нельзя описывать как “ещё не начат”
- отсутствие большого chat/drafting-suite не считается незакрытым MVP-блокером

### Route policy

Целевые пользовательские зоны:

- `/account`
- `/assistant`
- `/servers`
- `/servers/[serverSlug]/documents/...`
- `/internal`

`/app` не считается primary product zone.

## Что уже есть в repo, но не открывает MVP заново

### Post-MVP template documents

В репозитории уже есть первые post-MVP template document families:

- `attorney_request`
- `legal_services_agreement`

Это не делает MVP “незакрытым обратно”.
Эти модули надо трактовать как post-MVP expansion поверх уже закрытого MVP.

Зафиксировано:

- подпись персонажа хранится на уровне персонажа как изображение и фиксируется в `signatureSnapshot`
- `attorney_request` использует именно активную подпись выбранного персонажа и freeze-ит её в документе
- последующая замена подписи в профиле не меняет уже созданные документы
- `legal_services_agreement` живёт в той же server-scoped documents architecture, но остаётся отдельной rigid-template line со своей renderer/asset спецификой

### Forum automation

- forum automation для `ogp_complaint` может существовать технически
- она не считается required user-facing MVP capability
- cookies / forum session не считаются обязательным пользовательским вводом
- `manual publication_url` остаётся максимум optional metadata / fallback

## Что не входит в current agreed MVP

- новые document families beyond current repo-state
- превращение `/app` обратно в primary user zone
- reusable template/PDF/JPG documents как required часть MVP
- forum automation как обязательный user success path
- standalone trustors registry как обязательная runtime dependency documents
- broad document-AI suite, chat UI, full-document rewrite и другой large AI surface beyond current helper scope
- `Docker Compose` как обязательный current production runtime

## Зафиксированные продуктовые компромиссы

- OGP success state не зависит от live forum publication
- trustor registry не становится source of truth для уже созданного документа
- template documents используют character-scoped signature assets и document snapshots, а не live profile after first save
- `Supabase Storage` используется для character signature assets, но не превращается в общий upload-centric document flow для всего продукта

## What Comes After MVP

Следующие линии уже относятся к future/post-MVP:

- deeper grounded document AI expansion
- deeper trustors expansion beyond current `/account/trustors` CRUD + optional prefill
- дальнейшее развитие template documents beyond current implemented families
- deeper operational/admin maturity

Важно:

- это future options, а не недоделанные обязательные части уже закрытого MVP
- forum automation не возвращается в required scope
- trustors registry не возвращается в required scope
- `/app` не возвращается как primary product zone
