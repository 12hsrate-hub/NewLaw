# План 04: Shell and Character Management

## Цель блока

Собрать следующий доменный блок после завершённого `account-security`:

- protected shell для `/app`
- server context пользователя
- active server / active character
- read-only и затем editable контур для управления персонажами

Этот блок не должен смешиваться с документами, доверителями, `BBCode`, форумом, `AI` и полноценной админкой.

## Структура подшагов

### 04.1 protected shell foundation

Выполненный подшаг.

Что входит:

- layout для `/app`
- базовый header
- read-only `SSR` context через `getAppShellContext`
- загрузка `account`, списка серверов, активного сервера, персонажей выбранного сервера и активного персонажа
- безопасный fallback при отсутствии или битом `UserServerState`
- empty state без серверов
- empty state для сервера без персонажей

Что не входит:

- мутации выбора сервера
- мутации выбора персонажа
- создание персонажа
- редактирование персонажа
- роли и `access_flags`

### 04.2 active server and character selection

Выполненный подшаг.

Что входит:

- `Server Actions` выбора активного сервера
- `Server Actions` выбора активного персонажа
- синхронизация `UserServerState` между `SSR`, actions и UI
- минимальный UI в header для выбора сервера и персонажа
- устойчивый redirect/status flow после смены выбора

Что не входит:

- создание персонажа
- редактирование персонажа
- роли и `access_flags`
- soft delete cleanup
- document flow

### 04.3 manual character management

Что входит:

- список персонажей пользователя по выбранному серверу
- empty state с CTA на создание персонажа
- ручное создание персонажа
- редактирование персонажа
- серверные проверки:
  - максимум `3` персонажа на сервер для одного аккаунта
  - запрет дубликата паспорта в рамках `account + server`
  - `nickname = fullName`

Что не входит:

- роли и `access_flags`
- delete / soft delete
- document-lock при переключении персонажа
- документы
- доверители
- `BBCode`
- форум
- `AI`
- полноценная админка

### 04.4 character roles and access flags

Что входит:

- минимальный UX для ролей
- минимальный UX для `access_flags`
- сохранение только на уровне `character_id`
- без сложной матрицы прав и без полноценной админки

Что не входит:

- delete / soft delete персонажей
- document-related блокировки
- отдельный permission-center
- `super_admin` и platform-level права через персонажа
- документы
- доверители
- `BBCode`
- форум
- `AI`
- полноценная админка

## Статус

- `04.1 protected shell foundation` выполнен
- `04.2 active server and character selection` выполнен
- `04.3 manual character management` выполнен
- `04.4 character roles and access flags` выполнен

## Что вошло в 04.1 по факту

- `/app` работает как входная точка protected shell
- layout защищённой части использует существующий `requireProtectedAccountContext`
- `getAppShellContext` переведён в read-only `SSR` режим без записи выбора в БД
- shell читает:
  - `account`
  - список активных серверов
  - `UserServerState`
  - активный сервер
  - персонажей активного сервера
  - активного персонажа
- если `UserServerState` отсутствует, shell использует безопасный fallback:
  - первый доступный сервер
  - первый доступный персонаж выбранного сервера
- если `UserServerState` битый, shell мягко восстанавливает контекст без падения страницы
- в header явно показываются:
  - текущий `account email`
  - `account login`
  - активный сервер
  - активный персонаж
  - количество доступных серверов
  - количество персонажей на активном сервере
- `/app` переведён на read-only overview screen
- если серверов нет, показывается понятный empty state
- если сервер есть, но персонажей нет, показывается empty state для безопасного перехода к следующему UI-блоку управления персонажами
- `/app/security` и `/app/admin-security` продолжают использовать тот же shell context и не ломаются

## Что сознательно не вошло в 04.1

- actions выбора сервера
- actions выбора персонажа
- формы персонажей
- создание и редактирование персонажей
- роли и `access_flags`
- document flow
- доверители
- `BBCode`
- форум
- `AI`
- полноценная админка

## Что вошло в 04.2 по факту

- в `AppShellHeader` добавлен минимальный UI для выбора активного сервера
- рядом добавлен минимальный UI для выбора активного персонажа
- выбор сервера идёт через отдельный `Server Action`
- выбор персонажа идёт через отдельный `Server Action`
- после выбора сервера состояние сохраняется в `UserServerState`
- после выбора персонажа состояние сохраняется в `UserServerState`
- shell переживает reload и показывает то же активное состояние, которое записано в БД
- если выбран новый сервер без персонажей, shell корректно показывает `activeCharacter = null`
- character selection дополнительно защищён от подмены `serverId` в форме:
  - выбрать можно только персонажа текущего active server
  - нельзя выбрать персонажа другого сервера
  - нельзя выбрать персонажа, которого нет у текущего аккаунта на выбранном сервере
- `/app/security` и `/app/admin-security` продолжают использовать тот же shell context и не ломаются

## Что сознательно не вошло в 04.2

- создание персонажа
- редактирование персонажа
- роли и `access_flags`
- soft delete и расширенный edge-case cleanup
- document-lock на переключение персонажа
- документы
- доверители
- `BBCode`
- форум
- `AI`
- полноценная админка

## Acceptance criteria для 04.2

- пользователь может сменить active server в header
- после reload выбранный сервер сохраняется
- пользователь может сменить active character только внутри текущего active server
- нельзя выбрать персонажа другого сервера
- нельзя выбрать чужого персонажа
- битый `UserServerState` по-прежнему не ломает shell
- empty state без серверов остаётся рабочим
- empty state для сервера без персонажей остаётся рабочим
- `/app/security` и `/app/admin-security` не ломаются от selection-слоя

## Основные файлы 04.2

- `src/components/product/shell/app-shell-header.tsx`
- `src/server/actions/shell.ts`
- `src/server/app-shell/selection.ts`
- `src/server/app-shell/state.ts`
- `src/db/repositories/user-server-state.repository.ts`
- `src/db/repositories/server.repository.ts`
- `src/app/(protected)/app/page.tsx`
- `src/components/product/shell/protected-shell-overview-section.tsx`

## Проверки 04.2

Для этого подшага добавлены проверки на:

- смену active server через action
- сохранение active server в state
- смену active character внутри выбранного сервера
- блокировку выбора персонажа другого сервера
- блокировку выбора чужого персонажа
- безопасный redirect при подмене `serverId` в character selection action

## Что вошло в 04.3 по факту

- в `/app` добавлен отдельный базовый блок управления персонажами для текущего active server
- показывается список персонажей пользователя по выбранному серверу
- если на сервере нет персонажей, показывается empty state с `CTA` на создание первой карточки
- добавлена ручная форма создания персонажа только с обязательными полями:
  - `fullName`
  - `passportNumber`
- добавлена базовая форма редактирования существующего персонажа
- `email` не используется как поле персонажа
- создание и редактирование не смешаны с ролями и `access_flags`
- после создания нового персонажа action делает его active character для текущего сервера
- при редактировании персонажа selection-контур остаётся консистентным
- в server action-слое сохранены ограничения:
  - максимум `3` персонажа на сервер для одного аккаунта
  - запрет одинакового паспорта в рамках `account + server`
  - запрет редактировать чужого или отсутствующего персонажа
- на момент `04.3` уже существующие роли и `access_flags` не затирались, даже несмотря на то что UI этого шага их ещё не показывал

## Что сознательно не вошло в 04.3

- роли и `access_flags`
- delete / soft delete персонажей
- document-related блокировки
- документы
- доверители
- `BBCode`
- форум
- `AI`
- полноценная админка

## Acceptance criteria для 04.3

- в `/app` отображается базовый блок управления персонажами
- если персонажей нет, пользователь видит empty state и `CTA` на создание
- персонажа можно создать только вручную
- обязательные поля создания и редактирования:
  - `fullName`
  - `passportNumber`
- нельзя создать больше `3` персонажей на один сервер для одного аккаунта
- нельзя создать или сохранить дублирующийся паспорт в рамках `account + server`
- нельзя редактировать чужого персонажа
- после create/edit shell и active selection остаются консистентными
- `/app/security` и `/app/admin-security` не ломаются от этого слоя

## Основные файлы 04.3

- `src/app/(protected)/app/page.tsx`
- `src/components/product/characters/character-form-card.tsx`
- `src/components/product/characters/character-management-section.tsx`
- `src/server/actions/characters.ts`
- `src/server/characters/manual-character.ts`
- `src/schemas/character.ts`

## Проверки 04.3

Для этого подшага добавлены проверки на:

- ручное создание персонажа
- enforcement лимита `3` персонажа на сервер
- enforcement уникальности паспорта внутри `account + server`
- безопасный отказ при попытке редактировать чужого персонажа
- empty state блока управления персонажами
- консистентность create/edit действий относительно shell и active selection

## Что вошло в 04.4 по факту

- в существующий create/edit flow персонажа встроен минимальный блок ролей и `access flags`
- роли и `access flags` редактируются только на уровне `character_id`
- для create персонажа роли и `access flags` могут оставаться пустыми
- для edit существующие значения корректно подгружаются в форму
- при сохранении разрешены только machine keys из зафиксированного набора
- не добавлена новая permission-система и не смешаны `super_admin` / platform-level права с персонажем
- create/edit продолжает работать внутри уже готового shell и selection-контура без побочных мутаций

## Что сознательно не вошло в 04.4

- delete / soft delete персонажей
- document-related блокировки
- отдельная permission-админка
- `super_admin` и platform-level роли через персонажа
- документы
- доверители
- `BBCode`
- форум
- `AI`
- полноценная админка

## Acceptance criteria для 04.4

- роли и `access flags` сохраняются только для своего персонажа
- create персонажа с пустыми roles / `access_flags` остаётся рабочим
- edit персонажа корректно подгружает и сохраняет существующие значения
- через форму и action нельзя записать неразрешённые role / flag значения
- нельзя изменить roles / `access_flags` чужого персонажа
- shell и selection после save не ломаются
- `/app/security` и `/app/admin-security` не ломаются

## Основные файлы 04.4

- `src/components/product/characters/character-form-card.tsx`
- `src/components/product/characters/character-management-section.tsx`
- `src/server/actions/characters.ts`
- `src/server/characters/manual-character.ts`
- `src/schemas/character.ts`

## Проверки 04.4

Для этого подшага добавлены проверки на:

- сохранение roles и `access_flags` для своего персонажа
- create персонажа с пустыми roles и `access_flags`
- безопасный отказ при попытке записать мусорные значения через форму
- корректное чтение существующих roles и `access_flags` в edit-форме
- сохранение shell-консистентности после save

## Acceptance criteria для 04.1

- авторизованный пользователь может открыть `/app`
- shell рендерится через `SSR` и не требует клиентского state-менеджера
- active server и active character отображаются явно
- отсутствие `UserServerState` не ломает страницу
- битый `UserServerState` не ломает страницу
- если серверов нет, пользователь видит empty state
- если сервер есть, но персонажей нет, пользователь видит empty state с пометкой про следующий шаг
- `mustChangePassword` и существующие protected guards продолжают работать как раньше
- `/app/security` и `/app/admin-security` не ломаются от изменений shell foundation

## Основные файлы подшага

- `src/app/(protected)/app/layout.tsx`
- `src/app/(protected)/app/page.tsx`
- `src/components/product/shell/app-shell-header.tsx`
- `src/components/product/shell/protected-shell-overview-section.tsx`
- `src/server/app-shell/context.ts`
- `src/server/app-shell/state.ts`
- `src/server/auth/protected.ts`
- `src/app/(protected-security)/app/security/page.tsx`
- `src/app/(protected-admin)/app/admin-security/page.tsx`

## Проверки 04.1

Для этого подшага добавлены проверки на:

- корректную сборку `SSR` shell context
- fallback при отсутствии `UserServerState`
- fallback при битом `UserServerState`
- empty state без серверов
- empty state без персонажей
- рендер `/app` как read-only protected shell
