import { ZodError } from "zod";

import { createDocumentRecord, getDocumentByIdForAccount, updateDocumentDraftRecord } from "@/db/repositories/document.repository";
import { getCharacterByIdForAccount } from "@/db/repositories/character.repository";
import { getServerByCode } from "@/db/repositories/server.repository";
import { setActiveCharacterSelection, setActiveServerSelection } from "@/server/app-shell/selection";
import {
  createOgpComplaintDraftActionInputSchema,
  documentAuthorSnapshotSchema,
  ogpComplaintDraftPayloadSchema,
  saveDocumentDraftActionInputSchema,
  type DocumentAuthorSnapshot,
  type OgpComplaintDraftPayload,
} from "@/schemas/document";

export const OGP_COMPLAINT_FORM_SCHEMA_VERSION = "ogp_complaint_mvp_editor_v1";

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

export class DocumentRepresentativeAccessError extends Error {
  constructor() {
    super("Representative filing доступен только персонажу с access flag advocate.");
    this.name = "DocumentRepresentativeAccessError";
  }
}

export class DocumentValidationError extends Error {
  constructor() {
    super("Документ не прошёл валидацию.");
    this.name = "DocumentValidationError";
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

function canUseRepresentativeFiling(authorSnapshot: {
  accessFlags: string[];
}) {
  return authorSnapshot.accessFlags.includes("advocate");
}

function normalizeOgpComplaintDraftPayload(input: unknown): OgpComplaintDraftPayload {
  try {
    const parsed = ogpComplaintDraftPayloadSchema.parse(input);

    return {
      ...parsed,
      trustorSnapshot:
        parsed.filingMode === "representative"
          ? (parsed.trustorSnapshot ?? {
              sourceType: "inline_manual",
              fullName: "",
              passportNumber: "",
              note: "",
            })
          : null,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      throw new DocumentValidationError();
    }

    throw error;
  }
}

function assertRepresentativeAccess(input: {
  authorSnapshot: Pick<DocumentAuthorSnapshot, "accessFlags">;
  payload: OgpComplaintDraftPayload;
}) {
  if (input.payload.filingMode !== "representative") {
    return;
  }

  if (!canUseRepresentativeFiling(input.authorSnapshot)) {
    throw new DocumentRepresentativeAccessError();
  }
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
  try {
    return normalizeOgpComplaintDraftPayload(payload);
  } catch (error) {
    if (error instanceof DocumentValidationError) {
      return {
        filingMode: "self",
        appealNumber: "",
        objectOrganization: "",
        objectFullName: "",
        incidentAt: "",
        situationDescription: "",
        violationSummary: "",
        workingNotes: "",
        trustorSnapshot: null,
        evidenceGroups: [],
      } satisfies OgpComplaintDraftPayload;
    }

    throw error;
  }
}

export async function createInitialOgpComplaintDraft(
  input: {
    accountId: string;
    serverSlug: string;
    characterId: string;
    title: string;
    payload: unknown;
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
  const authorSnapshot = buildAuthorSnapshot({
    character,
    server,
    capturedAt,
  });
  const payload = normalizeOgpComplaintDraftPayload(parsed.payload);

  assertRepresentativeAccess({
    authorSnapshot,
    payload,
  });

  const createdDocument = await dependencies.createDocumentRecord({
    accountId: input.accountId,
    serverId: server.id,
    characterId: character.id,
    documentType: "ogp_complaint",
    title: parsed.title || getDocumentTitleForType("ogp_complaint"),
    formSchemaVersion: OGP_COMPLAINT_FORM_SCHEMA_VERSION,
    snapshotCapturedAt: capturedAt,
    authorSnapshotJson: authorSnapshot,
    formPayloadJson: payload,
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
    payload: unknown;
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

    const authorSnapshot = readDocumentAuthorSnapshot(existingDocument.authorSnapshotJson);
    const payload = normalizeOgpComplaintDraftPayload(parsed.payload);

    assertRepresentativeAccess({
      authorSnapshot,
      payload,
    });

    const savedDocument = await dependencies.updateDocumentDraftRecord({
      documentId: existingDocument.id,
      title: parsed.title,
      formPayloadJson: payload,
    });

    if (!savedDocument) {
      throw new DocumentAccessDeniedError();
    }

    return savedDocument;
}
