import {
  type getDocumentByIdForAccount,
  listDocumentsByAccount,
  listDocumentsByAccountAndServerAndType,
} from "@/db/repositories/document.repository";
import {
  attorneyRequestRenderedArtifactSchema,
  type AttorneyRequestDraftPayload,
  type AttorneyRequestRenderedArtifact,
} from "@/features/documents/attorney-request/schemas";
import {
  legalServicesAgreementRenderedArtifactSchema,
  type LegalServicesAgreementDraftPayload,
  type LegalServicesAgreementRenderedArtifact,
} from "@/features/documents/legal-services-agreement/schemas";
import { readClaimsGeneratedArtifact } from "@/server/document-area/claims-rendering";
import {
  isClaimsDocumentType,
  readClaimsDraftPayload,
  readOgpComplaintDraftPayload,
  safeReadAttorneyRequestDraftPayload,
  safeReadDocumentAuthorSnapshot,
  safeReadLegalServicesAgreementDraftPayload,
} from "@/server/document-area/persistence";
import type {
  ClaimDocumentType,
  ClaimsDraftPayload,
  ClaimsRenderedOutput,
  OgpComplaintDraftPayload,
  OgpForumSyncState,
} from "@/schemas/document";

type AccountDocumentRecord = Awaited<ReturnType<typeof listDocumentsByAccount>>[number];
type ServerDocumentRecord = Awaited<ReturnType<typeof listDocumentsByAccountAndServerAndType>>[number];

const INVALID_DOCUMENT_WORKING_NOTES_PREVIEW = "Документ требует восстановления данных.";

export type DocumentAreaPersistedListItem = {
  id: string;
  title: string;
  documentType:
    | "ogp_complaint"
    | "rehabilitation"
    | "lawsuit"
    | "attorney_request"
    | "legal_services_agreement";
  status: "draft" | "generated" | "published";
  filingMode: "self" | "representative" | null;
  subtype: ClaimDocumentType | null;
  appealNumber: string | null;
  objectFullName: string | null;
  objectOrganization: string | null;
  requestNumber?: string | null;
  agreementNumber?: string | null;
  trustorName?: string | null;
  server: {
    id: string;
    code: string;
    name: string;
  };
  authorSnapshot: {
    fullName: string;
    passportNumber: string;
  };
  dataHealth: "ok" | "invalid_payload";
  workingNotesPreview: string;
  generatedAt: string | null;
  publicationUrl: string | null;
  isSiteForumSynced: boolean;
  forumSyncState: OgpForumSyncState | null;
  forumThreadId: string | null;
  forumPostId: string | null;
  forumLastPublishedAt: string | null;
  forumLastSyncError: string | null;
  isModifiedAfterGeneration: boolean;
  snapshotCapturedAt: string;
  updatedAt: string;
  createdAt: string;
};

function buildInvalidDocumentAuthorSnapshotSummary() {
  return {
    fullName: "Данные персонажа повреждены",
    passportNumber: "не указан",
  } satisfies DocumentAreaPersistedListItem["authorSnapshot"];
}

function buildInvalidPersistedDocumentListItem(
  document: AccountDocumentRecord | (ServerDocumentRecord & { server: AccountDocumentRecord["server"] }),
): DocumentAreaPersistedListItem {
  const subtype = isClaimsDocumentType(document.documentType) ? document.documentType : null;

  return {
    id: document.id,
    title: document.title,
    documentType: document.documentType,
    status: document.status,
    filingMode: null,
    subtype,
    appealNumber: null,
    objectFullName: null,
    objectOrganization: null,
    requestNumber: null,
    agreementNumber: null,
    trustorName: null,
    server: {
      id: document.server.id,
      code: document.server.code,
      name: document.server.name,
    },
    authorSnapshot: buildInvalidDocumentAuthorSnapshotSummary(),
    dataHealth: "invalid_payload",
    workingNotesPreview: INVALID_DOCUMENT_WORKING_NOTES_PREVIEW,
    generatedAt: document.generatedAt?.toISOString() ?? null,
    publicationUrl: document.publicationUrl,
    isSiteForumSynced: document.isSiteForumSynced,
    forumSyncState: document.documentType === "ogp_complaint" ? document.forumSyncState : null,
    forumThreadId: document.documentType === "ogp_complaint" ? document.forumThreadId : null,
    forumPostId: document.documentType === "ogp_complaint" ? document.forumPostId : null,
    forumLastPublishedAt:
      document.documentType === "ogp_complaint"
        ? document.forumLastPublishedAt?.toISOString() ?? null
        : null,
    forumLastSyncError: document.documentType === "ogp_complaint" ? document.forumLastSyncError : null,
    isModifiedAfterGeneration: document.isModifiedAfterGeneration,
    snapshotCapturedAt: document.snapshotCapturedAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
    createdAt: document.createdAt.toISOString(),
  };
}

export function buildReadPathErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return String(error);
}

function logDocumentListItemParseFailure(input: {
  document: AccountDocumentRecord | (ServerDocumentRecord & { server: AccountDocumentRecord["server"] });
  message: string;
}) {
  console.error("DOCUMENT_LIST_ITEM_PARSE_FAILED", {
    documentId: input.document.id,
    documentType: input.document.documentType,
    accountId: input.document.accountId,
    serverId: input.document.serverId,
    message: input.message,
  });
}

export function logDocumentEditorContextParseFailure(input: {
  accountId: string;
  document: Pick<
    NonNullable<Awaited<ReturnType<typeof getDocumentByIdForAccount>>>,
    "id" | "documentType" | "serverId"
  >;
  message: string;
}) {
  console.error("DOCUMENT_EDITOR_CONTEXT_PARSE_FAILED", {
    documentId: input.document.id,
    documentType: input.document.documentType,
    accountId: input.accountId,
    serverId: input.document.serverId,
    message: input.message,
  });
}

export function buildPersistedDocumentListItem(
  document: AccountDocumentRecord | (ServerDocumentRecord & { server: AccountDocumentRecord["server"] }),
) {
  try {
    const authorSnapshot = safeReadDocumentAuthorSnapshot(document.authorSnapshotJson);
    const subtype = isClaimsDocumentType(document.documentType) ? document.documentType : null;

    if (!authorSnapshot.ok) {
      logDocumentListItemParseFailure({
        document,
        message: authorSnapshot.message,
      });

      return buildInvalidPersistedDocumentListItem(document);
    }

    if (document.documentType === "attorney_request") {
      const payload = safeReadAttorneyRequestDraftPayload(document.formPayloadJson);

      if (!payload.ok) {
        logDocumentListItemParseFailure({
          document,
          message: payload.message,
        });

        return buildInvalidPersistedDocumentListItem(document);
      }

      return {
        id: document.id,
        title: document.title,
        documentType: document.documentType,
        status: document.status,
        filingMode: null,
        subtype,
        appealNumber: null,
        objectFullName: null,
        objectOrganization: null,
        requestNumber: payload.data.requestNumberNormalized,
        trustorName: payload.data.trustorSnapshot.fullName,
        server: {
          id: document.server.id,
          code: document.server.code,
          name: document.server.name,
        },
        authorSnapshot: {
          fullName: authorSnapshot.data.fullName,
          passportNumber: authorSnapshot.data.passportNumber,
        },
        dataHealth: "ok",
        workingNotesPreview: payload.data.workingNotes.slice(0, 240),
        generatedAt: document.generatedAt?.toISOString() ?? null,
        publicationUrl: document.publicationUrl,
        isSiteForumSynced: document.isSiteForumSynced,
        forumSyncState: null,
        forumThreadId: null,
        forumPostId: null,
        forumLastPublishedAt: null,
        forumLastSyncError: null,
        isModifiedAfterGeneration: document.isModifiedAfterGeneration,
        snapshotCapturedAt: document.snapshotCapturedAt.toISOString(),
        updatedAt: document.updatedAt.toISOString(),
        createdAt: document.createdAt.toISOString(),
      } satisfies DocumentAreaPersistedListItem;
    }

    if (document.documentType === "legal_services_agreement") {
      const payload = safeReadLegalServicesAgreementDraftPayload(document.formPayloadJson);

      if (!payload.ok) {
        logDocumentListItemParseFailure({
          document,
          message: payload.message,
        });

        return buildInvalidPersistedDocumentListItem(document);
      }

      return {
        id: document.id,
        title: document.title,
        documentType: document.documentType,
        status: document.status,
        filingMode: null,
        subtype,
        appealNumber: null,
        objectFullName: null,
        objectOrganization: null,
        agreementNumber: payload.data.manualFields.agreementNumber,
        trustorName: payload.data.trustorSnapshot.fullName,
        server: {
          id: document.server.id,
          code: document.server.code,
          name: document.server.name,
        },
        authorSnapshot: {
          fullName: authorSnapshot.data.fullName,
          passportNumber: authorSnapshot.data.passportNumber,
        },
        dataHealth: "ok",
        workingNotesPreview: payload.data.workingNotes.slice(0, 240),
        generatedAt: document.generatedAt?.toISOString() ?? null,
        publicationUrl: document.publicationUrl,
        isSiteForumSynced: document.isSiteForumSynced,
        forumSyncState: null,
        forumThreadId: null,
        forumPostId: null,
        forumLastPublishedAt: null,
        forumLastSyncError: null,
        isModifiedAfterGeneration: document.isModifiedAfterGeneration,
        snapshotCapturedAt: document.snapshotCapturedAt.toISOString(),
        updatedAt: document.updatedAt.toISOString(),
        createdAt: document.createdAt.toISOString(),
      } satisfies DocumentAreaPersistedListItem;
    }

    if (document.documentType !== "ogp_complaint") {
      const payload = readClaimsDraftPayload(document.documentType, document.formPayloadJson);

      return {
        id: document.id,
        title: document.title,
        documentType: document.documentType,
        status: document.status,
        filingMode: payload.filingMode,
        subtype,
        appealNumber: null,
        objectFullName: null,
        objectOrganization: null,
        requestNumber: null,
        trustorName: payload.trustorSnapshot?.fullName ?? null,
        server: {
          id: document.server.id,
          code: document.server.code,
          name: document.server.name,
        },
        authorSnapshot: {
          fullName: authorSnapshot.data.fullName,
          passportNumber: authorSnapshot.data.passportNumber,
        },
        dataHealth: "ok",
        workingNotesPreview: payload.workingNotes.slice(0, 240),
        generatedAt: document.generatedAt?.toISOString() ?? null,
        publicationUrl: document.publicationUrl,
        isSiteForumSynced: document.isSiteForumSynced,
        forumSyncState: null,
        forumThreadId: null,
        forumPostId: null,
        forumLastPublishedAt: null,
        forumLastSyncError: null,
        isModifiedAfterGeneration: document.isModifiedAfterGeneration,
        snapshotCapturedAt: document.snapshotCapturedAt.toISOString(),
        updatedAt: document.updatedAt.toISOString(),
        createdAt: document.createdAt.toISOString(),
      } satisfies DocumentAreaPersistedListItem;
    }

    const payload = readOgpComplaintDraftPayload(document.formPayloadJson);

    return {
      id: document.id,
      title: document.title,
      documentType: document.documentType,
      status: document.status,
      filingMode: payload.filingMode,
      subtype,
      appealNumber: payload.appealNumber,
      objectFullName: payload.objectFullName,
      objectOrganization: payload.objectOrganization,
      requestNumber: null,
      trustorName: payload.trustorSnapshot?.fullName ?? null,
      server: {
        id: document.server.id,
        code: document.server.code,
        name: document.server.name,
      },
      authorSnapshot: {
        fullName: authorSnapshot.data.fullName,
        passportNumber: authorSnapshot.data.passportNumber,
      },
      dataHealth: "ok",
      workingNotesPreview: payload.workingNotes.slice(0, 240),
      generatedAt: document.generatedAt?.toISOString() ?? null,
      publicationUrl: document.publicationUrl,
      isSiteForumSynced: document.isSiteForumSynced,
      forumSyncState: document.forumSyncState,
      forumThreadId: document.forumThreadId,
      forumPostId: document.forumPostId,
      forumLastPublishedAt: document.forumLastPublishedAt?.toISOString() ?? null,
      forumLastSyncError: document.forumLastSyncError,
      isModifiedAfterGeneration: document.isModifiedAfterGeneration,
      snapshotCapturedAt: document.snapshotCapturedAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
      createdAt: document.createdAt.toISOString(),
    } satisfies DocumentAreaPersistedListItem;
  } catch (error) {
    logDocumentListItemParseFailure({
      document,
      message: buildReadPathErrorMessage(error),
    });

    return buildInvalidPersistedDocumentListItem(document);
  }
}

export function readAttorneyRequestGeneratedArtifact(value: unknown) {
  const parsed = attorneyRequestRenderedArtifactSchema.safeParse(value);

  return parsed.success ? parsed.data : null;
}

export function readLegalServicesAgreementGeneratedArtifact(value: unknown) {
  const parsed = legalServicesAgreementRenderedArtifactSchema.safeParse(value);

  return parsed.success ? parsed.data : null;
}

export function readClaimsGeneratedArtifactSafe(value: unknown): ClaimsRenderedOutput | null {
  return readClaimsGeneratedArtifact(value);
}

export type PersistedDraftPayload =
  | OgpComplaintDraftPayload
  | ClaimsDraftPayload
  | AttorneyRequestDraftPayload
  | LegalServicesAgreementDraftPayload;

export type PersistedGeneratedArtifact =
  | ClaimsRenderedOutput
  | AttorneyRequestRenderedArtifact
  | LegalServicesAgreementRenderedArtifact;
