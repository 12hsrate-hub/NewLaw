import { ZodError } from "zod";

import {
  createDocumentRecord,
  getDocumentByIdForAccount,
  updateDocumentAuthorSnapshotRecord,
  updateDocumentDraftRecord,
} from "@/db/repositories/document.repository";
import { getCharacterByIdForAccount } from "@/db/repositories/character.repository";
import { getServerByCode } from "@/db/repositories/server.repository";
import {
  normalizeIcEmail,
  normalizePassportNumber,
  normalizePhone,
  normalizeSafeUrl,
  readCharacterProfileData,
} from "@/lib/ogp/generation-contract";
import { setActiveCharacterSelection, setActiveServerSelection } from "@/server/app-shell/selection";
import {
  claimDocumentTypeSchema,
  createClaimDraftActionInputSchema,
  createOgpComplaintDraftActionInputSchema,
  documentAuthorSnapshotSchema,
  documentTitleSchema,
  lawsuitClaimDraftPayloadSchema,
  ogpComplaintDraftPayloadSchema,
  rehabilitationClaimDraftPayloadSchema,
  saveDocumentDraftActionInputSchema,
  type ClaimDocumentType,
  type ClaimsDraftPayload,
  type DocumentAuthorSnapshot,
  type OgpComplaintDraftPayload,
} from "@/schemas/document";

export const OGP_COMPLAINT_FORM_SCHEMA_VERSION = "ogp_complaint_mvp_editor_v1";
export const REHABILITATION_CLAIM_FORM_SCHEMA_VERSION = "rehabilitation_claim_mvp_editor_v1";
export const LAWSUIT_CLAIM_FORM_SCHEMA_VERSION = "lawsuit_claim_mvp_editor_v1";

type DocumentPersistenceDependencies = {
  getServerByCode: typeof getServerByCode;
  getCharacterByIdForAccount: typeof getCharacterByIdForAccount;
  createDocumentRecord: typeof createDocumentRecord;
  getDocumentByIdForAccount: typeof getDocumentByIdForAccount;
  updateDocumentDraftRecord: typeof updateDocumentDraftRecord;
  updateDocumentAuthorSnapshotRecord?: typeof updateDocumentAuthorSnapshotRecord;
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
  updateDocumentAuthorSnapshotRecord,
  setActiveServerSelection,
  setActiveCharacterSelection,
  now: () => new Date(),
};

export class DocumentServerUnavailableError extends Error {
  constructor() {
    super("Документы этого сервера сейчас недоступны. Код: DOCUMENT_SERVER_UNAVAILABLE.");
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
  server: {
    id: string;
    code: string;
    name: string;
  };
  capturedAt: Date;
}) {
  const profileData = readCharacterProfileData(input.character.profileDataJson);

  return documentAuthorSnapshotSchema.parse({
    characterId: input.character.id,
    serverId: input.server.id,
    serverCode: input.server.code,
    serverName: input.server.name,
    fullName: input.character.fullName,
    nickname: input.character.nickname,
    passportNumber: normalizePassportNumber(input.character.passportNumber),
    position: profileData.position,
    address: profileData.address,
    phone: profileData.phone,
    icEmail: profileData.icEmail,
    passportImageUrl: profileData.passportImageUrl,
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

function readLegacyEvidenceText(row: unknown, key: string) {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return "";
  }

  const value = (row as Record<string, unknown>)[key];

  return typeof value === "string" ? value.trim() : "";
}

function readLegacyEvidenceSortOrder(row: unknown, fallbackSortOrder: number) {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return fallbackSortOrder;
  }

  const value = (row as Record<string, unknown>).sortOrder;

  return typeof value === "number" && Number.isInteger(value) ? value : fallbackSortOrder;
}

function normalizeLegacyOgpEvidenceItems(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return input;
  }

  const payload = input as Record<string, unknown>;

  if (Array.isArray(payload.evidenceItems)) {
    return input;
  }

  if (!Array.isArray(payload.evidenceGroups)) {
    return input;
  }

  let fallbackSortOrder = 0;
  const evidenceItems = payload.evidenceGroups.flatMap((group) => {
    if (!group || typeof group !== "object" || Array.isArray(group)) {
      return [];
    }

    const groupTitle = readLegacyEvidenceText(group, "title");
    const rows = (group as Record<string, unknown>).rows;

    if (!Array.isArray(rows)) {
      return [];
    }

    return rows.map((row) => {
      const item = {
        id: readLegacyEvidenceText(row, "id") || `legacy_evidence_${fallbackSortOrder}`,
        mode: "custom" as const,
        templateKey: null,
        labelSnapshot:
          readLegacyEvidenceText(row, "labelSnapshot") ||
          readLegacyEvidenceText(row, "label") ||
          groupTitle,
        url: readLegacyEvidenceText(row, "url"),
        sortOrder: readLegacyEvidenceSortOrder(row, fallbackSortOrder),
      };
      fallbackSortOrder += 1;

      return item;
    });
  });

  return {
    ...payload,
    evidenceItems,
  };
}

function normalizeOgpComplaintDraftPayload(input: unknown): OgpComplaintDraftPayload {
  try {
    const parsed = ogpComplaintDraftPayloadSchema.parse(normalizeLegacyOgpEvidenceItems(input));

    return {
      ...parsed,
      trustorSnapshot:
        parsed.filingMode === "representative"
          ? {
              sourceType: parsed.trustorSnapshot?.sourceType ?? "inline_manual",
              fullName: parsed.trustorSnapshot?.fullName.trim() ?? "",
              passportNumber: normalizePassportNumber(parsed.trustorSnapshot?.passportNumber ?? ""),
              address: parsed.trustorSnapshot?.address.trim() ?? "",
              phone: normalizePhone(parsed.trustorSnapshot?.phone ?? ""),
              icEmail: normalizeIcEmail(parsed.trustorSnapshot?.icEmail ?? ""),
              passportImageUrl: normalizeSafeUrl(parsed.trustorSnapshot?.passportImageUrl ?? ""),
              note: parsed.trustorSnapshot?.note ?? "",
            }
          : null,
      evidenceItems: parsed.evidenceItems
        .map((item, index) => ({
          ...item,
          templateKey: item.mode === "template" ? item.templateKey : null,
          labelSnapshot: item.labelSnapshot.trim(),
          url: normalizeSafeUrl(item.url),
          sortOrder: item.sortOrder ?? index,
        }))
        .sort((left, right) =>
          left.sortOrder === right.sortOrder
            ? left.id.localeCompare(right.id)
            : left.sortOrder - right.sortOrder,
        ),
    };
  } catch (error) {
    if (error instanceof ZodError) {
      throw new DocumentValidationError();
    }

    throw error;
  }
}

function buildEmptyTrustorSnapshot() {
  return {
    sourceType: "inline_manual" as const,
    fullName: "",
    passportNumber: "",
    address: "",
    phone: "",
    icEmail: "",
    passportImageUrl: "",
    note: "",
  };
}

function buildEmptyClaimsDraftPayload(documentType: ClaimDocumentType): ClaimsDraftPayload {
  const commonFields = {
    filingMode: "self" as const,
    respondentName: "",
    claimSubject: "",
    factualBackground: "",
    legalBasisSummary: "",
    requestedRelief: "",
    workingNotes: "",
    trustorSnapshot: null,
    evidenceGroups: [],
  };

  if (documentType === "rehabilitation") {
    return {
      ...commonFields,
      caseReference: "",
      rehabilitationBasis: "",
      harmSummary: "",
    };
  }

  return {
    ...commonFields,
    courtName: "",
    defendantName: "",
    claimAmount: "",
    pretrialSummary: "",
  };
}

function normalizeClaimsDraftPayload(documentType: ClaimDocumentType, input: unknown): ClaimsDraftPayload {
  try {
    const parsed =
      documentType === "rehabilitation"
        ? rehabilitationClaimDraftPayloadSchema.parse(input)
        : lawsuitClaimDraftPayloadSchema.parse(input);

    return {
      ...parsed,
      trustorSnapshot:
        parsed.filingMode === "representative"
          ? (parsed.trustorSnapshot ?? buildEmptyTrustorSnapshot())
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
  payload: Pick<OgpComplaintDraftPayload, "filingMode"> | Pick<ClaimsDraftPayload, "filingMode">;
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

function getDocumentFormSchemaVersion(documentType: "ogp_complaint" | "rehabilitation" | "lawsuit") {
  if (documentType === "ogp_complaint") {
    return OGP_COMPLAINT_FORM_SCHEMA_VERSION;
  }

  if (documentType === "rehabilitation") {
    return REHABILITATION_CLAIM_FORM_SCHEMA_VERSION;
  }

  return LAWSUIT_CLAIM_FORM_SCHEMA_VERSION;
}

function normalizeDocumentTitle(input: {
  title: string;
  documentType: "ogp_complaint" | "rehabilitation" | "lawsuit";
}) {
  if (input.title.length === 0) {
    return getDocumentTitleForType(input.documentType);
  }

  try {
    return documentTitleSchema.parse(input.title);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new DocumentValidationError();
    }

    throw error;
  }
}

export function isClaimsDocumentType(
  documentType: "ogp_complaint" | "rehabilitation" | "lawsuit",
): documentType is ClaimDocumentType {
  return claimDocumentTypeSchema.safeParse(documentType).success;
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
        evidenceItems: [],
      } satisfies OgpComplaintDraftPayload;
    }

    throw error;
  }
}

export function readClaimsDraftPayload(documentType: ClaimDocumentType, payload: unknown) {
  try {
    return normalizeClaimsDraftPayload(documentType, payload);
  } catch (error) {
    if (error instanceof DocumentValidationError) {
      return buildEmptyClaimsDraftPayload(documentType);
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

export async function createInitialClaimDraft(
  input: {
    accountId: string;
    serverSlug: string;
    characterId: string;
    documentType: ClaimDocumentType;
    title: string;
    payload: unknown;
  },
  dependencies: DocumentPersistenceDependencies = defaultDependencies,
) {
  const parsed = createClaimDraftActionInputSchema.parse(input);
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
  const documentType = parsed.documentType;
  const payload = normalizeClaimsDraftPayload(documentType, parsed.payload);

  assertRepresentativeAccess({
    authorSnapshot,
    payload,
  });
  const createdDocument = await dependencies.createDocumentRecord({
    accountId: input.accountId,
    serverId: server.id,
    characterId: character.id,
    documentType,
    title: normalizeDocumentTitle({
      title: parsed.title,
      documentType,
    }),
    formSchemaVersion: getDocumentFormSchemaVersion(documentType),
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

    if (existingDocument.documentType === "ogp_complaint") {
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

    const authorSnapshot = readDocumentAuthorSnapshot(existingDocument.authorSnapshotJson);
    const payload = normalizeClaimsDraftPayload(existingDocument.documentType, parsed.payload);

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

export async function refreshOwnedOgpComplaintAuthorSnapshot(
  input: {
    accountId: string;
    documentId: string;
  },
  dependencies: DocumentPersistenceDependencies = defaultDependencies,
) {
  const existingDocument = await dependencies.getDocumentByIdForAccount({
    accountId: input.accountId,
    documentId: input.documentId,
  });

  if (!existingDocument || existingDocument.documentType !== "ogp_complaint") {
    throw new DocumentAccessDeniedError();
  }

  const character = await dependencies.getCharacterByIdForAccount({
    accountId: input.accountId,
    characterId: existingDocument.characterId,
  });

  if (!character || character.serverId !== existingDocument.serverId) {
    throw new DocumentCharacterUnavailableError();
  }

  const capturedAt = dependencies.now();
  const authorSnapshot = buildAuthorSnapshot({
    character,
    server: existingDocument.server,
    capturedAt,
  });
  const updateAuthorSnapshot =
    dependencies.updateDocumentAuthorSnapshotRecord ??
    updateDocumentAuthorSnapshotRecord;
  const refreshedDocument = await updateAuthorSnapshot({
    documentId: existingDocument.id,
    authorSnapshotJson: authorSnapshot,
    snapshotCapturedAt: capturedAt,
  });

  if (!refreshedDocument) {
    throw new DocumentAccessDeniedError();
  }

  return {
    document: refreshedDocument,
    authorSnapshot,
  };
}
