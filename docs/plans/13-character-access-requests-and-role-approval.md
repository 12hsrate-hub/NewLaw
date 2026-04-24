# 13 — Заявки на доступы персонажа и запрет самоназначения ролей

## Статус блока

Статус: `active / security correction`

Это не post-MVP enhancement и не scope expansion.
Это обязательное исправление неправильной access-control модели, потому что текущий repo-state позволяет пользователю самому назначать себе роли и access flags.

## Проблема

Текущая self-service линия управления персонажами нарушает согласованную модель доступа.

Подтверждённый repo-state:

- `src/components/product/characters/character-form-card.tsx` реально рендерит чекбоксы `roleKeys` и `accessFlags`
- `src/server/actions/characters.ts` реально читает `roleKeys/accessFlags` из `FormData`
- `src/server/characters/manual-character.ts` реально пробрасывает их в `createCharacterManually` / `updateCharacterManually`
- `src/db/repositories/character.repository.ts` реально записывает `CharacterRole` и `CharacterAccessFlag`, а при update ещё и делает `deleteMany + createMany`
- `src/schemas/character.ts` включает `roleKeys/accessFlags` в self-service create/update input

Следствие:

- пользователь при создании/редактировании персонажа может выбирать роли
- пользователь может выбирать access flags
- обычное редактирование персонажа может менять `CharacterRole` и `CharacterAccessFlag`
- пользователь может попытаться выдать себе:
  - `lawyer`
  - `advocate`
  - `server_editor`
  - `server_admin`
  - `tester`

Скрытие чекбоксов на фронтенде само по себе проблему не решает.
Нужно закрыть и серверную возможность self-assignment через `FormData` и `Server Actions`.

## Правильная модель

Зафиксированная целевая access-model:

- регистрация создаёт обычный аккаунт
- пользователь создаёт персонажа только с профильными данными
- новый персонаж получает только безопасную базовую роль `citizen`
- новый персонаж не получает `advocate`, `server_editor`, `server_admin`, `tester`
- роль `lawyer` и access flag `advocate` выдаются только через заявку пользователя и одобрение администратора
- любые служебные роли и access flags управляются только через admin/internal контур
- представительские document flows доступны только персонажу с `accessFlag: advocate`

## Этап 13.1 — Срочный запрет самоназначения ролей

Цель: быстро закрыть текущую уязвимость до появления полноценной системы заявок.

Что сделать:

- убрать role/access чекбоксы из пользовательской формы персонажа
- убрать чтение `roleKeys/accessFlags` из пользовательских create/update actions
- `createCharacterManually` должен создавать персонажа с безопасными значениями:
  - `roleKeys: ["citizen"]`
  - `accessFlags: []`
- `updateCharacterManually` должен обновлять только профильные поля и не трогать роли/access flags
- repository update для обычного редактирования не должен делать `roles.deleteMany` и `accessFlags.deleteMany`
- любые `roleKeys/accessFlags`, вручную отправленные через `FormData`, должны игнорироваться и не применяться

Критерий приёмки:

- обычный пользователь не может сам себе выдать `lawyer`, `advocate`, `server_admin`, `server_editor`, `tester`
- это закрыто и через UI, и через подмену `FormData`

## Этап 13.2 — Разделение self-service и admin-only мутаций

Цель: развести редактирование профиля и админское управление назначениями.

Что сделать:

- self-service schemas без `roleKeys/accessFlags`
- admin assignment schema отдельно
- отдельный сервис для изменения `CharacterRole/CharacterAccessFlag`
- этот сервис доступен только `super_admin/internal`
- все изменения ролей/access flags логируются

Критерий приёмки:

- обычные character actions не содержат кода, который меняет роли/access flags
- роли/access flags меняются только через admin-only сервис

## Этап 13.3 — Модель заявки на адвокатский доступ

Цель: добавить заявку пользователя на получение адвокатского доступа.

Предлагаемая модель:

`CharacterAccessRequest`

Поля:

- `id`
- `accountId`
- `serverId`
- `characterId`
- `requestType`
- `status`
- `requestComment`
- `reviewComment`
- `reviewedByAccountId`
- `reviewedAt`
- `createdAt`
- `updatedAt`

Enums:

`CharacterAccessRequestType`:

- `advocate_access`

`CharacterAccessRequestStatus`:

- `pending`
- `approved`
- `rejected`
- `cancelled`, если потребуется

Правила:

- пользователь создаёт заявку только на своего персонажа
- нельзя создать заявку на чужого персонажа
- нельзя создать заявку на soft-deleted персонажа
- нельзя создать повторную pending-заявку на тот же `characterId + requestType`
- если у персонажа уже есть `advocate`, новая заявка не нужна
- заявка сама по себе не выдаёт доступ

## Этап 13.4 — Пользовательский UI заявки

Цель: пользователь видит статус адвокатского доступа и может отправить заявку.

Что сделать:

- в `/account/characters` рядом с персонажем показывать:
  - нет доступа
  - заявка на рассмотрении
  - заявка отклонена
  - адвокатский доступ выдан
- добавить кнопку/форму `Запросить адвокатский доступ`
- добавить поле комментария/основания
- после отправки показывать понятный статус

Важно:

- не возвращать чекбоксы ролей пользователю
- заявка не должна мгновенно выдавать доступ

## Этап 13.5 — Internal/admin UI для рассмотрения заявок

Цель: администратор рассматривает заявки.

Что сделать:

- добавить internal route, например:
  - `/internal/access-requests`
- добавить пункт в internal nav
- показывать pending-заявки
- отображать:
  - аккаунт
  - email/login
  - сервер
  - персонаж
  - паспорт
  - комментарий пользователя
  - дата заявки
- добавить кнопки:
  - `Одобрить`
  - `Отклонить`
- добавить поле комментария администратора

Approve:

- только `super_admin`
- в транзакции:
  - проверить pending-заявку
  - проверить персонажа
  - добавить роль `lawyer`, если её нет
  - добавить access flag `advocate`, если его нет
  - перевести заявку в `approved`
  - записать `reviewedByAccountId`, `reviewedAt`, `reviewComment`
  - записать audit log

Reject:

- только `super_admin`
- перевести заявку в `rejected`
- роли/access flags не менять
- записать audit log

## Этап 13.6 — Audit log и безопасность

Зафиксировать audit actions:

- `character_access_request_created`
- `character_access_request_approved`
- `character_access_request_rejected`
- `character_role_assignment_changed_admin`, если будет прямое admin-редактирование

Правила:

- обычный пользователь не может approve/reject
- владелец персонажа не может сам одобрить свою заявку
- admin actions должны использовать server-side guard
- все ошибки должны быть безопасными и не раскрывать чужие данные

## Этап 13.7 — Тесты

Нужно добавить или обновить тесты.

Self-service:

- создание персонажа всегда даёт `citizen` и пустые access flags
- пользовательский create игнорирует `roleKeys/accessFlags` из `FormData`
- пользовательский update не меняет существующие роли/access flags
- нельзя выдать себе `lawyer/advocate` через подмену `FormData`

Access request:

- можно создать заявку на своего персонажа
- нельзя создать заявку на чужого персонажа
- нельзя создать дубль pending-заявки
- нельзя создать заявку, если `advocate` уже есть
- approve выдаёт `lawyer + advocate`
- reject ничего не выдаёт
- approve/reject доступны только `super_admin`
- audit log пишется

## Этап 13.8 — Миграция существующих данных

Зафиксировать:

- существующие роли/access flags не удалять автоматически
- нельзя надёжно понять, какие уже выданные роли были легитимными
- destructive cleanup не делать в этой задаче
- можно добавить internal список персонажей с текущими ролями/access flags для ручной проверки
- новая логика должна предотвратить дальнейшее самоназначение

## Документация, которую нужно будет обновить при реализации

- `AGENTS.md`
- `docs/product/mvp-scope.md`
- `docs/architecture/domain-model.md`
- `docs/plans/00-master-plan.md`
- `docs/plans/13-character-access-requests-and-role-approval.md`

В рамках текущей docs-only задачи обновляются только:

- `docs/plans/13-character-access-requests-and-role-approval.md`
- `docs/plans/00-master-plan.md`
- `docs/product/mvp-scope.md`

## Критерии готовности всего блока

Блок считается готовым, когда:

- пользователь не может сам себе назначить роли/access flags
- роли/access flags не читаются из пользовательской формы
- обычное редактирование персонажа не трогает `CharacterRole/CharacterAccessFlag`
- есть заявка на адвокатский доступ
- админ может approve/reject заявку
- approve выдаёт `lawyer + advocate`
- reject не выдаёт доступ
- всё покрыто тестами
- документация синхронизирована
