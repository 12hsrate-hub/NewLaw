# База данных

## Source of truth

Источником правды по текущей схеме БД является:

- [prisma/schema.prisma](../../prisma/schema.prisma)

Этот документ не повторяет Prisma построчно, а фиксирует актуальную прикладную модель и ключевые правила.

## Текущие enum-модели

### Character

- `CharacterRoleKey`: `citizen`, `lawyer`
- `CharacterAccessFlagKey`: `advocate`, `server_editor`, `server_admin`, `tester`

### Documents

- `DocumentType`:
  - `ogp_complaint`
  - `rehabilitation`
  - `lawsuit`
  - `attorney_request`
  - `legal_services_agreement`
- `DocumentStatus`:
  - `draft`
  - `generated`
  - `published`

### OGP publication

- `ForumConnectionState`
- `OgpForumSyncState`
- `OgpForumPublicationOperation`
- `OgpForumPublicationAttemptStatus`

### Corpus / AI

- `LawKind`
- `LawVersionStatus`
- `PrecedentVersionStatus`
- `PrecedentValidityStatus`
- `AIRequestStatus`

## Ключевые модели

### Account

Основные поля:

- `id`
- `email`
- `login`
- `pendingEmail`
- `mustChangePassword`
- `isSuperAdmin`

Связи:

- `characters`
- `documents`
- `trustors`
- `forumSessionConnections`
- `aiRequests`

### Server

Основные поля:

- `id`
- `code`
- `name`
- `isActive`
- `sortOrder`

Связи:

- `characters`
- `documents`
- `trustors`
- `laws`
- `precedents`
- `assistantGuestSessions`

### UserServerState

Назначение:

- хранить active server / active character пользователя внутри конкретного сервера

Основные поля:

- `accountId`
- `serverId`
- `activeCharacterId`
- `lastSelectedAt`

### Character

Основные поля:

- `accountId`
- `serverId`
- `fullName`
- `nickname`
- `passportNumber`
- `profileDataJson`
- `isProfileComplete`
- `activeSignatureId`
- `deletedAt`

Правила:

- максимум `3` персонажа на `account + server` реализуется прикладной логикой
- уникальность паспорта действует внутри `account + server`
- `activeSignatureId` может быть `NULL`

### CharacterSignature

Основные поля:

- `id`
- `characterId`
- `storagePath`
- `mimeType`
- `width`
- `height`
- `fileSize`
- `isActive`
- `createdAt`

Правила:

- одна запись = один конкретный uploaded asset
- storage path versioned и не должен перезаписывать старый asset тем же именем
- исторические signature records не должны ломать frozen document snapshots

### Trustor

Основные поля:

- `accountId`
- `serverId`
- `fullName`
- `passportNumber`
- `phone`
- `icEmail`
- `passportImageUrl`
- `note`
- `deletedAt`

Правила:

- trustor привязан к `user + server`
- trustor registry не является обязательной runtime dependency documents
- soft delete не меняет исторические документы

### Document

Основные поля:

- `accountId`
- `serverId`
- `characterId`
- `trustorId`
- `documentType`
- `status`
- `title`
- `formSchemaVersion`
- `snapshotCapturedAt`
- `authorSnapshotJson`
- `signatureSnapshotJson`
- `formPayloadJson`
- `generatedArtifactJson`
- `generatedArtifactText`
- `generatedOutputFormat`
- `generatedRendererVersion`
- `lastGeneratedBbcode`
- `generatedAt`
- `generatedLawVersion`
- `generatedTemplateVersion`
- `generatedFormSchemaVersion`
- `publicationUrl`
- `isSiteForumSynced`
- `forumSyncState`
- `forumThreadId`
- `forumPostId`
- `forumPublishedBbcodeHash`
- `forumLastPublishedAt`
- `forumLastSyncError`
- `isModifiedAfterGeneration`
- `deletedAt`

Ключевые правила:

- first-save фиксирует snapshot документа
- `authorSnapshotJson` не должен ретроактивно пересобираться из live character profile
- `signatureSnapshotJson` не должен ретроактивно пересобираться из active character signature
- `trustorId` может существовать как связь с registry entry, но source of truth для generation остаётся snapshot документа
- `publicationUrl` и forum metadata нужны только тем document families, которым это действительно нужно

### ForumSessionConnection

Account-scoped foundation для временной OGP forum automation.

Основные поля:

- `accountId`
- `providerKey`
- `state`
- `encryptedSessionPayload`
- `forumUserId`
- `forumUsername`
- `validatedAt`
- `lastValidationError`
- `disabledAt`

Важно:

- raw session/cookies хранятся только в зашифрованном виде
- эта модель не является universal publication subsystem для всех документов

### OgpForumPublicationAttempt

OGP-specific attempt log.

Основные поля:

- `documentId`
- `accountId`
- `operation`
- `status`
- `forumThreadId`
- `forumPostId`
- `errorCode`
- `errorSummary`

Правило:

- attempt log относится только к `ogp_complaint`

### AIRequest

Журнал AI-запросов.

Основные поля:

- `accountId`
- `serverId`
- `guestSessionId`
- `featureKey`
- `providerKey`
- `proxyKey`
- `model`
- `requestPayloadJson`
- `responsePayloadJson`
- `status`
- `errorMessage`

## Snapshot policy

Внутри документа как snapshot/json живут:

- author data
- trustor data
- template/document payload
- signature metadata, если документ использует подпись

Правило:

- уже созданный документ не должен зависеть от live profile/trustor/signature state

## Publication policy

Forum publication metadata относится только к тем document families, где она реально нужна.

На текущем repo-state:

- `ogp_complaint` использует publication model
- claims и template documents не должны автоматически наследовать её

## Template documents and signatures

Актуальная reusable policy:

- character-scoped image signature хранится в `CharacterSignature`
- frozen `signatureSnapshot` фиксируется внутри документа
- `attorney_request` уже использует этот contract напрямую

Отдельная note:

- `legal_services_agreement` уже живёт в общей `Document`-модели без отдельной subtype-таблицы
- текущие renderer-specific особенности этого документа не меняют общую data-model policy для template documents

## Corpus models

В текущей схеме уже существуют:

- `LawSourceIndex`
- `Law`
- `LawVersion`
- `LawSourcePost`
- `LawBlock`
- `LawImportRun`
- `PrecedentSourceTopic`
- `Precedent`
- `PrecedentVersion`
- `PrecedentSourcePost`
- `PrecedentBlock`
- `PrecedentImportRun`
- `AssistantGuestSession`

Это означает, что law corpus, precedents corpus и assistant storage больше нельзя описывать как пустой foundation-only контур.
