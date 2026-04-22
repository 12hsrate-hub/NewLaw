# План 04: Trustors

## Статус решения

Standalone trustors registry не является обязательной частью MVP.

Зафиксировано:

- current `OGP representative` и `claims representative` flows уже работают через trustor snapshot inside document
- standalone registry не является обязательной runtime dependency document flow
- `trustor snapshots are enough for MVP`
- standalone registry остаётся optional convenience line
- если later модуль всё же появится, его target route = `/account/trustors`
- текущий реализованный post-MVP step = inline create/edit/soft-delete UX внутри `/account/trustors`
- document-side choose-from-registry остаётся отдельным следующим шагом и не должен смешиваться с registry CRUD
- registry CRUD не должен добавлять `trustorId` dependency в `documents` и не должен менять snapshot-only document model

## Цель блока

Зафиксировать future architecture для optional trustors registry без расхождений с уже работающим snapshot-подходом.

Этот блок больше не трактуется как обязательный standalone CRUD-этап для MVP.

## Что входит

- future reusable registry внутри связки `user + server`
- owner-only list / create / edit / soft delete later
- optional choose-from-registry prefill для document flows
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

На текущем этапе trusted baseline для registry такой:

- отдельная `Trustor` entity как reusable account-owned и server-scoped registry record
- owner-only route `/account/trustors` внутри existing account zone
- grouped-by-server overview с честными empty states и `?server=<serverCode>` focus pattern
- inline create/edit entry points внутри server groups
- safe soft delete через `deletedAt` без hard delete
- readiness badge считается из `fullName + passportNumber`
- soft-deleted trustors скрыты из default overview

Следующий отдельный post-MVP step может later добавить:

- optional choose-from-registry prefill inside OGP/claims

При этом по-прежнему не должны появиться:

- `trustorId` в document model
- save-back из document snapshot в registry
- live dependency уже созданных документов от registry

## Future shape, если registry later понадобится дальше

### Route policy

- target route = `/account/trustors`
- модуль живёт в account zone как profile-management / reusable-data зона
- модуль не должен жить внутри `/servers/[serverSlug]/documents/...`
- модуль не должен превращаться в server workflow hub

### Relationship с document flows

- `OGP complaints` и claims могут later использовать `choose from registry` только как convenience prefill
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

## Критерии завершения

- product decision зафиксирован без противоречий с уже работающим repo
- trustor snapshots признаны достаточными для MVP
- standalone registry описан как optional convenience line
- target route для future registry зафиксирован как `/account/trustors`
- registry CRUD внутри `/account/trustors` работает отдельно от document model
