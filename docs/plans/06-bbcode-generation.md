# План 06: BBCode Generation

## Цель этапа

Подготовить стабильную генерацию итогового форумного BBCode из документного слепка.

Текущий OGP generator уже доведён до template-driven модели для текущих server templates: `ogp_self` и `ogp_representative` рендерятся через единый normalized render context и не читают live trustor registry.

## Что входит

- серверная генерация BBCode
- хранение последней сгенерированной версии
- фиксация версий права, шаблона и схемы формы
- режим просмотра и копирования
- сценарий `Пересобрать` через новый черновик-копию
- публикационная ссылка форума и ручная синхронизация
- template-driven OGP renderer для веток `ogp_self` и `ogp_representative`
- единый generation validation contract для author snapshot, trustor snapshot и OGP payload

## Что не входит

- редактирование BBCode руками внутри приложения
- автоматическая публикация на форум
- автоматическая сверка форума и сайта

## Основные задачи

1. Реализовать генератор BBCode на основе документного слепка.
2. Сохранять `last_generated_bbcode` и метаданные генерации.
3. Помечать документ как измененный после генерации при любой последующей правке.
4. Сбрасывать флаг синхронизации сайта и форума после правок.
5. Реализовать действие `Пересобрать` как создание нового черновика-копии.
6. Разрешить хранение одной ссылки публикации.
7. Валидировать домен публикации как `https://forum.gta5rp.com/`.
8. Реализовать ручную отметку синхронизации для опубликованного документа.

## Критические правила этапа

- BBCode в MVP только для просмотра и копирования
- автоподтягивание данных персонажа действует только до первой генерации
- ссылка публикации одна
- номер обращения не проверяется на уникальность
- OGP generation использует только persisted document payload, persisted author snapshot, persisted trustor snapshot и persisted evidence snapshot
- trustor registry может быть только prefill source до сохранения document snapshot, но не live source для generation
- required OGP fields не расширяются неявно: `appealNumber`, `organizationName`, `subjectLabel`, `incidentAt`, `situationDescription`, `violationSummary`, минимум один evidence item
- `appealNumber` в OGP generation contract — digits only
- evidence рендерится из persisted evidence rows как `[URL='...']labelSnapshot[/URL]`, сортируется по `sortOrder` и соединяется запятой
- bottom date берётся на момент generation в Moscow timezone и формате `DD.MM.YYYY`
- подпись строится как первая буква первого слова + "." + последнее слово

## Критерии завершения

- пользователь может получить итоговый BBCode
- после генерации сохраняются все версионные поля
- `self` и `representative` ветки дают детерминированный BBCode по текущим server templates
- `Пересобрать` создает новый черновик, а не перезаписывает существующий документ
- ссылка форума и ручная синхронизация работают по правилам MVP
