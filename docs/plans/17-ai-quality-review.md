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

## Текущий implemented checkpoint по `17.1d`

`17.1d` реализован как non-blocking gate simulation для deterministic `law_basis_review`.

Это по-прежнему internal-only reporting slice:

- без настоящего regression gate
- без suite blocking
- без public assistant behavior changes
- без UI / Prisma / queue workflow
- без AI reviewer expansion
- без runtime changes в `Step 16`

Что именно добавляет `17.1d`:

- рядом с per-scenario `law_basis_review` теперь доступен отдельный compact block `law_basis_gate_simulation`
- он показывает:
  - `would_fail_gate`
  - `candidate_fail_flag_codes`
  - `warn_only_flag_codes`
  - `diagnostics_only_flag_codes`
  - `status: pass | would_fail`
  - `short_reason`
- для всего test run теперь доступен aggregate dry-run summary:
  - `scenarios_that_would_fail_law_basis_gate`
  - `law_basis_gate_simulation_counts`
  - `top_candidate_gate_flag_codes`
  - `groups_with_candidate_gate_fails`

### Что это значит practically

На этапе `17.1d`:

- `law_basis_gate_simulation` не меняет `expectation_summary`
- `law_basis_gate_simulation` не меняет `scenario result status`
- `law_basis_gate_simulation` не меняет suite pass/fail
- acceptance-layer по-прежнему определяется отдельно через `expectation_summary`
- gate simulation нужен только для dry-run наблюдения за шумностью `candidate_for_gate` flags

### Что остаётся future после `17.1d`

- настоящий blocking regression gate
- policy, которая меняет suite outcome по review-layer сигналам
- richer cross-run calibration analytics
- public/internal UI exposure beyond current internal reporting

## Текущий implemented checkpoint по `17.1e`

`17.1e` зафиксирован как dry-run calibration report для non-blocking `law_basis_gate_simulation`.

Это docs-first calibration slice:

- без нового runtime wiring
- без suite blocking
- без public assistant behavior changes
- без UI / Prisma / queue workflow
- без AI reviewer expansion
- без изменения runtime `Step 16`

Источник baseline для `17.1e`:

- existing internal runner output из `17.1d`
- existing internal test fixtures и reporting tests
- aggregate dry-run summary без запуска дорогого production-like full AI прогона

### Текущая calibration policy по dry-run gate

`candidate_for_gate`

- `missing_primary_basis_norm`
- `law_family_mismatch`
- `sanction_or_exception_used_as_primary`

`warn_only`

- `weak_direct_basis`
- `missing_required_companion_context`

`diagnostics_only`

- `unresolved_explicit_citation_used_as_basis`

### Как интерпретировать aggregate dry-run output

`scenarios_that_would_fail_law_basis_gate`

- это список scenario ids, где dry-run gate уже сейчас увидел хотя бы один `candidate_for_gate` fail flag
- этот список не означает automatic suite failure
- это shortlist для ручной проверки шумности и повторяемости перед будущим blocking gate

`top_candidate_gate_flag_codes`

- это ranking наиболее частых `candidate_for_gate` signals в текущем dry-run baseline
- если один и тот же flag стабильно всплывает в нескольких scenario groups и совпадает с real acceptance issues, он ближе к future gate readiness
- если flag появляется редко и только в noisy groups, его нельзя автоматически трактовать как готовый blocking signal

`groups_with_candidate_gate_fails`

- это индикатор того, какие scenario groups дают основной dry-run risk surface
- если candidate fail концентрируется в одной шумной группе, это сигнал к отдельной analysis-first калибровке, а не к немедленному gate rollout
- если candidate fail воспроизводится в стабильных groups вроде `attorney_request` и `multi_server_variance`, это более сильный аргумент в пользу future gate

### Интерпретация candidate_for_gate flags

`missing_primary_basis_norm`

- likely true positive:
  - когда в scenario context ожидается прямая правовая база, но `primary_basis` отсутствует или остаётся unusable/ineligible
  - особенно важно для:
    - `attorney_request`
    - `attorney_rights`
    - `multi_server_variance`
- возможный false positive:
  - в сценариях, где `partial_basis_only` допустим как текущий рабочий результат и acceptance специально не требует strong direct basis
- что проверить до blocking gate:
  - совпадает ли сигнал с `direct_basis_status`
  - не относится ли scenario group к knowingly weak-basis zones

`law_family_mismatch`

- likely true positive:
  - когда primary basis ушёл в чужую `LawFamily` вопреки scenario expectations или explicit citation family constraints
  - особенно важно для:
    - `attorney_request`
    - `bodycam_and_recording`
    - `multi_server_variance`
- возможный false positive:
  - если off-family noise присутствует как companion/supporting context, но primary basis фактически корректный
  - если scenario group остаётся noisy и corpus signal нестабилен
- что проверить до blocking gate:
  - что mismatch относится именно к primary basis, а не к supporting noise
  - что signal повторяется не только в одном noisy fixture

`sanction_or_exception_used_as_primary`

- likely true positive:
  - когда sanction или exception фактически подменяет base rule
  - особенно важно для:
    - `attorney_request`
    - `multi_server_variance`
    - future citation-heavy probes
- возможный false positive:
  - если sanction/exception заметно присутствует в review snapshot, но companion/base split при этом всё же корректный
- что проверить до blocking gate:
  - что primary replacement происходит структурно, а не только stylistically
  - что `NormBundle` / selected roles подтверждают подмену, а не просто наличие companion context

### Что это значит practically

На этапе `17.1e`:

- `law_basis_gate_simulation` остаётся dry-run visibility layer
- `review fail / warn` по-прежнему не блокирует suite
- suite pass/fail всё ещё определяется через acceptance/evaluator layer
- blocking gate можно обсуждать только в отдельном будущем `Step 17.2` после ручной проверки baseline

## Текущий implemented checkpoint по `17.2`

`17.2` реализован как narrow internal-only opt-in gate readiness для `law_basis_review`.

Это не global regression gate:

- без public assistant behavior changes
- без изменения runtime `Step 16`
- без deploy
- без UI / Prisma / AI reviewer
- без автоматического изменения suite pass/fail

### Что именно делает `17.2`

`17.2` добавляет отдельный internal-only блок `law_basis_gate_status` рядом с:

- `expectation_summary`
- `direct_basis_summary`
- `law_basis_review`
- `law_basis_gate_simulation`

`law_basis_gate_status` показывает:

- `enabled`
- `blocked`
- `blocking_flag_codes`
- `scope`
  - `mode`
  - `allowed_groups`
  - `active_group`
- `short_reason`

Для всего test run добавлен отдельный aggregate summary:

- `gate_enabled`
- `scenarios_blocked_by_law_basis_gate`
- `counts_by_gate_status`
- `top_blocking_law_basis_gate_flag_codes`
- `groups_blocked_by_law_basis_gate`

### Scope `17.2`

Gate readiness применяется только если:

- mode явно включён
- active scenario group входит в allowlist:
  - `attorney_request`
  - `multi_server_variance`
- `law_basis_review` содержит fail flag:
  - `sanction_or_exception_used_as_primary`

### Что `17.2` намеренно НЕ блокирует

Даже в opt-in режиме `17.2` не блокирует:

- `missing_primary_basis_norm`
- `law_family_mismatch`
- `weak_direct_basis`
- `missing_required_companion_context`
- `unresolved_explicit_citation_used_as_basis`

Это означает:

- `missing_primary_basis_norm` остаётся dry-run / future gate candidate
- `law_family_mismatch` остаётся dry-run / future gate candidate
- broader blocking gate по нескольким flag classes остаётся future expansion после дальнейшей ручной проверки

### Что это значит practically

На этапе `17.2`:

- gate по-прежнему internal-only
- gate default-off
- blocking readiness включается только как opt-in mode
- `expectation_summary` остаётся acceptance-layer result
- `law_basis_gate_simulation` остаётся dry-run visibility layer
- `law_basis_gate_status` остаётся отдельным gate-readiness layer
- suite pass/fail по-прежнему не переопределяется автоматически review-layer сигналами

## Текущий implemented checkpoint по `17.2a`

`17.2a` зафиксирован как usage validation и runbook для narrow internal-only `law_basis_gate_status`.

Это docs-first operational slice:

- без расширения allowlist
- без новых blocking flags
- без public assistant behavior changes
- без изменения runtime `Step 16`
- без deploy

### Поддерживаемые mode values

`lawBasisGateMode` в internal runner сейчас поддерживает только:

- `off`
- `sanction_primary_allowlist`

Если mode не передан:

- используется значение по умолчанию `off`

### Как включается opt-in gate mode

Внутри internal runner mode передаётся через `FormData` field:

- `lawBasisGateMode=off`
- `lawBasisGateMode=sanction_primary_allowlist`

Это internal-only параметр:

- он не влияет на public assistant surface
- он не меняет production answer generation
- он не включает gate глобально

### Что делает mode `off`

При `lawBasisGateMode=off`:

- `law_basis_gate_status.enabled = false`
- `law_basis_gate_status.blocked = false`
- `blocking_flag_codes = []`
- aggregate `gate_enabled = false`

Это baseline-safe режим по умолчанию.

### Что делает mode `sanction_primary_allowlist`

При `lawBasisGateMode=sanction_primary_allowlist`:

- gate активируется только для allowlist groups:
  - `attorney_request`
  - `multi_server_variance`
- gate блокирует только:
  - `sanction_or_exception_used_as_primary`

Даже в этом mode gate не блокирует:

- `missing_primary_basis_norm`
- `law_family_mismatch`
- `weak_direct_basis`
- `missing_required_companion_context`
- `unresolved_explicit_citation_used_as_basis`

### Как читать per-scenario `law_basis_gate_status`

`enabled`

- `true`: scenario group попал в allowlist и mode реально активировал gate logic
- `false`: gate mode off или scenario group вне allowlist

`blocked`

- `true`: найден blocking flag из narrow gate scope
- `false`: blocking flag не найден или gate не активен для этого scenario

`blocking_flag_codes`

- список только реально blocking flag codes
- в `17.2/17.2a` это практически должен быть только:
  - `sanction_or_exception_used_as_primary`

`scope.mode`

- показывает, какой internal mode был запрошен

`scope.allowed_groups`

- показывает текущий жёсткий allowlist

`scope.active_group`

- показывает effective scenario suite group для данного scenario result

### Как читать aggregate `law_basis_gate_status_summary`

`gate_enabled`

- показывает, был ли в этом test run запрошен opt-in gate mode

`scenarios_blocked_by_law_basis_gate`

- список scenario ids, которые попали под narrow blocking condition
- это reporting signal
- он не должен трактоваться как automatic suite failure

`counts_by_gate_status`

- `disabled`: scenario result вне active gate scope
- `pass`: gate был активен, но blocking flags не обнаружены
- `blocked`: gate был активен и blocking condition сработала

`top_blocking_law_basis_gate_flag_codes`

- текущий ranking blocking signals
- в narrow scope `17.2/17.2a` ожидается только:
  - `sanction_or_exception_used_as_primary`

`groups_blocked_by_law_basis_gate`

- показывает, в каких allowlist groups реально сработал narrow gate
- помогает вручную проверить, не уходит ли blocking condition в unexpected noisy zone

### Что это значит practically

На этапе `17.2a`:

- `law_basis_gate_status` — это internal readiness layer
- `expectation_summary` остаётся главным acceptance-layer result
- `law_basis_gate_simulation` остаётся dry-run visibility layer
- `law_basis_gate_status_summary` не переопределяет suite result
- broader gate по `missing_primary_basis_norm` и `law_family_mismatch` остаётся future

## Финальный checkpoint по текущему этапу шага 17

На текущем post-MVP этапе шаг `17` следует считать закрытым как internal deterministic quality review / gate-readiness contour.

Что уже входит в завершённый scope этого этапа:

- `17.1a` implemented deterministic `law_basis_review` kernel
- `17.1b` internal runner / reporting integration
- `17.1c` calibration baseline policy
- `17.1d` non-blocking gate simulation
- `17.1e` dry-run calibration report
- `17.2` narrow internal-only opt-in gate readiness
- `17.2a` usage validation / runbook

Практический итог по `Step 17`:

- internal review contour уже существует и опирается на deterministic flags, а не на speculative AI reviewer
- `law_basis_review` и `law_basis_gate_simulation` дают visibility и calibration без automatic suite blocking
- narrow gate readiness существует только как internal-only, opt-in и allowlist-scoped слой
- public assistant behavior и runtime `Step 16` не меняются самим шагом `17`

Что intentionally остаётся future:

- broader regression gate
- expanded blocking flags beyond `sanction_or_exception_used_as_primary`
- review UI
- Prisma/schema для review history
- AI reviewer
- cross-run analytics / trends
- broader workflow/policy layer поверх current internal contour

Практическое правило:

- следующий крупный AI Legal Core этап нужно выбирать отдельно
- шаг `17` не должен автоматически расширяться в global gate, UI или full review platform без нового отдельного решения

### Связь с broader citation behavior scenario suite

После закрытия текущего этапа `17` citation-focused suite expansion выполнен на стороне `Step 16` tests и docs:

- без новых review flags
- без новых gate modes
- без расширения blocking policy
- без изменения deterministic internal contour

Это важно, потому что broader citation behavior coverage нужен как evidence layer для возможного future runtime hardening, а не как причина автоматически расширять `Step 17`.

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
