# План 04: Trustors

## Статус решения

Standalone trustors registry не является обязательной частью MVP, но post-MVP линия уже реально ушла дальше foundation-only этапа.

Зафиксировано:

- current `OGP representative` и `claims representative` flows по-прежнему работают через trustor snapshot inside document
- standalone registry не является обязательной runtime dependency document flow
- `trustor snapshots are enough for MVP`
- standalone registry остаётся optional convenience line
- target route уже реально существует: `/account/trustors`
- registry foundation + grouped overview уже реализованы
- inline create/edit/soft-delete UX внутри `/account/trustors` уже реализованы
- document-side choose-from-registry prefill inside OGP/claims уже существует как optional convenience layer
- registry CRUD и document-prefill не добавляют `trustorId` dependency в `documents` и не меняют snapshot-only document model

## Цель блока

Зафиксировать уже реализованную optional trustors line без расхождений с работающим snapshot-подходом и явно отделить сделанное от дальнейших post-MVP расширений.

Этот блок больше не трактуется как обязательный standalone CRUD-этап для MVP и больше не описывается как “маршрут появится позже”.

## Что уже входит

- reusable registry внутри связки `user + server`
- owner-only grouped overview в `/account/trustors`
- create / edit / soft delete внутри account zone
- optional choose-from-registry prefill для representative document flows
- сохранение строгого разделения между reusable entity и document snapshot

## Что не входит

- обязательная зависимость OGP/claims от registry
- автоматическое обновление старых документов
- загрузка файлов доверителя
- скрытая подмена document snapshot live-данными из registry

## Текущая product policy

- manual inline trustor entry остаётся обязательным fallback
- document flows не должны требовать отдельный registry для representative filing
- уже созданный документ всегда опирается на свой trustor snapshot, а не на live registry entity
- отсутствие standalone registry не делает OGP/claims MVP неполным

## Current post-MVP shape

На текущем этапе trustors registry уже выглядит так:

- отдельная `Trustor` entity как reusable account-owned и server-scoped registry record
- owner-only route `/account/trustors` внутри existing account zone
- grouped-by-server overview с честными empty states и `?server=<serverCode>` focus pattern
- inline create/edit entry points внутри server groups
- safe soft delete через `deletedAt` без hard delete
- document-side choose-from-registry работает только как optional snapshot prefill для representative flows
- readiness badge считается из `fullName + passportNumber`
- soft-deleted trustors скрыты из default overview

При этом по-прежнему не должны появиться:

- `trustorId` в document model
- save-back из document snapshot в registry
- live dependency уже созданных документов от registry

## Что ещё не делает текущая линия

- не показывает restore/archive UI для soft-deleted entries
- не делает bulk management
- не добавляет richer trustor profile beyond current minimal fields
- не делает save-back из document snapshot в registry
- не делает live dependency documents от registry entity

## Future shape, если trustors line понадобится расширять дальше

### Route policy

- target route = `/account/trustors`
- модуль живёт в account zone как profile-management / reusable-data зона
- модуль не должен жить внутри `/servers/[serverSlug]/documents/...`
- модуль не должен превращаться в server workflow hub

### Relationship с document flows

- `OGP complaints` и claims уже могут использовать `choose from registry` только как convenience prefill
- `manual inline entry` остаётся обязательным fallback
- после выбора из registry данные копируются в document snapshot
- после сохранения документа snapshot живёт автономно
- document flow не получает `trustorId` dependency

### Data policy

- registry entity привязана к `user + server`
- document snapshot остаётся отдельным persisted слоем внутри документа
- изменение или удаление registry entry не меняет исторические документы
- save-back из document snapshot в registry не является частью текущего MVP-решения по умолчанию

## Критические правила этапа

- доверители привязаны к `user + server`, а не к `character`
- доверитель внутри документа живет как отдельный слепок
- удаление доверителя не должно менять старые документы
- standalone registry не должен становиться source of truth для уже созданного документа

## Критерии завершения текущего post-MVP среза

- product decision зафиксирован без противоречий с уже работающим repo
- trustor snapshots признаны достаточными для MVP
- standalone registry зафиксирован как optional convenience line, а не blocker
- `/account/trustors` уже существует как owner-only grouped-by-server account route
- registry CRUD внутри `/account/trustors` работает отдельно от document model
- choose-from-registry остаётся только convenience prefill и не ломает snapshot-only документную модель
