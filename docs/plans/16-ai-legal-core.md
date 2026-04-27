# Шаг 16. AI Legal Core

## Статус

Post-MVP. Не входит в MVP.

## Назначение

Этот шаг фиксирует только `AI Legal Core`.

Его задача:

- довести базовую юридическую AI-выдачу до рабочего состояния до внедрения `AI Quality Review`
- задать единый правовой pipeline для юридического помощника и AI-доработки описательной части
- обеспечить устойчивый legal grounding через `server_id` и `law_version`

Этот шаг:

- не подменяет [08-ai-integration.md](./08-ai-integration.md)
- не включает слой `AI Quality Review`
- не включает review UI, `fix_instruction`, `AI Behavior Rules` и `regression gate`

## Где применяется

`AI Legal Core` применяется к:

- юридическому помощнику
- AI-доработке описательной части

## Главный принцип

AI отвечает универсально по логике анализа, но только на основании законодательства выбранного сервера.

Из этого следуют обязательные правила:

- источник правды для legal grounding = `server_id + law_version`
- один и тот же пользовательский вопрос может иметь разные корректные ответы на разных серверах
- модель не получает весь закон целиком
- ответ не должен опираться на нормы другого сервера или другой версии закона

## Мультисерверность

`AI Legal Core` должен проектироваться как универсальный слой для всех серверов `Lawyer5RP`.

Запрещено:

- хардкодить законодательство конкретного сервера
- хардкодить названия законов конкретного сервера в логике
- строить выводы без `server_id`
- использовать нормы другого сервера
- смешивать `law_version` разных серверов

Все правовые ответы должны строиться через:

- `server_id`
- `law_version`
- `law_sources` выбранного сервера
- `source_ledger`

Тестовые сценарии тоже должны запускаться с выбранными:

- `server_id`
- `law_version`
- `actor_context`
- `answer_mode`

## Контекст пользователя

Система должна определять один `actor_context`:

- `self` — пользователь действует от себя
- `representative_for_trustor` — пользователь действует в интересах доверителя
- `general_question` — общий вопрос

## Intent

Система должна определять один основной `intent`:

- `law_explanation`
- `situation_analysis`
- `complaint_strategy`
- `evidence_check`
- `qualification_check`
- `document_text_improvement`

## Режимы ответа

Поддерживаются следующие `answer_mode`:

- `short`
- `normal` — по умолчанию
- `detailed`
- `document_ready`

## Нормализация входного текста (`input normalization`)

Перед построением `LegalQueryPlan` система всегда выполняет нормализацию входного текста.

Нормализация:

- исправляет орфографию
- исправляет пунктуацию
- приводит разговорный текст к нейтральной форме
- не меняет смысл
- не добавляет факты
- не делает юридических выводов

Используемая модель:

- `OpenAI API 5.4 nano`

Сохраняется:

- `raw_input`
- `normalized_input`
- `normalization_model`
- `normalization_prompt_version`
- `normalization_changed`

Все последующие шаги работают только с `normalized_input`:

- `LegalQueryPlan`
- retrieval
- generation

## Pipeline шага 16

Единый pipeline шага `16`:

- `raw_input`
- `input normalization (OpenAI 5.4 nano)`
- `normalized_input`
- `intent detection`
- `actor_context detection`
- `LegalQueryPlan`
- `candidate retrieval`
- `LawFamily classification`
- `NormRole classification`
- `applicability scoring`
- `structured selection`
- `law context assembly`
- `fact_ledger`, если применимо
- `generation`
- `self-assessment`
- `logging`
- при необходимости скрытая отправка в `AI Quality Review`

## Roadmap после ручной оценки compact generation

После ручной оценки `compact_generation` по scenario suites дальнейшее развитие `AI Legal Core` должно идти не через точечные фиксы под отдельные вопросы, а через последовательность маленьких slices по системным классам ошибок.

Новый порядок развития шага `16`:

0. `Corpus Metadata and Citation Readiness Audit`
1. `LegalIssueType diagnostics contract`
2. `Legal Citation Parser / Citation Resolver`
3. `Source specificity ranking`
4. `PrimaryBasisEligibility v2`
5. `NormBundle runtime`
6. `Generation prompt policy`
7. `ExpectationProfile update`

Обязательные правила для этого roadmap:

- запрещены question-level hardcodes под отдельные suite cases
- `attorney_request`, `bodycam_and_recording`, `attorney_rights` и другие suite-группы используются как источники классов ошибок, а не как список вопросов для точечной подгонки
- сначала нужно повысить готовность corpus metadata и citation resolution
- только после этого можно безопасно усиливать bundle-aware grounding

## Slice 0 — Corpus Metadata and Citation Readiness Audit

Статус: `future / prerequisite`

До внедрения `Legal Citation Parser / Citation Resolver` нужно провести отдельный аудит готовности corpus к citation-aware retrieval.

Минимально нужно проверить:

- полноту `law_family` metadata
- наличие и стабильность `article_number`
- наличие и стабильность `part_number`, если она уже хранится
- наличие примечаний, комментариев и исключений в пригодной для retrieval форме
- наличие явных cross-reference маркеров
- отсутствие смешивания статей разных законов только по одинаковому номеру

Этот slice не должен менять retrieval-логику сам по себе.

Его задача:

- зафиксировать readiness gaps
- определить, какие citation-сценарии уже можно поддержать safely
- определить, какие gaps относятся к indexing/corpus, а не к prompt или selection

## Slice 1 — LegalIssueType diagnostics contract

Статус: `future`

`LegalIssueType` должен вводиться сначала как `diagnostics contract`, а не как агрессивный механизм, который сразу переписывает retrieval behavior.

На первом этапе этот слой нужен, чтобы legal core умел отдельно фиксировать, про что именно вопрос:

- `duty_question`
- `right_question`
- `deadline_question`
- `refusal_question`
- `evidence_question`
- `sanction_question`
- `procedure_question`
- `qualification_question`
- `remedy_question`
- `citation_explanation`
- `citation_application`
- `document_strategy`

На этой стадии `LegalIssueType`:

- добавляется в diagnostics и internal payload
- помогает анализировать системные ошибки
- не должен ещё резко переопределять retrieval ranking

## Slice 2 — Legal Citation Parser / Citation Resolver

Статус: `future`

`Legal Citation Parser / Citation Resolver` должен идти после `LegalIssueType diagnostics contract` и до `source specificity ranking` / `PrimaryBasisEligibility v2`.

Этот слой должен стоять между normalization и semantic retrieval.

Целевая future-цепочка:

- `raw_input`
- `input normalization`
- `Legal Citation Parser`
- `LegalQueryPlan`
- `targeted citation retrieval`
- `semantic retrieval`
- `structured selection`
- `NormBundle`
- `generation`

Parser должен понимать как минимум:

- `АК`
- `ПК`
- `УК`
- `ДК`
- `ТК`
- `ЭК`
- `Закон об адвокатуре`
- `ЗоА`
- `ОГП`

Обязательные future-правила:

- explicit citation имеет приоритет над semantic retrieval
- `22 ч.1 АК` нельзя искать как все статьи `22` во всех законах
- `23.1 ПК` нельзя искать в `АК`, `УК` или `ДК`
- если точная citation не найдена, система должна это диагностировать явно, а не молча подменять норму похожей статьёй другого закона

## `LegalQueryPlan`

`LegalQueryPlan` — это обязательный внутренний артефакт перед retrieval.

Он должен содержать:

- `normalized_input`
- `intent`
- `actor_context`
- `answer_mode`
- `server_id`
- `law_version`
- `question_scope`
- `legal_anchors`
- `required_law_families`
- `preferred_norm_roles`
- `forbidden_scope_markers`
- `expanded_query`

Смысл:

- система сначала определяет, какие типы норм нужны для ответа
- только после этого начинает retrieval

После внедрения `LegalIssueType diagnostics contract` и `Legal Citation Parser / Citation Resolver` в `LegalQueryPlan` также должны появиться отдельные diagnostics и constraints для:

- `legal_issue_type`
- явных citation-ссылок
- citation-specific retrieval constraints
- различения explicit citation retrieval и semantic retrieval

## `LawFamily`

Каждая candidate-норма должна быть отнесена к `LawFamily`.

Минимально:

- `administrative_code`
- `procedural_code`
- `criminal_code`
- `advocacy_law`
- `ethics_code`
- `constitution`
- `department_specific`
- `government_code`
- `immunity_law`
- `public_assembly_law`
- `other`

## `NormRole`

Каждая выбранная норма должна получать `NormRole`.

Минимально:

- `primary_basis`
- `procedure`
- `exception`
- `sanction`
- `right_or_guarantee`
- `remedy`
- `background_only`

## Оценка применимости (`applicability scoring`)

Для каждой candidate-нормы нужен `applicability scoring`.

Он должен учитывать:

- lexical relevance
- соответствие `LegalQueryPlan`
- соответствие нужному `LawFamily`
- соответствие нужному `NormRole`
- соответствие `intent`
- соответствие `actor_context`
- penalty за off-topic scope
- penalty за institutional mismatch
- penalty за `department_specific` в `general_question`
- penalty за exception-only норму без прямой базы
- penalty за law-family mismatch

Смысл:

- норма не должна попадать в ответ только потому, что в ней встретилось похожее слово
- система должна оценивать применимость нормы к сути вопроса

## Структурированный отбор (`structured selection`)

Retrieval не должен работать как простой `top-N` по похожести.

После scoring нужен `structured selection`.

Он должен собирать `law context` по слотам:

- `primary_basis_norms`
- `procedure_norms`
- `exception_norms`
- `supporting_norms`

Правила:

- `procedure` не может подменять `primary_basis`
- `exception` не может быть единственной основой общего ответа
- `background_only` не может становиться прямой правовой базой
- `department_specific` не должен становиться `primary_basis` для общего вопроса без явного основания

## direct_basis_status

В шаге `16` обязателен `direct_basis_status`.

Минимальные значения:

- `direct_basis_present`
- `partial_basis_only`
- `no_direct_basis`

Смысл:

- система должна отдельно фиксировать, есть ли прямая правовая основа для ответа по существу
- это влияет на generation, `self-assessment`, logging и hidden routing в шаг `17`

## Law context и структура законодательства

`law context` должен собираться не как первые найденные нормы, а как структурированный набор:

- `1–2` `primary_basis`
- `0–2` `procedure`
- `0–1` `exception`
- `0–2` `supporting`

Минимальная рабочая структура нормы:

- `server_id`
- `law_name`
- `article_number`
- `part_number`
- `article_text`
- `short_summary`
- `tags`
- `law_version`

Если прямой нормы нет:

- AI всё равно отвечает
- ответ формулируется условно
- `direct_basis_status != direct_basis_present`
- внутренне повышается риск
- случай может быть скрыто передан в шаг `17`

## Source Ledger

Для юридического помощника должен сохраняться `source_ledger`:

- какие нормы найдены
- какие нормы переданы в контекст
- какие нормы использованы в ответе
- `law_version`
- `server_id`

## Fact Ledger

Для AI-доработки описательной части должен фиксироваться `fact_ledger`:

- участники
- событие
- дата/время
- организация
- доказательства
- отсутствующие данные

Главное правило:

- AI не имеет права менять факты из `fact_ledger`

## Self-assessment

После generation система должна внутренне сохранять:

- `answer_confidence`
- `insufficient_data`
- `answer_risk_level`

Если данных или нормы мало:

- ответ всё равно отдаётся пользователю в аккуратной условной форме
- случай помечается для `AI Quality Review`

## Стиль ответа

AI не должен показывать сомнения напрямую.

Запрещено:

- `недостаточно данных`
- `невозможно определить`
- `я не нашёл норму`
- `нельзя сделать вывод`

Обязательно:

- использовать условные формулировки:
  - `оценка зависит от...`
  - `при наличии оснований...`
  - `может считаться...`
  - `может свидетельствовать...`

Если `direct_basis_status != direct_basis_present`:

- ответ не должен быть категоричным
- вывод должен зависеть от условий
- внутренне помечается повышенный риск

## Сценарии тестового раннера (`test runner`)

В рамках `AI Legal Core` должен быть предусмотрен запуск тестовых пользовательских сценариев из UI `super_admin`.

`super_admin` должен иметь возможность:

- выбрать сервер
- выбрать `law_version`
- выбрать `actor_context`
- выбрать `answer_mode`
- выбрать один тестовый сценарий или группу сценариев
- запустить прогон
- увидеть итоговую AI-выдачу
- увидеть `used_sources`, `confidence`, `insufficient_data`, `tokens`, `cost`, `latency`

Если результат:

- помечен как рискованный по `self-assessment`
- или нарушает базовые правила legal core

он должен автоматически попадать в шаг [17-ai-quality-review.md](./17-ai-quality-review.md).

## Scenario groups / test suites

Дальнейшее развитие test runner не должно опираться на один и тот же небольшой набор ручных вопросов.

Основная единица проверки для шага `16` — это `scenario group` / `test suite`, а не одиночный вопрос.

Целевые группы сценариев:

- `mask_and_identity`
- `bodycam_and_recording`
- `attorney_rights`
- `attorney_request`
- `detention_procedure`
- `evidence_strength`
- `qualification_check`
- `bad_input_and_slang`
- `hallucination_pressure`
- `multi_server_variance`

Для каждой такой группы в scenario registry должны постепенно появляться несколько вариантов одного semantic cluster:

- короткий общий вопрос
- вопрос с ошибками и сленгом
- вопрос от себя
- вопрос в интересах доверителя
- вопрос с неполными фактами
- вопрос с провокацией на выдумку
- вопрос для другого сервера
- альтернативная формулировка

Важно:

- этот раздел фиксирует направление развития scenario registry
- он не утверждает, что все такие варианты уже полностью реализованы в коде

## Expectation-based validation

Тестовые сценарии должны проверяться не по совпадению итогового текста ответа, а по ожидаемым правовым свойствам результата.

Минимальная структура `expectation profile` для сценария:

- `required_law_families`
- `required_norm_roles`
- `forbidden_law_families`
- `forbidden_norm_roles`
- `min_primary_basis_norms`
- `required_companion_relations`
- `forbidden_primary_basis`
- `expected_direct_basis_status`
- `max_tokens`
- `max_latency`
- `notes_for_review`

Обязательные правила:

- проверка текста ответа вторична и используется как review-oriented слой
- primary acceptance идёт через selected legal context
- primary acceptance идёт через `direct_basis_status`
- primary acceptance идёт через grounded constraints по выбранным нормам

## 16.3 AI Legal Core — NormBundle and Companion Context

Статус: `post-MVP / active / partial / deployed`

Цель:

`AI Legal Core` должен учитывать, что одна статья не всегда является самодостаточной правовой базой. В ряде случаев корректный legal grounding складывается из `primary norm` и `companion norms`.

`NormBundle` не должен реализовываться раньше, чем legal core пройдёт через:

- `Corpus Metadata and Citation Readiness Audit`
- `LegalIssueType diagnostics contract`
- `Legal Citation Parser / Citation Resolver`
- базовое specificity / eligibility hardening

`NormBundle` — это runtime-артефакт после `structured selection`.

Текущий реализованный объём `16.3` после deploy `8b7333a`:

- `5a` — `NormBundle diagnostics-only` после `structured selection` и до generation
- `5b` — safe same-article part extraction для длинных article-like норм
- `5b.1` — issue-aware narrowing для same-article segments без blind inclusion procedural-looking частей
- `5c` — bundle projection в generation context без увеличения общего prompt budget
- `5c.1` — marker-aware dedupe companions и приоритетное удержание `ч. 2` и `ч. 5` для `attorney_request / no-response-refusal`
- `5d` — companion-aware expectation layer для scenario suites и internal evaluator без изменения runtime AI Legal Core

Текущий ещё не закрытый объём:

- постепенное расширение companion-aware expectation checks за пределы `attorney_request`

`NormBundle` должен включать:

- `primary_basis_norms`
- `same_article_parts`
- `article_notes`
- `article_comments`
- `exceptions`
- `definitions`
- `cross_references`
- `procedure_companions`
- `sanction_companions`
- `remedy_companions`
- `evidence_companions`
- `server_specific_overrides`

## `NormRelation`

Для `NormBundle` должны поддерживаться как минимум следующие связи:

- `same_article_part`
- `article_note`
- `article_comment`
- `exception`
- `definition`
- `cross_reference`
- `procedure_companion`
- `sanction_companion`
- `remedy_companion`
- `evidence_companion`
- `server_specific_override`

## Runtime-first подход для `16.3`

Первая итерация `16.3` должна строиться как runtime-first слой и не требовать Prisma-изменений.

Базовый pipeline:

- после `structured selection` взять `primary_basis`
- найти соседние части той же статьи
- найти примечания, комментарии и исключения
- найти явные отсылки к другим статьям и законам
- добавить найденные нормы как `companions`, а не как `primary_basis`
- передавать в compact generation prompt только минимально нужный набор
- сохранять diagnostics:
  - `norm_bundle`
  - `norm_relations`
  - `companion_sources`
  - `missing_companion_warning`
  - `cross_reference_unresolved`

## Текущий deployed checkpoint по `16.3`

На production задеплоен commit `8b7333a`.

Active release:

- `8b7333a`

Prod model:

- `gpt-5.4-mini`

Подтверждённый live smoke:

- `attorney_request / deadline_question`
  - ответ устойчиво даёт срок `1 календарный день`
  - формулировка `3 рабочих дня` больше не появляется
  - `primary basis` остаётся `Закон об адвокатуре`, `ст. 5`
  - primary/companion excerpt опирается на смысл `ч. 2`
- `attorney_request / no-response-refusal`
  - `primary_excerpt` идёт по `ч. 4`
  - в prompt остаются `ч. 2` как `procedure_companion` и `ч. 5` как `sanction_companion`
  - duplicate companion по `ч. 4` исключается через diagnostics `duplicate_of_primary_excerpt`
  - `ч. 3`, `ч. 6`, `ч. 8` не попадают в prompt без explicit context
- explicit citations
  - `22 ч.1 АК`, `23.1 ПК`, `5 ч.4 Закона об адвокатуре` корректно резолвятся
  - `999 УК` остаётся `unresolved / no_article` и не создаёт fake primary

Что именно зафиксировано в `5c.1`:

- marker-aware dedupe companions в bundle projection
- diagnostics `duplicate_of_primary_excerpt`
- приоритет `ч. 2` и `ч. 5` для `attorney_request / no-response-refusal`
- отсутствие увеличения общего generation budget
- отсутствие изменений в:
  - retrieval
  - selection / `PrimaryBasisEligibility`
  - `source-excerpt`
  - generation prompt policy

## Текущий implemented checkpoint по `5d`

`5d` зафиксирован коммитом `fbf5cd8`.

Это acceptance / evaluator layer, а не новый runtime layer.

`5d` добавил:

- `activateCompanionChecks`
- `requiredCompanionTargets`
- `failIfSanctionWithoutBaseRule`
- `failIfExceptionWithoutBaseRule`
- реальное использование `requiredCompanionRelations` для `attorney_request`
- реальное использование `forbiddenCompanionAsPrimary` для `attorney_request`

Что именно делает `5d`:

- проверяет required companion relations
- проверяет required companion targets по `law_family / article_number / part_number / marker`
- разрешает считать duplicate companion покрытым, если он уже исключён как `duplicate_of_primary_excerpt`
- валит scenario при `sanction without base rule`
- валит scenario при `exception without base rule`
- валит scenario при отсутствии обязательного companion

Первичная активация companion-aware checks выполнена только для:

- `alt-attorney-request-deadline`
- `general-no-response-to-attorney-request`
- `hallucination-attorney-request-crime`

Источник данных для evaluator:

- `selected_norm_roles`
- `primary_basis_eligibility`
- `direct_basis_status`
- `NormBundle / projection diagnostics`

Принцип проверки:

- evaluator проверяет structured diagnostics и selected legal context
- evaluator не опирается на matching текста ответа

Важно:

- `5d` не меняет retrieval
- `5d` не меняет selection / `PrimaryBasisEligibility`
- `5d` не меняет `source-excerpt`
- `5d` не меняет generation prompt
- `5d` не меняет budget
- `5d` не меняет public assistant actions

## VPS smoke policy

Ручной smoke на production-like VPS должен запускаться только через:

```bash
node --env-file=/srv/newlaw/app/shared/.env.production ...
```

Обязательное правило:

- не использовать `bash source .env.production`

## Как использовать test runner

Базовый порядок ручного прогона:

1. выбрать scenario group
2. прогнать несколько вариаций внутри одного semantic cluster
3. проверить:
   - нормализацию
   - retrieval
   - expectation-based соответствие
   - стиль ответа
   - отсутствие галлюцинаций
   - уверенность без прямой демонстрации сомнений пользователю
4. плохие результаты передавать в шаг `17`

## Логирование

Для каждого прохода должны логироваться:

- `input`
- `output`
- `raw_input`
- `normalized_input`
- `server_id`
- `law_version`
- `used_sources`
- `prompt_version`
- `model`
- `normalization_model`
- `normalization_prompt_version`
- `normalization_changed`
- `tokens`
- `cost`
- `latency`
- `confidence`

## Что не входит в шаг 16

Не входит:

- review queue
- reviewer workflow
- `fix_instruction`
- `AI Behavior Rules`
- regression gate
- closure workflow
- UI шага `17`
- API шага `17`
- Prisma-изменения ради review-контура

## Критерии приёмки

Шаг `16` описан корректно, если:

- один и тот же legal core применяется к юридическому помощнику и AI-доработке описательной части
- каждый AI-ответ жёстко привязан к `server_id + law_version`
- все основные AI-flow используют `normalized_input` как рабочий текст
- retrieval не работает как простой `top-N`
- используются `LegalQueryPlan`, `LawFamily`, `NormRole`, `applicability scoring`, `structured selection`
- отдельно фиксируется `direct_basis_status`
- test runner поддерживает scenario groups, а не только одиночные вопросы
- сценарии проверяются expectation-based полями, а не совпадением текста ответа
- `16.3` отделён как часть `AI Legal Core`, а не `AI Quality Review`
- legal core различает `primary_basis` и companion context
- compact generation не отменяет companion-aware grounding
- для юридического помощника сохраняется `source_ledger`
- для AI-доработки описательной части сохраняется `fact_ledger`
- внутренний `self-assessment` сохраняется даже тогда, когда пользователю отдаётся аккуратный условный ответ
- risky test-run результат может быть автоматически передан в шаг `17`
- шаг `16` не разрастается в review-систему и не подменяет шаг `17`
