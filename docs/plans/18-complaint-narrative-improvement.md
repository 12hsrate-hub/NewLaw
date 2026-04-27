# План 18: Complaint Narrative Improvement v1

## Статус

`post-MVP / planned`

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

- partially implemented в `18.1`
- full AI action invocation остаётся следующим безопасным slice

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

- future

### Slice E — future UI

- кнопка `Улучшить описание`
- показ `improved_text`
- показ `missing_facts` и `review_notes`
- кнопка `Применить текст`

## Future UI integration

UI не входит в docs-only этап, но целевая интеграция должна быть узкой:

- только внутри OGP complaint editor
- только для поля `situation_description`
- без изменения структуры остальных шагов wizard
- без redesign всего editor shell
- без влияния на `BBCode` renderer

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

Следующий безопасный инженерный шаг после этого docs-only плана:

- `Slice B` как backend-only implementation
- без deploy на docs стадии
- без изменения `BBCode` generation contract
