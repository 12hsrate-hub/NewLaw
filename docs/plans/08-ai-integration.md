# План 08: AI Integration

## Статус

`partial`

- public `server legal assistant` уже реализован как отдельный модуль
- `11.3` добавляет первый document-AI block внутри existing document area
- согласованный `v1` scope для `document field rewrite` уже реализован
- первый grounded `v2` rollout для supported legal sections уже реализован
- текущий MVP AI scope уже не считается пустым или блокирующе незавершённым
- chat UI и broad drafting suite в этом плане не активируются

## Текущий реализованный scope

### 1. Server legal assistant

- отдельный модуль `/assistant` и `/assistant/[serverSlug]`
- proxy-only AI foundation
- `ai_requests` logging
- laws-first grounded answer policy

### 2. Document field rewrite v1

Реализован только как helper внутри existing OGP/claims editors:

- owner-only server action `rewriteDocumentFieldAction({ documentId, sectionKey })`
- только field-level rewrite
- только persisted document payload + persisted snapshots
- no grounding in v1
- no silent overwrite
- no silent save
- suggestion отдельно от final field
- `Apply` меняет только local editor state
- persistence идёт только через существующий save/autosave flow

### 3. Grounded document AI v2

Реализован как отдельный editor-centric helper поверх existing retrieval foundation:

- owner-only server action `rewriteGroundedDocumentFieldAction({ documentId, sectionKey })`
- reuse existing `searchAssistantCorpus(...)` как lower retrieval layer
- laws-first policy сохраняется
- grounded outcome ветки:
  - `law_grounded`
  - `precedent_grounded`
  - `insufficient_corpus`
- отдельный UI action `Улучшить с опорой на нормы`
- suggestion по-прежнему остаётся suggestion
- `Apply` по-прежнему меняет только local editor state
- no silent overwrite
- no silent save
- no embedded chat UI

Поддержанные секции первого grounded rollout:

- OGP:
  - `violation_summary`
- Claims:
  - `legal_basis_summary`
  - `requested_relief`

Поддержанные секции v1:

- OGP:
  - `situation_description`
  - `violation_summary`
- Claims:
  - `factual_background`
  - `legal_basis_summary`
  - `requested_relief`
  - `rehabilitation_basis`
  - `harm_summary`
  - `pretrial_summary`

## Что не входит

- client-side direct AI calls
- chat UI inside document editor
- full-document rewrite
- hidden auto-generation
- hidden auto-apply или auto-save
- grounded legal reasoning inside document AI v1
- forum automation
- template documents
- route migration

## Product rules

- AI helper не становится source of truth final document
- если editor dirty, AI action блокируется сообщением `сначала сохраните черновик`
- unsupported fields не получают AI affordance
- trustor identity fields, evidence rows, titles, publication metadata и working notes не участвуют в AI rewrite
- assistant и document AI остаются разными модулями
- grounded document AI не превращает editor в embedded legal Q&A
- precedent никогда не подаётся как норма закона
- если retrieval support незащитим, grounded flow честно возвращает `insufficient_corpus`

## Logging and safety

- используется existing proxy-only AI foundation
- используется existing `ai_requests`
- `featureKey = document_field_rewrite`
- `featureKey = document_field_rewrite_grounded`
- в request metadata логируются только safe поля:
  - `documentId`
  - `documentType`
  - `sectionKey`
  - `updatedAt`
  - `filingMode`
  - `hasTrustor`
  - `evidenceGroupCount`
  - `sourceLength`
  - `contextFieldKeys`
  - `contextLength`
- в grounded flow дополнительно логируются только safe retrieval поля:
  - `serverId`
  - `groundingMode`
  - `lawResultCount`
  - `precedentResultCount`
  - `hasCurrentLawCorpus`
  - `hasUsablePrecedentCorpus`
  - `combinedRetrievalRevision`
  - `retrievalPromptBlockCount`
- full raw document payload в логи не уходит
- full retrieved block texts и full prompt в логи тоже не уходят

## Follow-up после текущего шага

Отдельными будущими решениями остаются:

- document consistency check
- broader drafting assist beyond field-level rewrite
- grounded expansion beyond first supported legal sections
- deeper document-AI UX поверх existing grounded rewrite foundation

Но это уже не часть текущего agreed scope после `v1 + first grounded legal rollout`.

Отдельно зафиксировано:

- assistant и document AI остаются разными product lines
- current MVP AI scope покрывается существующим assistant module + document field rewrite v1
- поэтому `partial` здесь означает не “AI для MVP ещё не существует”, а только то, что future expansion beyond current scope ещё не закрыта
