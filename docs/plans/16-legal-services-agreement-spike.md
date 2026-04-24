# `legal_services_agreement`

## Что реализуется

`legal_services_agreement` добавляется как отдельный `document_type` внутри общей server-scoped documents architecture.

Документ остаётся rigid template document и после согласования переводится из начального spike в более жёсткий contract:

- отдельный `document_type`, не смешанный с `attorney_request`
- server-scoped create/edit flow внутри `/servers/[serverSlug]/documents/...`
- фиксированный template text из reference PDF без свободного редактора
- snapshot автора и доверителя при первом сохранении
- page-by-page export в виде отдельных PNG-файлов
- pixel-perfect renderer поверх reference asset package
- финальная create/edit/generate validation без свободного редактора текста

## Source of truth

Source of truth по static text/layout:

- reference PDF `Dom Perignon_Nick Name.pdf`
- derived reference pages package из этого PDF

Правило:

- static template text и QR не переписываются под код
- renderer меняет только replaceable fields
- QR остаётся статичным template element из reference package
- если reference asset package недоступен, preview должен честно показать `reference_missing`, а не подменять договор выдуманным текстом

## Утверждённые replaceable fields

Финальный replaceable contract для текущего документа:

- `agreementNumber`
- `registerNumber`
- `agreementDate`
- `servicePeriodStart`
- `servicePeriodEnd`
- `priceAmount`
- `executorFullName`
- `executorPassportNumber`
- `executorPosition`
- `executorPhone`
- `executorIcEmail`
- `trustorFullName`
- `trustorPassportNumber`
- `trustorPhone`
- `trustorIcEmail`

Источник данных:

- данные персонажа берутся из `authorSnapshot`
- данные доверителя берутся из `trustorSnapshot`
- ручными остаются только договорные поля: номер, дата, период, стоимость

## Подпись

Для `legal_services_agreement` используется не image-signature из профиля, а детерминированная шрифтовая подпись:

- подпись персонажа генерируется из `authorSnapshot.fullName`
- подпись доверителя генерируется из `trustorSnapshot.fullName`
- подпись рендерится одним фиксированным cursive font asset
- отдельная загрузка подписи-изображения для этого документа не требуется
- image-signature персонажа не считается source of truth для этого документа

## Export contract

Итоговый export выполняется постранично:

- каждая страница сохраняется отдельным PNG-файлом
- имя файла строится по правилу `ИмяФамилияПерсонажа_ИмяФамилияДоверителя_pX`
- имена файлов нормализуются в безопасный ASCII-вид без пробелов и спецсимволов

HTML preview остаётся вспомогательным developer/user preview-слоем, но итоговый export contract для текущего документа — именно постраничные PNG-файлы.

## Validation policy

Черновик можно сохранять неполным, но generation блокируется при отсутствии обязательных данных из утверждённого replaceable contract.

Проверяются:

- ручные поля договора
- обязательные snapshot-поля персонажа
- обязательные snapshot-поля доверителя
- наличие reference asset package

Отдельно:

- текст договора не редактируется свободно
- reference text из PDF не переписывается под код
- renderer подставляет только утверждённые replaceable fields

## Что должно остаться расширяемым

- template definition и field map
- renderer overlay positions
- точный page overlay calibration
- при необходимости будущий multi-format export поверх текущего postраничного PNG

Нельзя разбрасывать business rules по `routes`, `context`, `UI` и `repository`.
