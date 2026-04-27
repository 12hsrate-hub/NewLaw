# План 08: AI-интеграция

## Статус

`partial`

## Роль шага

Шаг `08` остаётся зонтичной AI-линией.

Это общая зонтичная линия по AI-направлению проекта, а не детальный план одного конкретного AI-подсценария.

Шаг `08` фиксирует:

- что AI в проекте уже реально существует
- какие AI-контуры уже присутствуют в repo
- какие более узкие post-MVP шаги продолжают эту линию

Шаг `08` не должен подменяться шагами `16` и `17`, но и не должен повторять их внутреннюю механику.

## Что уже входит в AI-контур проекта

Текущий реализованный AI-контур включает:

- `server legal assistant`
- `document field rewrite v1`
- first grounded document AI v2 rollout

Это означает:

- AI в проекте уже не считается пустым или не начатым
- `partial` означает только будущее расширение за пределами текущего scope

## Границы шага 08

Шаг `08` описывает только общую AI-линию.

В него не нужно переносить подробности:

- `AI Legal Core`
- `AI Quality Review`
- внутренний review workflow
- внутренняя retrieval-механика
- `LegalQueryPlan`
- `LawFamily`
- `NormRole`
- `applicability scoring`
- `structured selection`
- `direct_basis_status`

Эти детали должны жить только в более узких шагах, если они становятся отдельным источником правды.

## Связь с дальнейшими шагами

Шаг `08` продолжается через более узкие post-MVP линии:

- [16-ai-legal-core.md](./16-ai-legal-core.md) — только `AI Legal Core`
- [17-ai-quality-review.md](./17-ai-quality-review.md) — только `AI Quality Review`
- [18-complaint-narrative-improvement.md](./18-complaint-narrative-improvement.md) — только `Complaint Narrative Improvement v1` для поля `situation_description` в `ogp_complaint`

Правило границ:

- шаг `08` — зонтичная AI-линия
- шаг `16` — только `AI Legal Core`
- шаг `17` — только `AI Quality Review`

Шаг `16` не должен переписывать весь шаг `08`.
Шаг `17` не должен дублировать шаг `16`.

## Что не входит в шаг 08

Не входит:

- client-side direct AI calls как обязательная цель
- embedded chat UI как обязательная цель
- full-document rewrite как обязательная цель
- автоматический review-контур
- автоматическое изменение production-логики
- детальная legal-core логика
- детальный quality-review workflow

## Follow-up после шага 08

После шага `08` отдельными специализированными линиями идут:

- `AI Legal Core`
- `AI Quality Review`
- `Complaint Narrative Improvement v1` как отдельный document AI flow для OGP complaint
- дальнейшее расширение document AI за пределами текущего grounded rollout
- дальнейшая операционная зрелость AI-контура как отдельная линия будущего развития

Но всё это уже не должно смешиваться с зонтичной ролью шага `08`.

## Planned post-MVP module: Complaint Narrative Improvement v1

Для `ogp_complaint` зафиксирован отдельный planned module:

- он улучшает только поле `Подробное описание ситуации`
- он не является общим Legal Q&A
- он не генерирует всю жалобу
- он не заменяет existing `BBCode` generation
- он не подменяет `violation_summary`

Подробный source-of-truth для этой линии:

- [18-complaint-narrative-improvement.md](./18-complaint-narrative-improvement.md)

Граница с already existing document AI:

- current `document field rewrite v1` остаётся general text-improvement affordance
- current grounded rewrite остаётся отдельным legal-grounded contour
- новый complaint narrative flow должен иметь собственный backend contract, prompt/style profile и validation rules, не ломая existing `document-ai` и `OGP BBCode` pipeline
