# План 08: AI Integration

## Статус

`partial`

- public `server legal assistant` уже реализован как отдельный модуль
- `11.3` добавляет первый document-AI block внутри existing document area
- chat UI, grounding по law corpus/precedents и broad drafting suite в этом плане не активируются

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

## Logging and safety

- используется existing proxy-only AI foundation
- используется existing `ai_requests`
- `featureKey = document_field_rewrite`
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
- full raw document payload в логи не уходит

## Follow-up после текущего шага

Отдельными будущими решениями остаются:

- document consistency check
- optional grounded rewrite для legal sections
- broader drafting assist beyond field-level rewrite

Но это уже не часть текущего v1 scope.
