# 09 — OGP Forum Automation

## Статус блока

Блок открыт.

Зафиксировано:

- forum automation относится только к `ogp_complaint`
- claims не получают publication capability по умолчанию
- first automation scope later — только `create`
- future publish всегда должен опираться только на latest generated `BBCode`
- owner-only publication policy уже зафиксирована

## Цель блока

Добавить OGP-specific publication automation так, чтобы:

- publish action жил только в owner-only editor route `ogp_complaint`
- forum automation не смешивалась с claims и template documents
- publish lifecycle опирался только на persisted generation artifacts
- account-scoped forum auth foundation жила отдельно от document payload

## Зафиксированная архитектура

### Scope

В блок входят только OGP-specific сценарии:

- account-scoped forum auth / integration
- future publish create для `ogp_complaint`
- future resync/update для уже automation-owned forum publication

В блок не входят:

- claims publication
- template documents publication
- universal publication engine для всех document families
- precedents-aware publication logic

### Auth / ownership model

Для automation фиксируется per-user forum session model:

- публикация later идёт от forum-аккаунта самого пользователя
- forum session принадлежит `Account`, а не `Document` и не `Character`
- raw cookies/session нельзя хранить в UI и docs
- session хранится только server-side и только в зашифрованном виде

### Lifecycle

Publication later соотносится с общей `Document.status` моделью:

- `draft`
- `generated`
- `published`

Для OGP publish later допустим только из latest generated `BBCode`.
Если документ modified after generation, publish должен блокироваться до regenerate.

## Подшаги

### 09.2 — Forum auth / integration foundation

Что входит:

- account-scoped `ForumSessionConnection`
- зашифрованное хранение forum session
- validate/connect/disconnect foundation
- provider client только для `forum.gta5rp.com`
- минимальный UI в account-scoped security/integration зоне
- read-only connection state в OGP editor

Что не входит:

- actual publish create
- update/resync forum publication
- claims publication
- universal publication engine

Текущий результат шага:

- forum session connection живёт отдельно от документов как account-scoped модель
- поддерживаются состояния:
  - `not_connected`
  - `connected_unvalidated`
  - `valid`
  - `invalid`
  - `disabled`
- raw forum session хранится только в зашифрованном виде через server-side encryption abstraction
- provider foundation `forum.gta5rp.com` уже умеет:
  - провалидировать сохранённую session
  - безопасно извлечь `forumUserId` и `forumUsername`, если это удалось
- owner account уже может:
  - подключить / обновить forum session
  - провалидировать её отдельно
  - отключить connection
- новый account-scoped route `/account/security` теперь показывает forum integration foundation
- OGP editor уже читает read-only connection state, но publish button ещё не появляется
- claims routes и claims UI по-прежнему не получают publication capability

### 09.3 — OGP publish create action + persistence

Что позже должно войти:

- owner-only publish action на `/servers/[serverSlug]/documents/ogp-complaints/[documentId]`
- publish только из latest generated `BBCode`
- first successful create forum thread/post
- persistence publication metadata и external forum identifiers

### 09.4 — OGP resync / update flow

Что позже должно войти:

- update already automation-owned publication
- `outdated -> current`
- failed/outdated UX
- idempotent resync behavior

## Acceptance criteria

### Архитектура готова

- forum automation всё ещё ограничена `ogp_complaint`
- account-scoped session отделена от documents и claims
- в коде нет shared/system forum identity
- OGP editor читает connection state, но не публикует
- claims и template documents не получают publication capability

### Можно идти в следующий code-step

- secure session storage уже существует
- validate/disconnect flow уже существует
- provider client foundation уже существует
- account UI placement зафиксирован
- owner-only connection model уже работает
