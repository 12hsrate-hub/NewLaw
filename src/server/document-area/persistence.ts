import { createDocumentRecord, getDocumentByIdForAccount, updateDocumentDraftRecord } from "@/db/repositories/document.repository";
import { getCharacterByIdForAccount } from "@/db/repositories/character.repository";
import { getServerByCode } from "@/db/repositories/server.repository";
import { setActiveCharacterSelection, setActiveServerSelection } from "@/server/app-shell/selection";
import {
  createOgpComplaintDraftActionInputSchema,
  documentAuthorSnapshotSchema,
  ogpComplaintDraftPayloadSchema,
  saveDocumentDraftActionInputSchema,
} from "@/schemas/document";

export const OGP_COMPLAINT_FORM_SCHEMA_VERSION = "ogp_complaint_foundation_v1";

type DocumentPersistenceDependencies = {
  getServerByCode: typeof getServerByCode;
  getCharacterByIdForAccount: typeof getCharacterByIdForAccount;
  createDocumentRecord: typeof createDocumentRecord;
  getDocumentByIdForAccount: typeof getDocumentByIdForAccount;
  updateDocumentDraftRecord: typeof updateDocumentDraftRecord;
  setActiveServerSelection: typeof setActiveServerSelection;
  setActiveCharacterSelection: typeof setActiveCharacterSelection;
  now: () => Date;
};

const defaultDependencies: DocumentPersistenceDependencies = {
  getServerByCode,
  getCharacterByIdForAccount,
  createDocumentRecord,
  getDocumentByIdForAccount,
  updateDocumentDraftRecord,
  setActiveServerSelection,
  setActiveCharacterSelection,
  now: () => new Date(),
};

export class DocumentServerUnavailableError extends Error {
  constructor() {
    super("Server document area недоступен для этого serverSlug.");
    this.name = "DocumentServerUnavailableError";
  }
}

export class DocumentCharacterUnavailableError extends Error {
  constructor() {
    super("На этом сервере нельзя создать документ без доступного персонажа.");
    this.name = "DocumentCharacterUnavailableError";
  }
}

export class DocumentAccessDeniedError extends Error {
  constructor() {
    super("Документ не найден или недоступен текущему аккаунту.");
    this.name = "DocumentAccessDeniedError";
  }
}

function buildAuthorSnapshot(input: {
  character: NonNullable<Awaited<ReturnType<typeof getCharacterByIdForAccount>>>;
  server: NonNullable<Awaited<ReturnType<typeof getServerByCode>>>;
  capturedAt: Date;
}) {
  return documentAuthorSnapshotSchema.parse({
    characterId: input.character.id,
    serverId: input.server.id,
    serverCode: input.server.code,
    serverName: input.server.name,
    fullName: input.character.fullName,
    nickname: input.character.nickname,
    passportNumber: input.character.passportNumber,
    isProfileComplete: input.character.isProfileComplete,
    roleKeys: input.character.roles.map((role) => role.roleKey),
    accessFlags: input.character.accessFlags.map((flag) => flag.flagKey),
    capturedAt: input.capturedAt.toISOString(),
  });
}

export function getDocumentTitleForType(documentType: "ogp_complaint" | "rehabilitation" | "lawsuit") {
  if (documentType === "ogp_complaint") {
    return "Жалоба в ОГП";
  }

  if (documentType === "rehabilitation") {
    return "Документ по реабилитации";
  }

  return "Исковое заявление";
}

export function readDocumentAuthorSnapshot(snapshot: unknown) {
  return documentAuthorSnapshotSchema.parse(snapshot);
}

export function readOgpComplaintDraftPayload(payload: unknown) {
  const parsed = ogpComplaintDraftPayloadSchema.safeParse(payload);

  if (parsed.success) {
    return parsed.data;
  }

  return {
    workingNotes: "",
  };
}

export async function createInitialOgpComplaintDraft(
  input: {
    accountId: string;
    serverSlug: string;
    characterId: string;
    title: string;
    workingNotes: string;
  },
  dependencies: DocumentPersistenceDependencies = defaultDependencies,
) {
  const parsed = createOgpComplaintDraftActionInputSchema.parse(input);
  const server = await dependencies.getServerByCode(parsed.serverSlug);

  if (!server) {
    throw new DocumentServerUnavailableError();
  }

  const character = await dependencies.getCharacterByIdForAccount({
    accountId: input.accountId,
    characterId: parsed.characterId,
  });

  if (!character || character.serverId !== server.id) {
    throw new DocumentCharacterUnavailableError();
  }

  const capturedAt = dependencies.now();
  const createdDocument = await dependencies.createDocumentRecord({
    accountId: input.accountId,
    serverId: server.id,
    characterId: character.id,
    documentType: "ogp_complaint",
    title: parsed.title || getDocumentTitleForType("ogp_complaint"),
    formSchemaVersion: OGP_COMPLAINT_FORM_SCHEMA_VERSION,
    snapshotCapturedAt: capturedAt,
    authorSnapshotJson: buildAuthorSnapshot({
      character,
      server,
      capturedAt,
    }),
    formPayloadJson: {
      workingNotes: parsed.workingNotes,
    },
  });

  await dependencies.setActiveServerSelection(input.accountId, {
    serverId: server.id,
  });
  await dependencies.setActiveCharacterSelection(input.accountId, {
    serverId: server.id,
    characterId: character.id,
  });

  return createdDocument;
}

export async function saveOwnedDocumentDraft(
  input: {
    accountId: string;
    documentId: string;
    title: string;
    workingNotes: string;
  },
  dependencies: DocumentPersistenceDependencies = defaultDependencies,
) {
  const parsed = saveDocumentDraftActionInputSchema.parse(input);
  const existingDocument = await dependencies.getDocumentByIdForAccount({
    accountId: input.accountId,
    documentId: parsed.documentId,
  });

  if (!existingDocument) {
    throw new DocumentAccessDeniedError();
  }

  const savedDocument = await dependencies.updateDocumentDraftRecord({
    documentId: existingDocument.id,
    title: parsed.title,
    formPayloadJson: {
      ...readOgpComplaintDraftPayload(existingDocument.formPayloadJson),
      workingNotes: parsed.workingNotes,
    },
  });

  if (!savedDocument) {
    throw new DocumentAccessDeniedError();
  }

  return savedDocument;
}
