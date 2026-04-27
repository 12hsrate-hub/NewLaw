# План 18: Complaint Narrative Improvement v1

## Статус

`post-MVP / active / partial / deployed`

## Текущий implemented checkpoint по `18.1`

`18.1` реализован как backend-only contract slice без UI integration.

Что уже входит:

- schema-driven input contract
- schema-driven output contract
- blocking preflight validation
- compact prompt/style builder
- structured output parser/validator
- deterministic backend tests без real AI calls

Что intentionally ещё не входит:

- real AI action invocation
- wiring в complaint wizard UI
- кнопка `Улучшить описание`
- persistence нового результата в draft editor
- full review workflow вокруг этого модуля

## Текущий implemented checkpoint по `18.2`

`18.2` реализован как backend integration slice без UI wiring.

Что уже входит:

- owner-only server action / internal handler для запуска improvement flow
- AI invocation через существующий `document-ai` backend contour
- structured output parse из proxy response
- safe error handling для `blocked / unavailable / invalid_output`
- deterministic tests с mock AI provider
- AI request logging через существующий backend request log

Что intentionally ещё не входит:

- wiring в complaint wizard UI
- кнопка `Улучшить описание`
- сохранение improved narrative обратно в draft editor
- BBCode integration
- Prisma/schema changes
- deploy/runtime rollout

## Текущий implemented checkpoint по `18.3`

`18.3` реализован как draft adapter slice без UI integration.

Что уже входит:

- отдельный helper для сборки `ComplaintNarrativeImprovementRuntimeInput` из реального `ogp_complaint` draft/document context
- owner-only invocation по `documentId` с явным draft-based adapter path
- safe branches для:
  - `document-access-denied`
  - `unsupported-document-type`
  - `invalid-draft`
  - `rewrite-blocked`
  - `rewrite-unavailable`
  - `invalid-output`
- deterministic tests без real AI calls, включая проверки, что provider не вызывается при blocked / unsupported / invalid draft

Что intentionally ещё не входит:

- wiring в complaint wizard UI
- automatic apply improved text into draft
- сохранение результата improvement в editor state
- BBCode integration
- Prisma/schema changes

## Текущий implemented checkpoint по `18.4`

`18.4` реализован как UI integration slice без изменения backend contract и без изменения `BBCode`.

Что уже входит:

- кнопка `Улучшить описание` внутри OGP complaint editor рядом с полем `Подробное описание ситуации`
- вызов existing owner-only backend action по `documentId` без повторной сборки input на клиенте
- preview-before-apply поведение:
  - показ `improved_text`
  - показ `missing_facts`
  - показ `review_notes`
  - показ `risk_flags`
  - показ `legal_basis_used`
  - warning при `should_send_to_review = true`
- safe UI branches для:
  - `rewrite-blocked`
  - `unsupported-document-type`
  - `invalid-draft`
  - `rewrite-unavailable`
  - `invalid-output`
- применение только в `situation_description` без автозамены других полей
- deterministic UI/helper tests без real AI calls

Что intentionally ещё не входит:

- persistence AI result history
- отдельная review panel с richer UX
- analytics / cost tracking per feature
- richer legal basis display
- BBCode integration
- Prisma/schema changes

## Post-deploy checkpoint по `18.4`

Production deploy для UI slice `18.4` выполнен на commit `be0f509`.

Подтверждено:

- active release: `be0f50953ca7b139d7b75f3337fc808e4a6bb966`
- `/srv/newlaw/app/current` указывает на `/srv/newlaw/app/releases/be0f509`
- `/api/health` = `ok`
- production model для этого flow: `gpt-5.4-mini`
- для env/smoke использовался только:

```text
node --env-file=/srv/newlaw/app/shared/.env.production ...
```

- `bash source .env.production` не использовался

### Targeted UI smoke outcomes

Подтверждено:

1. Кнопка `Улучшить описание` отображается рядом с полем `Подробное описание ситуации` и не является primary submit action.
2. `blocked/preflight` branch работает безопасно:
   - при отсутствии ФИО доверителя в представительской жалобе backend возвращает safe blocked message
   - AI provider не вызывается
3. `success preview` работает:
   - preview panel показывается
   - `improved_text` получен
   - `missing_facts`, `review_notes` и `risk_flags` показываются отдельно
   - `legal_basis_used` может оставаться пустым при слабом или отсутствующем legal context
   - `should_send_to_review = true` показывается как warning
   - текст не применяется автоматически
4. `apply` semantics работают:
   - меняется только `situation_description`
   - не меняются `violationSummary`, `evidenceItems`, `incidentAt`, `objectOrganization`, `objectFullName`, `trustorSnapshot`, `BBCode`
5. `evidenceItems` остаётся optional:
   - пустой список доказательств не блокирует improvement
6. Safe ветки `provider unavailable / invalid output` на production не форсировались, но уже покрыты тестами.

### Future polish note

Во время одного `success preview` был замечен неидеальный role phrasing:

- `в статусе представителя адвоката`

Это не блокировало smoke и не влияло на безопасность flow, но зафиксировано как future polish:

- нормализация role phrase для applicant / representative / advocate wording

## Назначение линии

`Complaint Narrative Improvement v1` — это отдельный AI-flow для `ogp_complaint`, который улучшает только поле `Подробное описание ситуации`.

Это не:

- общий Legal Q&A
- генерация всей жалобы
- генерация итогового `BBCode`
- rewrite поля `Суть нарушения`
- замена `AI Legal Core`

Цель модуля:

- превратить `raw_situation_description` в юридически связный, официальный и пригодный для вставки narrative-текст
- сохранить factual grounding
- использовать legal context только как ограниченный вспомогательный слой
- не ломать existing complaint wizard и `BBCode` generation

## Связь с текущим repo-state

Линия строится поверх уже существующих контуров:

- `document field rewrite v1`
- first grounded document AI v2 rollout
- `AI Legal Core`

Но должна оставаться отдельным модулем, потому что:

- current `document field rewrite v1` слишком общий и не задаёт complaint-specific legal caution
- current grounded rewrite не равен improvement narrative-поля внутри уже собранной жалобы
- `AI Legal Core` не должен превращаться в complaint narrative generator

## Источники данных

### Основной источник фактов

Единственный основной source-of-truth для narrative:

- `raw_situation_description`

### Контекстные поля

Остальные поля формы используются только как context:

- `server_id`
- `law_version`, если есть
- `active_character`
- `applicant_role`
- `representative_mode`
- `victim_or_trustor_mode`
- `victim_or_trustor_name`, если есть
- `organization`
- `subject_name`
- `date_time`
- `evidence_list`, если есть
- `attorney_request` structured data, если есть
- `arrest_or_bodycam` structured data, если есть
- `selected_legal_context`, если есть

### Что запрещено использовать как source-of-facts

Поле `short_violation_summary` / `Формулировка сути нарушения` не должно использоваться как источник генерации `improved_text`.

Допустимая future роль этого поля:

- только `consistency-check`
- только отдельный review signal
- не source text

## Backend contract

### Planned feature role

Модуль должен жить как отдельный backend action / service внутри document AI contour.

Предпочтительная роль:

- отдельный `featureKey`
- отдельный input schema
- отдельный result schema
- отдельный prompt builder
- отдельный parser/validator output

### Рекомендуемое место в архитектуре

Логически модуль должен стоять рядом с:

- `src/server/document-ai/rewrite.ts`
- `src/server/document-ai/grounded-rewrite.ts`
- `src/document-ai/sections.ts`

Но не подменять их generic behavior.

Рекомендуемая форма:

- новый complaint-specific backend contract
- reuse общих utility-функций только там, где это не ломает границы

### Planned input shape

```ts
type ComplaintNarrativeImprovementInput = {
  documentId: string;
  lengthMode?: "short" | "normal" | "detailed";
};
```

Внутри backend action перед вызовом AI строится normalized runtime payload:

```ts
type ComplaintNarrativeImprovementRuntimeInput = {
  server_id: string;
  law_version: string | null;
  active_character: {
    full_name: string;
    role_label: string | null;
  };
  applicant_role: string | null;
  representative_mode: "self" | "representative";
  victim_or_trustor_mode: "self" | "trustor";
  victim_or_trustor_name: string | null;
  organization: string;
  subject_name: string;
  date_time: string;
  raw_situation_description: string;
  evidence_list: Array<{
    label: string;
    url?: string;
  }>;
  attorney_request_context?: Record<string, unknown> | null;
  arrest_or_bodycam_context?: Record<string, unknown> | null;
  selected_legal_context?: {
    laws: Array<{
      law_name: string;
      article?: string;
      part?: string;
      excerpt?: string;
    }>;
    precedents: Array<{
      title: string;
      reason: string;
    }>;
  } | null;
  length_mode: "short" | "normal" | "detailed";
};
```

## Blocking validation before AI run

Улучшение narrative нельзя запускать, пока не заполнены:

1. `server_id`
2. `active_character`
3. `applicant_role` или иной явный статус заявителя
4. `organization`
5. `subject_name`
6. `victim_or_trustor_mode`
7. `raw_situation_description`
8. `date_time`

Дополнительное правило для режима подачи:

- если жалоба представительская, должен быть явно указан доверитель и его ФИО
- если жалоба от своего имени, это должно быть явно отражено как `self`

Не блокировать запуск из-за отсутствия:

- `evidence_list`
- `short_violation_summary`
- `selected_legal_context`
- final violation wording
- ссылок на доказательства

## Handling evidence

`evidence_list` — optional context.

Правила:

- если доказательства есть, AI может учитывать их по смыслу
- если доказательств нет, improvement не блокируется
- если `raw_situation_description` ссылается на видео, документ или материал, которого нет в `evidence_list`, модуль должен:
  - добавить `risk_flag: "missing_evidence"`
  - добавить `review_note` о необходимости проверить наличие доказательства
- полный список доказательств нельзя дублировать внутри `improved_text`

## Date/time handling

`date_time` обязательно как поле формы, но не должно автоматически трактоваться как тип события.

AI не должен по умолчанию считать, что это:

- время задержания
- время ареста
- время штрафа
- время отказа
- время адвокатского запроса
- время непредоставления записи

Правило:

- если тип даты явно следует из `raw_situation_description`, можно использовать конкретно
- если тип даты неясен, использовать нейтрально или не вставлять в текст

В таком случае нужно вернуть:

- `risk_flag: "ambiguous_date_time"`
- `review_note`: `Необходимо проверить, к какому именно событию относится указанная дата/время.`

## Prompt and style profile

В runtime должен использоваться компактный style profile, а не длинные примеры готовых жалоб.

### Источник style rules

Примеры удачных жалоб можно использовать только как:

- style reference
- corpus для выделения правил

Нельзя:

- копировать их дословно
- включать полные тексты жалоб в runtime prompt
- использовать их как hidden template для генерации

### Требуемый стиль

- официальный
- юридический
- нейтральный
- уверенный
- без эмоций
- без разговорных формулировок
- без неподтверждённых фактов

Внутри `improved_text` избегать:

- `возможно`
- `вероятно`
- `если это правда`

### Базовая структура `improved_text`

1. роль заявителя и доверителя, если применимо
2. фактическое событие
3. действия объекта заявления
4. действия представителя после события
5. материалы / что было предоставлено или не предоставлено
6. юридическая значимость обстоятельств
7. применимые нормы, если их даёт `selected_legal_context`
8. короткая финальная связка о необходимости проверки ОГП

## Legal basis rules

Нормы закона можно использовать только из `selected_legal_context`.

Правила:

- максимум `2-4` нормы
- без длинных цитат
- в `short` mode — нормы только встроенно в narrative
- в `normal` / `detailed` — допустим отдельный короткий юридический абзац
- если legal context отсутствует, статьи не выдумывать
- если норма только косвенно подходит, не вставлять её в `improved_text`, а вынести в `review_notes`

Прецеденты:

- допустимы только при прямой тематической связи
- не более `1-2`
- без перегруза текста

## Legal caution

По умолчанию narrative не должен писать категорично:

- `сотрудник нарушил закон`
- `действия являются незаконными`
- `задержание незаконно`

Предпочтительные формулировки:

- `обстоятельства требуют проверки`
- `подлежит правовой оценке`
- `может свидетельствовать о наличии признаков нарушения`
- `вызывает сомнения в соблюдении установленного порядка`
- `препятствует объективной проверке законности процессуальных действий`

Категоричная формулировка допустима только если одновременно:

- факт нарушения прямо подтверждён официальным документом
- legal context однозначный
- narrative не превращается в необоснованное обвинение

## Length modes

```ts
type NarrativeLengthMode = "short" | "normal" | "detailed";
```

Лимиты:

- `short`: `900-1400`
- `normal`: `1800-2600`
- `detailed`: `2500-3500`
- hard max: `4000`

Default:

- `normal`

Правила:

- если `raw_situation_description` слишком длинный, AI сокращает повторы, эмоции, длинные цитаты и второстепенную хронологию
- если `raw_situation_description` слишком короткий, AI не раздувает текст искусственно
- при слишком бедном фактическом контуре:
  - `missing_facts` заполняются
  - `should_send_to_review = true`

## Planned output contract

```ts
type ComplaintNarrativeImprovementResult = {
  improved_text: string;

  legal_basis_used: Array<{
    law_name: string;
    article?: string;
    part?: string;
    reason: string;
  }>;

  used_facts: string[];

  missing_facts: string[];

  review_notes: string[];

  risk_flags: Array<
    | "insufficient_facts"
    | "weak_legal_context"
    | "missing_evidence"
    | "unclear_roles"
    | "unclear_timeline"
    | "ambiguous_date_time"
    | "possible_overclaiming"
    | "legal_basis_not_found"
  >;

  should_send_to_review: boolean;
};
```

## Archetypes

### A. Адвокатский запрос + отсутствие материалов / ответа

Правила:

- учитывать доверителя и представителя
- учитывать `BAR`-запрос
- учитывать официальный ответ или отсутствие ответа
- не выдумывать, что запись отсутствует, если указано только `не предоставлена`
- нормы об адвокатском запросе брать только из `selected_legal_context`

### B. Задержание + отсутствие видеозаписи

Правила:

- отделять `запись не предоставлена` от `запись отсутствует` или `утрачена`
- не утверждать незаконность задержания как установленный факт
- показывать, что отсутствие записи затрудняет проверку законности
- нормы о видеофиксации и хранении использовать только из `selected_legal_context`

### C. Неверная квалификация / спорная статья

Правила:

- не писать категорично `статья неприменима`
- формулировать как необходимость проверки правомерности квалификации
- не добавлять новые статьи

### D. Отказ от процессуального действия

Правила:

- отделять факт отказа от правовой оценки
- если есть цитата отказа, использовать её аккуратно
- допустима формулировка `может свидетельствовать о субъективном факторе`
- не писать сразу `отказ незаконен`

### E. Сложный multi-actor case

Правила:

- сохранять хронологию
- не путать участников
- не терять ключевые факты
- сокращать повторы
- не дублировать весь список доказательств

## Test plan

Implementation должен покрыть:

1. fact grounding
   - не добавляет новые факты
   - не добавляет даты, ФИО, доказательства и статьи
   - не превращает `не предоставлена запись` в `запись отсутствует`, если этого нет
2. role consistency
   - не путает заявителя, представителя, доверителя, потерпевшего и объект заявления
3. legal basis
   - статьи только из `selected_legal_context`
   - нет legal context — нет статей в `improved_text`
   - `legal_basis_used` пустой или ограниченный
   - `review_notes` отражает `legal_basis_not_found` или `weak_legal_context`
4. ambiguous date/time
   - `date_time` не привязывается к задержанию, штрафу, отказу или запросу без явного factual signal
5. no use of `short_violation_summary`
   - оно не используется как source-of-facts и не задаёт фокус narrative
6. evidence optional
   - пустой `evidence_list` не блокирует improvement
   - сам по себе не делает `should_send_to_review = true`
7. evidence mentioned but missing
   - если raw text ссылается на доказательство, а `evidence_list` пустой, возвращается `missing_evidence`
8. insufficient facts
   - `improved_text` всё равно формируется
   - `missing_facts` заполняются
   - `should_send_to_review = true`
   - детали не выдумываются
9. no full complaint generation
   - не генерируется весь `BBCode`
   - не повторяются целиком блоки представителя, потерпевшего и доказательств
10. length mode
   - `normal` примерно держится в `1800-2600`
   - hard max `4000`

## Implementation slices

### Slice A — docs and contract

- input/output contract
- style profile
- validation rules
- test plan

Статус:

- implemented через `18.1`

### Slice B — backend contract and prompt builder

- input/result types
- compact style profile
- prompt builder
- structured output parsing and validation

Статус:

- implemented через `18.1` + `18.2`

### Slice C — tests

- archetype tests
- fact grounding tests
- role consistency
- no legal context
- evidence optional / missing evidence

### Slice D — backend integration

- подключение к complaint wizard backend action
- blocking validation перед AI run
- без UI redesign

Статус:

- partially implemented в `18.2` + `18.3`
- owner-only action + AI invocation уже есть
- draft adapter для реального `ogp_complaint` backend context уже есть
- wiring в complaint wizard backend без UI и без apply-in-editor закрыт через `18.3`

### Slice E — future UI

- кнопка `Улучшить описание`
- показ `improved_text`
- показ `missing_facts` и `review_notes`
- кнопка `Применить текст`

Статус:

- minimally implemented через `18.4`
- UI теперь умеет:
  - запросить улучшение narrative
  - показать preview и review data
  - применить только `situation_description`
- richer UX и history/persistence AI results остаются future

## Future UI integration

UI уже минимально подключён и должен оставаться узким:

- только внутри OGP complaint editor
- только для поля `situation_description`
- без изменения структуры остальных шагов wizard
- без redesign всего editor shell
- без влияния на `BBCode` renderer
- без автоприменения improved text без подтверждения пользователя

## Что модуль не должен ломать

Не должен ломать:

- `server legal assistant`
- `AI Legal Core`
- `AI Quality Review`
- `citation behavior contract`
- full `BBCode` generation
- current `document field rewrite v1`
- grounded rewrite для других секций
- roles / access model

## Границы и запреты

В рамках этой линии не нужно автоматически:

- менять broad Legal Q&A
- расширять `Step 17` gate
- менять `Prisma/schema` без отдельного обоснования
- делать UI redesign на docs stage
- смешивать complaint narrative с full complaint generation
- подменять `violation_summary`
- встраивать полные example complaints в runtime prompt

## Practical next step

Следующий безопасный инженерный шаг после `18.4`:

- richer review UX без изменения backend contract
- optional apply/persist flow refinement внутри wizard
- feature-level analytics / cost tracking
- без изменения `BBCode` generation contract
