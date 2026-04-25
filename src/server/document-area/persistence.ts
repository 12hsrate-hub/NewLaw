import { ZodError } from "zod";

import {
  createDocumentRecord,
  getDocumentByIdForAccount,
  updateDocumentAuthorSnapshotRecord,
  updateDocumentDraftRecord,
} from "@/db/repositories/document.repository";
import { getCharacterByIdForAccount } from "@/db/repositories/character.repository";
import { getServerByCode } from "@/db/repositories/server.repository";
import { getTrustorByIdForAccount } from "@/db/repositories/trustor.repository";
import { ATTORNEY_REQUEST_FORM_SCHEMA_VERSION } from "@/features/documents/attorney-request/types";
import {
  LEGAL_SERVICES_AGREEMENT_FORM_SCHEMA_VERSION,
} from "@/features/documents/legal-services-agreement/types";
import {
  buildCharacterSignatureSnapshotFromActiveSignature,
} from "@/server/character-signatures/service";
import {
  normalizeIcEmail,
  normalizePassportNumber,
  normalizePhone,
  normalizeSafeUrl,
  readCharacterProfileData,
} from "@/lib/ogp/generation-contract";
import { getDocumentDefaultTitle } from "@/lib/documents/family-registry";
import { setActiveCharacterSelection, setActiveServerSelection } from "@/server/app-shell/selection";
import {
  DocumentAccessDeniedError,
  DocumentAttorneyRoleRequiredError,
  DocumentCharacterUnavailableError,
  DocumentRepresentativeAccessError,
  DocumentServerUnavailableError,
  DocumentValidationError,
} from "@/server/document-area/persistence-errors";
import {
  normalizeAttorneyRequestDraftPayload,
  normalizeClaimsDraftPayload,
  normalizeLegalServicesAgreementDraftPayload,
  normalizeOgpComplaintDraftPayload,
  readAttorneyRequestDraftPayload,
  readDocumentAuthorSnapshot,
  readLegalServicesAgreementDraftPayload,
} from "@/server/document-area/persistence-readers";
import {
  createClaimDraftActionInputSchema,
  createLegalServicesAgreementDraftActionInputSchema,
  createOgpComplaintDraftActionInputSchema,
  documentAuthorSnapshotSchema,
  documentTitleSchema,
  saveDocumentDraftActionInputSchema,
  type ClaimDocumentType,
  type ClaimsDraftPayload,
  type DocumentAuthorSnapshot,
  type OgpComplaintDraftPayload,
} from "@/schemas/document";

export {
  DocumentAccessDeniedError,
  DocumentAttorneyRoleRequiredError,
  DocumentCharacterUnavailableError,
  DocumentRepresentativeAccessError,
  DocumentServerUnavailableError,
  DocumentValidationError,
} from "@/server/document-area/persistence-errors";
export {
  isClaimsDocumentType,
  readAttorneyRequestDraftPayload,
  readClaimsDraftPayload,
  readDocumentAuthorSnapshot,
  readDocumentSignatureSnapshot,
  readLegalServicesAgreementDraftPayload,
  readOgpComplaintDraftPayload,
  safeReadAttorneyRequestDraftPayload,
  safeReadDocumentAuthorSnapshot,
  safeReadDocumentSignatureSnapshot,
  safeReadLegalServicesAgreementDraftPayload,
  type SafeDocumentReadResult,
} from "@/server/document-area/persistence-readers";

export const OGP_COMPLAINT_FORM_SCHEMA_VERSION = "ogp_complaint_mvp_editor_v1";
export const REHABILITATION_CLAIM_FORM_SCHEMA_VERSION = "rehabilitation_claim_mvp_editor_v1";
export const LAWSUIT_CLAIM_FORM_SCHEMA_VERSION = "lawsuit_claim_mvp_editor_v1";

type DocumentPersistenceDependencies = {
  getServerByCode: typeof getServerByCode;
  getCharacterByIdForAccount: typeof getCharacterByIdForAccount;
  getTrustorByIdForAccount?: typeof getTrustorByIdForAccount;
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
  getTrustorByIdForAccount,
  createDocumentRecord,
  getDocumentByIdForAccount,
  updateDocumentDraftRecord,
  updateDocumentAuthorSnapshotRecord,
  setActiveServerSelection,
  setActiveCharacterSelection,
  now: () => new Date(),
};

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

function canCreateAttorneyRequest(authorSnapshot: {
  roleKeys: string[];
}) {
  return authorSnapshot.roleKeys.includes("lawyer");
}
function buildDocumentTrustorSnapshot(input: {
  trustor: NonNullable<Awaited<ReturnType<typeof getTrustorByIdForAccount>>>;
}) {
  return {
    trustorId: input.trustor.id,
    fullName: input.trustor.fullName,
    passportNumber: normalizePassportNumber(input.trustor.passportNumber),
    phone: input.trustor.phone ? normalizePhone(input.trustor.phone) : null,
    icEmail: input.trustor.icEmail ? normalizeIcEmail(input.trustor.icEmail) : null,
    note: input.trustor.note,
  };
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

export function getDocumentTitleForType(
  documentType:
    | "ogp_complaint"
    | "rehabilitation"
    | "lawsuit"
    | "attorney_request"
    | "legal_services_agreement",
) {
  return getDocumentDefaultTitle(documentType);
}

function getDocumentFormSchemaVersion(
  documentType:
    | "ogp_complaint"
    | "rehabilitation"
    | "lawsuit"
    | "attorney_request"
    | "legal_services_agreement",
) {
  if (documentType === "ogp_complaint") {
    return OGP_COMPLAINT_FORM_SCHEMA_VERSION;
  }

  if (documentType === "rehabilitation") {
    return REHABILITATION_CLAIM_FORM_SCHEMA_VERSION;
  }

  if (documentType === "attorney_request") {
    return ATTORNEY_REQUEST_FORM_SCHEMA_VERSION;
  }

  if (documentType === "legal_services_agreement") {
    return LEGAL_SERVICES_AGREEMENT_FORM_SCHEMA_VERSION;
  }

  return LAWSUIT_CLAIM_FORM_SCHEMA_VERSION;
}

function normalizeDocumentTitle(input: {
  title: string;
  documentType:
    | "ogp_complaint"
    | "rehabilitation"
    | "lawsuit"
    | "attorney_request"
    | "legal_services_agreement";
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

export async function createInitialAttorneyRequestDraft(
  input: {
    accountId: string;
    serverSlug: string;
    characterId: string;
    trustorId: string;
    title: string;
    payload: unknown;
  },
  dependencies: DocumentPersistenceDependencies = defaultDependencies,
) {
  const server = await dependencies.getServerByCode(input.serverSlug);

  if (!server) {
    throw new DocumentServerUnavailableError();
  }

  const readTrustorById = dependencies.getTrustorByIdForAccount ?? getTrustorByIdForAccount;
  const [character, trustor] = await Promise.all([
    dependencies.getCharacterByIdForAccount({
      accountId: input.accountId,
      characterId: input.characterId,
    }),
    readTrustorById({
      accountId: input.accountId,
      trustorId: input.trustorId,
    }),
  ]);

  if (!character || character.serverId !== server.id) {
    throw new DocumentCharacterUnavailableError();
  }

  if (!trustor || trustor.serverId !== server.id) {
    throw new DocumentValidationError();
  }

  const capturedAt = dependencies.now();
  const authorSnapshot = buildAuthorSnapshot({
    character,
    server,
    capturedAt,
  });

  if (!canCreateAttorneyRequest(authorSnapshot)) {
    throw new DocumentAttorneyRoleRequiredError();
  }

  const trustorSnapshot = {
    trustorId: trustor.id,
    fullName: trustor.fullName,
    passportNumber: normalizePassportNumber(trustor.passportNumber),
    phone: trustor.phone ? normalizePhone(trustor.phone) : null,
    icEmail: trustor.icEmail ? normalizeIcEmail(trustor.icEmail) : null,
    passportImageUrl: trustor.passportImageUrl ? normalizeSafeUrl(trustor.passportImageUrl) : null,
    note: trustor.note,
  };
  const payload = normalizeAttorneyRequestDraftPayload({
    rawPayload: input.payload,
    authorSnapshot,
    trustorSnapshot,
    capturedAt,
  });
  const signatureSnapshot = buildCharacterSignatureSnapshotFromActiveSignature({
    activeSignature: character.activeSignature,
  });

  const createdDocument = await dependencies.createDocumentRecord({
    accountId: input.accountId,
    serverId: server.id,
    characterId: character.id,
    trustorId: trustor.id,
    documentType: "attorney_request",
    title: normalizeDocumentTitle({
      title: input.title,
      documentType: "attorney_request",
    }),
    formSchemaVersion: ATTORNEY_REQUEST_FORM_SCHEMA_VERSION,
    snapshotCapturedAt: capturedAt,
    authorSnapshotJson: authorSnapshot,
    signatureSnapshotJson: signatureSnapshot,
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

export async function createInitialLegalServicesAgreementDraft(
  input: {
    accountId: string;
    serverSlug: string;
    characterId: string;
    trustorId: string;
    title: string;
    payload: unknown;
  },
  dependencies: DocumentPersistenceDependencies = defaultDependencies,
) {
  const parsed = createLegalServicesAgreementDraftActionInputSchema.parse(input);
  const server = await dependencies.getServerByCode(parsed.serverSlug);

  if (!server) {
    throw new DocumentServerUnavailableError();
  }

  const readTrustorById = dependencies.getTrustorByIdForAccount ?? getTrustorByIdForAccount;
  const [character, trustor] = await Promise.all([
    dependencies.getCharacterByIdForAccount({
      accountId: input.accountId,
      characterId: parsed.characterId,
    }),
    readTrustorById({
      accountId: input.accountId,
      trustorId: parsed.trustorId,
    }),
  ]);

  if (!character || character.serverId !== server.id) {
    throw new DocumentCharacterUnavailableError();
  }

  if (!trustor || trustor.serverId !== server.id) {
    throw new DocumentValidationError();
  }

  const capturedAt = dependencies.now();
  const authorSnapshot = buildAuthorSnapshot({
    character,
    server,
    capturedAt,
  });
  const trustorSnapshot = buildDocumentTrustorSnapshot({
    trustor,
  });
  const payload = normalizeLegalServicesAgreementDraftPayload({
    rawPayload: parsed.payload,
    trustorSnapshot,
    capturedAt,
  });

  const createdDocument = await dependencies.createDocumentRecord({
    accountId: input.accountId,
    serverId: server.id,
    characterId: character.id,
    trustorId: trustor.id,
    documentType: "legal_services_agreement",
    title: normalizeDocumentTitle({
      title: parsed.title,
      documentType: "legal_services_agreement",
    }),
    formSchemaVersion: LEGAL_SERVICES_AGREEMENT_FORM_SCHEMA_VERSION,
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

    if (existingDocument.documentType === "attorney_request") {
      const authorSnapshot = readDocumentAuthorSnapshot(existingDocument.authorSnapshotJson);
      const currentPayload = readAttorneyRequestDraftPayload(existingDocument.formPayloadJson);
      const payload = normalizeAttorneyRequestDraftPayload({
        rawPayload: {
          ...(parsed.payload && typeof parsed.payload === "object" && !Array.isArray(parsed.payload)
            ? parsed.payload
            : {}),
          trustorSnapshot: currentPayload.trustorSnapshot,
          signerTitleSnapshot: currentPayload.signerTitleSnapshot,
          startedAtMsk: currentPayload.startedAtMsk,
          documentDateMsk: currentPayload.documentDateMsk,
          responseDueAtMsk: currentPayload.responseDueAtMsk,
        },
        authorSnapshot,
        trustorSnapshot: currentPayload.trustorSnapshot,
        frozenSignerTitleSnapshot: currentPayload.signerTitleSnapshot,
        frozenTemporalSnapshot: {
          startedAtMsk: currentPayload.startedAtMsk,
          documentDateMsk: currentPayload.documentDateMsk,
          responseDueAtMsk: currentPayload.responseDueAtMsk,
        },
        capturedAt: existingDocument.snapshotCapturedAt,
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

    if (existingDocument.documentType === "legal_services_agreement") {
      const currentPayload = readLegalServicesAgreementDraftPayload(existingDocument.formPayloadJson);
      const payload = normalizeLegalServicesAgreementDraftPayload({
        rawPayload: {
          ...currentPayload,
          ...(parsed.payload && typeof parsed.payload === "object" && !Array.isArray(parsed.payload)
            ? parsed.payload
            : {}),
          trustorSnapshot: currentPayload.trustorSnapshot,
          formSchemaVersion: currentPayload.formSchemaVersion,
          manualFields: {
            ...currentPayload.manualFields,
            ...(
              parsed.payload &&
              typeof parsed.payload === "object" &&
              !Array.isArray(parsed.payload) &&
              typeof (parsed.payload as Record<string, unknown>).manualFields === "object" &&
              (parsed.payload as Record<string, unknown>).manualFields !== null &&
              !Array.isArray((parsed.payload as Record<string, unknown>).manualFields)
                ? ((parsed.payload as Record<string, unknown>).manualFields as Record<
                    string,
                    unknown
                  >)
                : {}
            ),
          },
        },
        trustorSnapshot: currentPayload.trustorSnapshot,
        capturedAt: existingDocument.snapshotCapturedAt,
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
