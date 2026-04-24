# 12 — Post-MVP Template Documents

## Статус блока

Это отдельная **post-MVP** линия.
Она не смешивается с закрытым current agreed MVP, но уже реально вошла в repo как post-MVP expansion.

Текущие реализованные document families внутри этой линии:

- `attorney_request`
- `legal_services_agreement`

Этот файл нужен не как первичное обсуждение, а как **актуальный source of truth для дальнейшего развития template/PDF/JPG documents**.

## Общая рамка

Template documents:

- живут в общей server-scoped documents architecture
- не являются частью account zone
- не смешиваются с `OGP complaints`, claims family и `BBCode`-flow
- используют существующую snapshot-модель документов
- не используют forum publication как default capability

Актуальная route-policy для уже существующих families:

- `/servers/[serverSlug]/documents/attorney-requests`
- `/servers/[serverSlug]/documents/legal-services-agreements`

Правило на будущее:

- новые template families тоже должны получать явный family slug внутри `/servers/[serverSlug]/documents/...`
- generic `/documents/templates/...` больше не считается target route-contract

## Что уже реально есть в repo

### `attorney_request`

Зафиксировано:

- это первый живой template/PDF/JPG consumer
- документ привязывается к выбранным `server`, `character` и `trustor`
- используется rigid template, а не свободный редактор текста
- generation читает snapshot документа, а не live trustor/profile state
- используется character-scoped image signature
- при первом сохранении/первой генерации фиксируется frozen `signatureSnapshot`
- последующая замена подписи в профиле персонажа не меняет старые документы

### `legal_services_agreement`

Зафиксировано:

- это отдельный `document_type`, не смешанный с `attorney_request`
- документ живёт в той же server-scoped documents architecture
- текст эталона должен сохраняться `1-в-1`, кроме replaceable fields
- QR в договоре статичный
- публичный реестр/публичная публикация как продуктовый capability для этого документа не нужны
- если в эталонном тексте упоминается публикация, сам текст эталона не переписывается, но функционал публикации не реализуется
- текущий renderer и export этого документа остаются отдельной rigid-template линией и не должны задавать default policy для всех будущих template documents

## Каноническая модель данных и snapshots

Для template documents зафиксировано:

- document создаётся только в выбранном server context
- author определяется по выбранному персонажу
- trustor, если участвует, фиксируется через document snapshot
- first-save snapshot policy такая же, как у других document families
- изменения trustor registry entry не меняют уже созданные документы
- changes in character profile не должны ретроактивно менять уже созданный template document

## Каноническая policy по подписи персонажа

Базовая и reusable policy для template/PDF/JPG documents:

- подпись хранится на уровне персонажа как изображение
- подпись не является общей для всех персонажей аккаунта
- у персонажа может быть исторический набор подписей
- только одна подпись активна одновременно
- active signature используется как default source для новых template documents
- при первом сохранении/первой генерации документа фиксируется frozen `signatureSnapshot`
- последующая замена подписи в профиле не меняет уже созданные документы

Это уже действительно реализовано и используется в `attorney_request`.

Важно:

- старые spike-решения про шрифтовую автогенерацию подписи не должны трактоваться как каноническая policy для template documents
- если отдельный renderer временно использует свой signature workaround, это надо считать локальным implementation detail, а не reusable default для линии template documents

## `attorney_request`: актуальная product policy

Для `attorney_request` зафиксировано:

- используется именно активная подпись выбранного персонажа
- финальная генерация блокируется понятной ошибкой, если обязательная подпись отсутствует или недоступна
- QR статичный и зависит от конкретного шаблона
- document snapshot включает использованную подпись и её storage metadata

## `legal_services_agreement`: актуальная product policy

Для `legal_services_agreement` зафиксировано:

- договор привязывается к выбранным `server`, `character` и `trustor`
- текст эталона не переписывается
- replaceable fields живут отдельно и подставляются в rigid template
- QR остаётся статичным элементом шаблона
- document создаётся и редактируется внутри server-scoped documents area
- document сохраняет snapshots автора и доверителя
- отсутствие публичной публикации как product feature не меняет текст эталона

## Что не должно возвращаться в эту линию

В template documents по умолчанию не должны возвращаться:

- `publication_url`
- forum sync
- forum automation
- зависимость от `/app` shell state
- live dependency от trustor registry
- свободный rich-text editor шаблона

## Что остаётся будущей работой

Следующие шаги остаются post-MVP/future, а не “нужно закрыть для MVP”:

- расширение каталога template document families beyond current repo-state
- выравнивание отдельных renderer-исключений к одной reusable template policy
- развитие shared export/render contracts для template/PDF/JPG documents
- дальнейшая калибровка rigid-template documents без превращения их в свободный document builder
