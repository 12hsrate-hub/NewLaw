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

Текущий подшаг.

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

Что должно войти:

- `Server Actions` выбора активного сервера
- `Server Actions` выбора активного персонажа
- синхронизация `UserServerState` между `SSR`, actions и UI
- устойчивый redirect/status flow после смены выбора

### 04.3 manual character management

Что должно войти:

- список персонажей пользователя по выбранному серверу
- empty state с CTA на создание персонажа
- ручное создание персонажа
- редактирование персонажа
- серверные проверки:
  - максимум `3` персонажа на сервер для одного аккаунта
  - запрет дубликата паспорта в рамках `account + server`
  - `nickname = fullName`

### 04.4 character roles and access flags

Что должно войти:

- минимальный UX для ролей
- минимальный UX для `access_flags`
- сохранение только на уровне `character_id`
- без сложной матрицы прав и без полноценной админки

## Статус

- `04.1 protected shell foundation` выполнен
- `04.2 active server and character selection` не начат
- `04.3 manual character management` не начат
- `04.4 character roles and access flags` не начат

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
- если сервер есть, но персонажей нет, показывается empty state с явной пометкой, что создание появится на следующем подшаге
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
