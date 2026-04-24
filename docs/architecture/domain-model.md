# Доменная модель

## Базовая иерархия

Ключевая модель проекта:

`Account -> Server -> Characters -> Documents`

Это не просто визуальная схема, а правило проектирования:

- account zone, server-scoped modules и internal contour строятся вокруг неё
- document flows фиксируют snapshots внутри этой цепочки
- уже созданный документ не должен ретроактивно зависеть от live profile/trustor changes

## Основные сущности

### Account

Аккаунт — это авторизованный пользователь системы.

На уровне аккаунта живут:

- связь с `Supabase Auth`
- признак `super_admin`
- account-scoped security state
- account-scoped forum integration foundation

`super_admin` — уровень аккаунта, а не персонажа.

### Server

Сервер — обязательный контекст для:

- персонажей
- доверителей
- документов
- law corpus / precedents corpus
- assistant

Для server-scoped модулей source of truth по серверу — URL, а не `/app` shell state.

### Character

Персонаж — основной author context документа внутри выбранного сервера.

Зафиксировано:

- максимум `3` персонажа на `account + server`
- паспорт уникален внутри `account + server`
- роли и `access_flags` привязаны к `character_id`
- `/account/characters` — profile-management зона, а не document hub
- self-service create/update управляет только профильными полями
- self-service character flows не должны менять `CharacterRole` и `CharacterAccessFlag`
- базовая безопасная роль нового персонажа — `citizen`
- служебные роли и access flags меняются только через admin/internal контур

### Trustor

Trustor — reusable сущность в контексте `user + server`.

Важно:

- document flows остаются snapshot-based
- `/account/trustors` — convenience layer
- trustor registry не становится обязательной runtime dependency OGP/claims
- изменение или удаление trustor registry entry не меняет уже созданные документы

### CharacterSignature

`CharacterSignature` — character-scoped asset-сущность для template/PDF/JPG documents.

Зафиксировано:

- подпись принадлежит персонажу, а не аккаунту
- у персонажа может быть исторический набор подписей
- активной одновременно считается только одна подпись
- первый сохранённый/сгенерированный template document фиксирует frozen `signatureSnapshot`
- последующая замена активной подписи не меняет старые документы

Канонический живой consumer этого правила:

- `attorney_request`

### CharacterAccessRequest

`CharacterAccessRequest` — server-scoped заявка пользователя на выдачу адвокатского доступа своему персонажу.

Зафиксировано:

- заявка принадлежит `account`, `server`, `character`
- текущий `requestType`:
  - `advocate_access`
- lifecycle status:
  - `pending`
  - `approved`
  - `rejected`
  - `cancelled`
- заявка сама по себе не выдаёт доступ
- approve/reject доступны только `super_admin`
- approve добавляет персонажу `lawyer + advocate`
- reject не меняет роли и access flags
- владелец персонажа не может сам одобрить свою заявку

Текущие живые consumer routes:

- `/account/characters` — статус и подача заявки
- `/internal/access-requests` — pending review и ручная ревизия уже выданных назначений

## Document

Документ — самостоятельный persisted объект со своим жизненным циклом.

Ключевые правила:

- документ относится к `account`, `server`, `character`
- trustor внутри документа живёт как snapshot
- author snapshot после first save не пересобирается из live character profile
- для template documents подпись тоже живёт как snapshot
- owner документа = аккаунт
- actor документа = персонаж в snapshot

## Текущие document families

В текущем repo-state существуют:

- `ogp_complaint`
- `rehabilitation`
- `lawsuit`
- `attorney_request`
- `legal_services_agreement`

### MVP families

- `ogp_complaint`
- claims family: `rehabilitation`, `lawsuit`

### Post-MVP template families

- `attorney_request`
- `legal_services_agreement`

При этом:

- template documents не смешиваются с `BBCode` flow
- forum publication не считается default capability template families
- `legal_services_agreement` остаётся отдельной rigid-template line и не должен тихо задавать reusable policy для всех template documents

## Snapshot rule

Snapshot — центральное правило document model.

Зафиксировано:

- snapshot фиксируется при первом сохранении черновика
- после фиксации документ больше не должен автоматически переписываться изменениями из character/trustor registry
- это же правило распространяется на image-signature персонажа
- template documents могут использовать current active signature только до first save / first generation

## Forum automation

Forum automation живёт только как optional / temporary capability для `ogp_complaint`.

Это означает:

- claims не наследуют publication workflow автоматически
- template documents не должны проектироваться через forum publication model
- cookies / forum session не считаются обязательным пользовательским вводом

## AI

AI больше не считается “пустой будущей линией”.

В repo уже существуют:

- `server legal assistant`
- document field rewrite v1
- first grounded document AI v2 rollout

Но большой AI-suite по-прежнему остаётся future expansion, а не закрытым отдельным направлением.
