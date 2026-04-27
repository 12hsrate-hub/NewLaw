# Шаг 17. AI Quality Review

## Статус

Post-MVP. Не входит в MVP.

## Зависимость от шага 16

Шаг `17` должен идти после [16-ai-legal-core.md](./16-ai-legal-core.md) и зависеть от него.

Это означает:

- `17` не подменяет `AI Legal Core`
- `17` не проектирует retrieval-ядро заново
- `17` оценивает результаты шага `16`, а не заменяет его
- `17` не строит `Legal Citation Parser / Citation Resolver`
- `16` собирает и применяет `NormBundle`, если этот слой добавлен в legal core
- `17` не строит `NormBundle` заново
- `17` проверяет citation errors только после того, как их сформировал шаг `16`
- `17` проверяет ошибки bundle/grounding, а не подменяет bundle assembly

## Назначение

Этот шаг фиксирует только `AI Quality Review`.

Его задача:

- проверять качество AI-выдачи после прохождения через `AI Legal Core`
- выявлять ошибки выбора нормы, применения нормы, нормализации и финальной генерации
- собирать спорные кейсы в управляемый внутренний контур проверки

## Что проверяется

`AI Quality Review` применяется к:

- юридическому помощнику
- AI-доработке описательной части

## Что пользователь не видит

Пользователь не видит:

- `quality_score`
- `risk_level`
- `flags`
- `review_items`
- внутренние замечания

## Мультисерверная проверка

`AI Quality Review` должен оценивать AI-выдачу только в контексте конкретных:

- `server_id`
- `law_version`

Нельзя сравнивать ответы между серверами без учёта различий в законодательстве.

## Что шаг 17 получает из шага 16

Шаг `17` использует как вход:

- `raw_input`
- `normalized_input`
- `LegalQueryPlan`
- selected candidates
- `LawFamily`
- `NormRole`
- applicability scoring result
- structured selection result
- `direct_basis_status`
- `source_ledger`
- `fact_ledger`, если применимо
- `self_assessment`
- final output

После появления `NormBundle` в шаге `16` review-контур также должен получать:

- `norm_bundle`
- `norm_relations`
- `companion_sources`
- `missing_companion_warning`
- `cross_reference_unresolved`

После появления `Legal Citation Parser / Citation Resolver` в шаге `16` review-контур также должен получать:

- explicit citation diagnostics
- `citation_resolved`
- `citation_ambiguous`
- `citation_unresolved`
- markers о том, был ли semantic retrieval разрешён только как companion-context

## Цепочка проверки

`AI Quality Review` должен проверять полную цепочку:

- `raw_input`
- `normalized_input`
- `selected norms`
- `norm bundle`
- `final output`

Эта цепочка нужна, чтобы отделять:

- ошибки нормализации
- ошибки retrieval
- ошибки выбора нормы
- ошибки генерации
- ошибки правовой базы

## Состав проверки

Проверка должна состоять из трёх слоёв:

- `deterministic checks`
- `AI reviewer`
- self-risk сигналов из шага `16`

## Текущий implemented checkpoint по `17.1a`

`17.1a` реализован как первый deterministic review kernel.

Это именно internal review layer:

- без AI reviewer как обязательного ядра
- без review UI
- без Prisma/schema changes
- без queue workflow как обязательного runtime-path
- без public assistant actions
- без изменения production answer generation
- без изменения runtime `Step 16`

Что уже делает `17.1a`:

- строит structured deterministic review result по legal grounding snapshot
- возвращает `overall_status: pass | warn | fail`
- возвращает structured flags с:
  - `code`
  - `severity`
  - `short_reason`
  - compact `evidence`
- возвращает summary по `pass / warn / fail`

Источник данных для `17.1a`:

- `raw_input`
- `normalized_input`
- `selected_norm_roles`
- `direct_basis_status`
- `primary_basis_eligibility`
- selected `LawFamily`
- `NormBundle / projection diagnostics`
- explicit citation diagnostics, если они уже есть в snapshot
- scenario expectation context, если review запускается в internal test-run

Реализованные deterministic flags первого slice:

- `missing_primary_basis_norm`
- `law_family_mismatch`
- `weak_direct_basis`
- `sanction_or_exception_used_as_primary`
- `missing_required_companion_context`
- `unresolved_explicit_citation_used_as_basis`

Важно:

- `missing_required_companion_context` делает `fail` только в activated scenario/test-run context
- duplicate companion, покрытый через `duplicate_of_primary_excerpt`, не считается missing companion
- deterministic kernel пока не делает broad semantic review итогового ответа

Что остаётся future после `17.1a`:

- broad `answer_claim_exceeds_selected_norms`
- `explicit_citation_ignored`
- `explicit_citation_misresolved`
- `semantic_search_overrode_explicit_citation`
- `answer_ignores_exception`
- `answer_ignores_article_note`
- `cross_reference_unresolved`
- `normalization_changed_meaning` как отдельный расширенный review lane beyond current bootstrap semantics

## Текущий implemented checkpoint по `17.1b`

`17.1b` реализован как internal runner / reporting integration для deterministic review kernel из `17.1a`.

Это по-прежнему internal-only slice:

- без public assistant behavior changes
- без UI
- без Prisma/schema
- без queue workflow
- без AI reviewer changes
- без regression gate
- без изменения runtime `Step 16`

Что именно добавляет `17.1b`:

- structured `law_basis_review` теперь прокидывается в internal AI Legal Core test runner result
- для каждого scenario result доступны compact поля:
  - `overall_status`
  - `fail_count`
  - `warn_count`
  - `pass_count`
  - `flag_codes`
  - `failed_flag_codes`
  - `warn_flag_codes`
- для всего test run доступен aggregate summary:
  - `counts_by_law_basis_review_status`
  - `scenarios_with_failed_law_basis_review`
  - `top_law_basis_review_flags`

Важно:

- `law_basis_review` остаётся отдельным review-layer result
- `expectation_summary` остаётся acceptance-layer result
- `direct_basis_summary` остаётся отдельным legal-core summary
- `review fail / warn` пока не блокирует suite outcome автоматически

Что остаётся future после `17.1b`:

- regression gate по review fail flags
- queue/workflow policy
- public/internal UI exposure beyond existing preview layer
- richer analytics по issue clusters и trends

## Текущий implemented checkpoint по `17.1c`

`17.1c` зафиксирован как calibration baseline для deterministic `law_basis_review`.

Это calibration / visibility slice:

- без regression gate
- без suite blocking
- без public behavior changes
- без runtime changes в `Step 16`
- без AI reviewer expansion
- без UI / Prisma / queue workflow

Практическая цель `17.1c`:

- зафиксировать, какие deterministic flags уже достаточно полезны для internal visibility
- отделить потенциальные `candidate_for_gate` сигналы от `warn_only` и `diagnostics_only`
- не смешивать review-layer с acceptance-layer

### Baseline policy по текущим flags

`missing_primary_basis_norm`

- статус: `candidate_for_gate`
- почему:
  - это прямой и устойчивый сигнал про отсутствие usable primary basis
  - хорошо согласуется с `direct_basis_status` и `primary_basis_eligibility`
- риск false positives: низкий
- важные scenario groups:
  - `attorney_request`
  - `attorney_rights`
  - `multi_server_variance`

`law_family_mismatch`

- статус: `candidate_for_gate`
- почему:
  - хорошо ложится на scenario expectation context и explicit citation family constraints
  - часто указывает на реальную grounding ошибку
- риск false positives: средний
  - выше вне test-run/expectation context
- важные scenario groups:
  - `attorney_request`
  - `bodycam_and_recording`
  - `multi_server_variance`

`weak_direct_basis`

- статус: `warn_only`
- почему:
  - сам по себе weak basis не всегда является ошибкой
  - полезен как calibration signal, но ещё слишком широкий для gate
- риск false positives: средний
- важные scenario groups:
  - `bodycam_and_recording`
  - `evidence_strength`
  - `hallucination_pressure`

`sanction_or_exception_used_as_primary`

- статус: `candidate_for_gate`
- почему:
  - это уже почти бинарная структурная ошибка
  - хорошо согласуется с существующей логикой `16.3` и expectation checks
- риск false positives: низкий
- важные scenario groups:
  - `attorney_request`
  - `multi_server_variance`
  - future citation-heavy scenarios

`missing_required_companion_context`

- статус: `warn_only`
- почему:
  - полезен только в activated scenario/test-run context
  - уже чувствителен к companion coverage nuances вроде `duplicate_of_primary_excerpt`
- риск false positives: средний
- важные scenario groups:
  - `attorney_request`
  - `attorney_rights`
  - `bodycam_and_recording` access scenarios

`unresolved_explicit_citation_used_as_basis`

- статус: `diagnostics_only`
- почему:
  - explicit citation diagnostics уже полезны, но corpus/citation surface ещё требует дальнейшей калибровки
  - этот сигнал пока лучше использовать для visibility и manual review, а не для gate
- риск false positives: средний или высокий
- важные scenario groups:
  - explicit citation probes
  - `multi_server_variance`
  - `hallucination_pressure`

### Что это значит practically

На этапе `17.1c`:

- `review fail / warn` не блокирует suite
- `law_basis_review` остаётся visibility/calibration layer
- acceptance всё ещё определяется отдельно через `expectation_summary`
- возможный regression gate по review flags допускается только в отдельном future slice после дополнительной калибровки

## `law_basis_issue`

В шаге `17` должен быть отдельный класс проблем `law_basis_issue`.

Он нужен для случаев, когда:

- выбраны нормы не того `LawFamily`
- отсутствует `primary_basis`
- procedural или exception-норма подменяет прямую базу
- итоговый ответ сильнее, чем позволяют выбранные нормы
- итоговый вывод конфликтует с `direct_basis_status`

## Флаги проверки (`review flags`)

Минимально должны поддерживаться review flags:

- `missing_primary_basis_norm`
- `law_family_mismatch`
- `selected_norm_scope_mismatch`
- `department_specific_norm_used_for_general_question`
- `answer_claim_exceeds_selected_norms`
- `weak_direct_basis`
- `off_topic_context_norm`

После появления `NormBundle` в шаге `16` должен быть предусмотрен future review expansion с дополнительными флагами:

- `explicit_citation_ignored`
- `explicit_citation_misresolved`
- `semantic_search_overrode_explicit_citation`
- `citation_unresolved`
- `missing_required_companion`
- `wrong_companion_relation`
- `primary_norm_without_exception`
- `cross_reference_unresolved`
- `answer_ignores_article_note`
- `answer_ignores_exception`
- `answer_uses_companion_as_primary_basis`

Важно:

- эти флаги относятся к будущему расширению review-контура
- они не должны описываться как уже включённая runtime review-логика
- они не должны подменять `AI Legal Core` и не должны превращать шаг `17` в citation resolver или bundle assembler

Дополнительно должны поддерживаться общие поля review-контура:

- `risk_level`
- `confidence`
- `flags`
- `root_cause`
- `input_quality`
- `issue_fingerprint`
- `issue_cluster_key`

## Проверка нормализации входного текста

`AI Quality Review` должен учитывать слой `input normalization` из шага `16`.

Для каждой спорной AI-выдачи нужно сохранять и показывать `super_admin`:

- `raw_input`
- `normalized_input`
- `normalization_model`
- `normalization_prompt_version`
- `normalization_changed`
- результат сравнения `raw_input` и `normalized_input`

## Флаги нормализации (`normalization flags`)

Ошибки нормализации должны помечаться отдельными флагами:

- `normalization_changed_meaning`
- `normalization_added_fact`
- `normalization_removed_fact`
- `normalization_overlegalized`
- `normalization_too_aggressive`
- `normalization_failed`

Если проблема возникла из-за нормализации, `root_cause` должен быть:

- `normalization_issue`

## `fix_instruction`

Для подтверждённой проблемы `super_admin` должен фиксировать `fix_instruction`.

В `fix_instruction` обязательно должны быть:

- что AI сделал неправильно
- как AI должен вести себя в будущем
- когда правило применяется
- что запрещено
- плохой пример
- хороший пример
- критерии приёмки
- инструкция для Codex
- ожидание для regression test

Если подтверждённая проблема связана с нормализацией, дополнительно нужно фиксировать:

- что именно нормализация изменила неправильно
- какой смысл был в `raw_input`
- какой смысл появился в `normalized_input`
- как должна вести себя нормализация в будущем
- пример плохой нормализации
- пример правильной нормализации
- критерий приёмки для regression test

## `AI Behavior Rules`

Нужен единый реестр `AI Behavior Rules`.

Он должен:

- собирать утверждённые `fix_instruction`
- быть каноническим списком правил поведения AI
- отделять подтверждённые правила от разовых замечаний

## `regression gate`

Нужен обязательный `regression gate`.

Подтверждённую проблему нельзя считать исправленной без:

- теста
- или явного обоснования, почему тест не требуется

## Связь с тестовым раннером (`test runner`)

`AI Quality Review` должен принимать не только реальные пользовательские AI-выдачи, но и результаты тестовых прогонов из шага `16`.

Для таких случаев нужно сохранять:

- `test_scenario_id`
- `test_run_id`
- `server_id`
- `law_version`
- `actor_context`
- `answer_mode`
- `raw_input`
- `normalized_input`
- `retrieved_sources`
- `final_output`
- `self_assessment`
- `review_status`

В будущем review-контур должен учитывать не только сам test run результат, но и `expectation profile` сценария:

- `required_law_families`
- `forbidden_law_families`
- `required_norm_roles`
- `forbidden_norm_roles`
- `expected_direct_basis_status`
- `required_companion_relations`
- `token_budget`
- `latency_budget`
- `review_notes`

Плохая или спорная выдача из test runner должна попадать в очередь `super_admin` так же, как и проблемная реальная выдача.

После доработки логики `super_admin` должен иметь возможность повторно запустить тот же тестовый сценарий и сравнить результат:

- до изменений
- после изменений

## Плановые сущности

Для этой линии должны быть предусмотрены сущности:

- `ai_test_scenarios`
- `ai_test_runs`
- `ai_test_run_results`

Минимальный состав `ai_test_scenarios`:

- `id`
- `title`
- `input_text`
- `expected_behavior`
- `scenario_group`
- `intent`
- `actor_context`
- `answer_mode`
- `is_active`

Минимальный состав `ai_test_runs`:

- `id`
- `started_by`
- `server_id`
- `law_version`
- `started_at`
- `completed_at`
- `status`

Минимальный состав `ai_test_run_results`:

- `id`
- `test_run_id`
- `test_scenario_id`
- `ai_generation_id`
- `status`
- `risk_level`
- `passed_basic_checks`
- `sent_to_review`

Ключевой принцип:

- тестовые вопросы — это не просто примеры
- это механизм ручной проверки `AI Legal Core`
- это источник задач для `AI Quality Review`

## Доступ

Доступ к слою проверки должен разделяться так:

- `super_admin` видит полный raw
- админ сервера видит обезличенную статистику
- `tester` видит sanitized/test examples
- пользователь не видит этот раздел

## Kill switch и лимиты

Нужно предусмотреть:

- `AI_REVIEW_ENABLED`
- `AI_REVIEW_MODE=off/log_only/full`
- daily cost/request limits

## Принцип изменения production-логики

Нужно зафиксировать явно:

- `AI Quality Review` не меняет production-логику автоматически

Все правки идут только через:

- человека
- `PR` / `commit`
- проверку

## Что не входит в шаг 17

Не входит:

- проектирование retrieval engine
- проектирование `LegalQueryPlan`
- определение `LawFamily`
- определение `NormRole`
- structured selection как retrieval-механизм
- сборка `NormBundle` и определение `NormRelation`
- UI шага `16`
- API шага `16`
- Prisma-изменения ради legal core

Это всё относится к шагу `16`.

## Критерии приёмки

Шаг `17` описан корректно, если:

- он явно зависит от шага `16`
- проверка распространяется и на юридического помощника, и на AI-доработку описательной части
- review оценивает цепочку `raw_input -> normalized_input -> selected norms -> final output`
- review может расширяться до проверки `norm bundle`, но не подменяет его построение
- отдельно выделяется `law_basis_issue`
- предусмотрены review flags и normalization flags
- пользователь не видит внутренние поля review-контура
- спорные случаи сохраняются для `super_admin`
- предусмотрены `fix_instruction`, `AI Behavior Rules`, `regression gate`
- результаты test runner из шага `16` тоже могут попадать в review queue
- review учитывает `server_id` и `law_version` и не сравнивает ответы разных серверов без контекста
- production-логика меняется только через человека, `PR` / `commit` и проверку
