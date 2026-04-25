import { getCharactersByServer, listCharactersForAccount } from "@/db/repositories/character.repository";
import { listTrustorsForAccountAndServer } from "@/db/repositories/trustor.repository";
import {
  getDocumentByIdForAccount,
  listDocumentCountsByAccountAndServerGrouped,
  listDocumentCountsByAccountGrouped,
  listDocumentsByAccount,
  listDocumentsByAccountAndServerAndType,
} from "@/db/repositories/document.repository";
import { getServerByCode, getServers } from "@/db/repositories/server.repository";
import { getUserServerStates } from "@/db/repositories/user-server-state.repository";
import { requireProtectedAccountContext } from "@/server/auth/protected";
import { resolveActiveCharacterId } from "@/server/app-shell/state";
import { getAccountForumConnectionSummary } from "@/server/forum-integration/service";
import {
  safeReadDocumentAuthorSnapshot,
  readClaimsDraftPayload,
  isClaimsDocumentType,
  readOgpComplaintDraftPayload,
  safeReadAttorneyRequestDraftPayload,
  safeReadDocumentSignatureSnapshot,
  safeReadLegalServicesAgreementDraftPayload,
} from "@/server/document-area/persistence";
import { readClaimsGeneratedArtifact } from "@/server/document-area/claims-rendering";
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
import { isOgpTrustorRepresentativeReady } from "@/lib/ogp/generation-contract";
import { buildAccountCharactersBridgeHref } from "@/lib/routes/account-characters";
import type { TrustorRegistryPrefillOption } from "@/lib/trustors/registry-prefill";
import type {
  ClaimDocumentType,
  ClaimsDraftPayload,
  DocumentSignatureSnapshot,
  ClaimsRenderedOutput,
  OgpForumSyncState,
  OgpComplaintDraftPayload,
} from "@/schemas/document";
import type { ForumConnectionSummary } from "@/schemas/forum-integration";

type AccountDocumentRecord = Awaited<ReturnType<typeof listDocumentsByAccount>>[number];
type ServerDocumentRecord = Awaited<ReturnType<typeof listDocumentsByAccountAndServerAndType>>[number];
type GroupedAccountDocumentCountRow = Awaited<
  ReturnType<typeof listDocumentCountsByAccountGrouped>
>[number];
type GroupedServerDocumentCountRow = Awaited<
  ReturnType<typeof listDocumentCountsByAccountAndServerGrouped>
>[number];
type AccountCharacterRecord = Awaited<ReturnType<typeof listCharactersForAccount>>[number];

function buildReadPathErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return String(error);
}

export type DocumentAreaServerSummary = {
  id: string;
  code: string;
  name: string;
  characterCount: number;
  selectedCharacterId: string | null;
  selectedCharacterName: string | null;
  selectedCharacterSource: "last_used" | "first_available" | "none";
  ogpComplaintDocumentCount: number;
  claimsDocumentCount: number;
  attorneyRequestDocumentCount?: number;
  legalServicesAgreementDocumentCount?: number;
};

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

type AccountDocumentsOverviewContext = {
  account: {
    id: string;
    email: string;
    login: string;
    isSuperAdmin: boolean;
    mustChangePassword: boolean;
  };
  servers: DocumentAreaServerSummary[];
  documents: DocumentAreaPersistedListItem[];
};

type SelectableCharacterSummary = {
  id: string;
  fullName: string;
  passportNumber: string;
  isProfileComplete: boolean;
  canUseRepresentative: boolean;
  canCreateAttorneyRequest?: boolean;
  hasActiveSignature?: boolean;
};

type SelectedCharacterSummary = SelectableCharacterSummary & {
  source: "last_used" | "first_available";
};

export type DocumentTrustorRegistrySummary = TrustorRegistryPrefillOption;

type CharacterSummaryInput = {
  id: string;
  serverId: string;
  fullName: string;
  passportNumber: string;
  isProfileComplete: boolean;
  activeSignature?:
    | {
        id: string;
        storagePath: string;
      }
    | null;
  accessFlags: Array<{
    flagKey: string;
  }>;
  roles: Array<{
    roleKey: string;
  }>;
};

type ReadyServerDocumentsRouteContext = {
  status: "ready";
  account: AccountDocumentsOverviewContext["account"];
  server: {
    id: string;
    code: string;
    name: string;
  };
  servers: DocumentAreaServerSummary[];
  characters: SelectableCharacterSummary[];
  selectedCharacter: SelectedCharacterSummary;
  trustorRegistry: DocumentTrustorRegistrySummary[];
  ogpComplaintDocumentCount: number;
  claimsDocumentCount: number;
  attorneyRequestDocumentCount?: number;
  legalServicesAgreementDocumentCount?: number;
};

type NoCharactersServerDocumentsRouteContext = {
  status: "no_characters";
  account: AccountDocumentsOverviewContext["account"];
  server: {
    id: string;
    code: string;
    name: string;
  };
  servers: DocumentAreaServerSummary[];
  ogpComplaintDocumentCount: number;
  claimsDocumentCount: number;
  attorneyRequestDocumentCount?: number;
  legalServicesAgreementDocumentCount?: number;
};

type ServerNotFoundDocumentsRouteContext = {
  status: "server_not_found";
  account: AccountDocumentsOverviewContext["account"];
  requestedServerSlug: string;
  servers: DocumentAreaServerSummary[];
};

export type ServerDocumentsRouteContext =
  | ReadyServerDocumentsRouteContext
  | NoCharactersServerDocumentsRouteContext
  | ServerNotFoundDocumentsRouteContext;

type OgpComplaintFamilyRouteContext =
  | {
      status: "server_not_found";
      account: AccountDocumentsOverviewContext["account"];
      requestedServerSlug: string;
      servers: DocumentAreaServerSummary[];
    }
  | {
      status: "ready";
      account: AccountDocumentsOverviewContext["account"];
      server: {
        id: string;
        code: string;
        name: string;
      };
      servers: DocumentAreaServerSummary[];
      canCreateDocuments: boolean;
      selectedCharacter: SelectedCharacterSummary | null;
      documents: DocumentAreaPersistedListItem[];
    };

type ClaimsFamilyRouteContext =
  | {
      status: "server_not_found";
      account: AccountDocumentsOverviewContext["account"];
      requestedServerSlug: string;
      servers: DocumentAreaServerSummary[];
    }
  | {
      status: "ready";
      account: AccountDocumentsOverviewContext["account"];
      server: {
        id: string;
        code: string;
        name: string;
      };
      servers: DocumentAreaServerSummary[];
      canCreateDocuments: boolean;
      selectedCharacter: SelectedCharacterSummary | null;
      documents: DocumentAreaPersistedListItem[];
    };

type AttorneyRequestFamilyRouteContext =
  | {
      status: "server_not_found";
      account: AccountDocumentsOverviewContext["account"];
      requestedServerSlug: string;
      servers: DocumentAreaServerSummary[];
    }
  | {
      status: "ready";
      account: AccountDocumentsOverviewContext["account"];
      server: {
        id: string;
        code: string;
        name: string;
      };
      servers: DocumentAreaServerSummary[];
      canCreateDocuments: boolean;
      selectedCharacter: SelectedCharacterSummary | null;
      trustorRegistry: DocumentTrustorRegistrySummary[];
      documents: DocumentAreaPersistedListItem[];
    };

type LegalServicesAgreementFamilyRouteContext =
  | {
      status: "server_not_found";
      account: AccountDocumentsOverviewContext["account"];
      requestedServerSlug: string;
      servers: DocumentAreaServerSummary[];
    }
  | {
      status: "ready";
      account: AccountDocumentsOverviewContext["account"];
      server: {
        id: string;
        code: string;
        name: string;
      };
      servers: DocumentAreaServerSummary[];
      canCreateDocuments: boolean;
      selectedCharacter: SelectedCharacterSummary | null;
      trustorRegistry: DocumentTrustorRegistrySummary[];
      documents: DocumentAreaPersistedListItem[];
    };

type InvalidDocumentDataEditorRouteContext = {
  status: "invalid_document_data";
  account: AccountDocumentsOverviewContext["account"];
  server: {
    id: string;
    code: string;
    name: string;
  };
  servers: DocumentAreaServerSummary[];
  document: {
    id: string;
    title: string;
    status: "draft" | "generated" | "published";
    createdAt: string;
    updatedAt: string;
    snapshotCapturedAt: string;
    dataHealth: "invalid_payload";
  };
};

type AttorneyRequestEditorRouteContext =
  | {
      status: "server_not_found";
      account: AccountDocumentsOverviewContext["account"];
      requestedServerSlug: string;
      servers: DocumentAreaServerSummary[];
    }
  | {
      status: "document_not_found";
      account: AccountDocumentsOverviewContext["account"];
      server: {
        id: string;
        code: string;
        name: string;
      };
      servers: DocumentAreaServerSummary[];
      documentId: string;
    }
  | InvalidDocumentDataEditorRouteContext
  | {
      status: "ready";
      account: AccountDocumentsOverviewContext["account"];
      server: {
        id: string;
        code: string;
        name: string;
      };
      servers: DocumentAreaServerSummary[];
      document: {
        id: string;
        title: string;
        status: "draft" | "generated" | "published";
        createdAt: string;
        updatedAt: string;
        snapshotCapturedAt: string;
        formSchemaVersion: string;
        generatedAt: string | null;
        generatedFormSchemaVersion: string | null;
        generatedOutputFormat: string | null;
        generatedRendererVersion: string | null;
        generatedArtifact: AttorneyRequestRenderedArtifact | null;
        isModifiedAfterGeneration: boolean;
        server: {
          code: string;
          name: string;
        };
        authorSnapshot: {
          fullName: string;
          passportNumber: string;
          position?: string;
          address?: string;
          phone?: string;
          icEmail?: string;
          passportImageUrl?: string;
          nickname: string;
          roleKeys: string[];
          accessFlags: string[];
          isProfileComplete: boolean;
        };
        signatureSnapshot: DocumentSignatureSnapshot | null;
        hasActiveCharacterSignature: boolean;
        payload: AttorneyRequestDraftPayload;
      };
    };

type LegalServicesAgreementEditorRouteContext =
  | {
      status: "server_not_found";
      account: AccountDocumentsOverviewContext["account"];
      requestedServerSlug: string;
      servers: DocumentAreaServerSummary[];
    }
  | {
      status: "document_not_found";
      account: AccountDocumentsOverviewContext["account"];
      server: {
        id: string;
        code: string;
        name: string;
      };
      servers: DocumentAreaServerSummary[];
      documentId: string;
    }
  | InvalidDocumentDataEditorRouteContext
  | {
      status: "ready";
      account: AccountDocumentsOverviewContext["account"];
      server: {
        id: string;
        code: string;
        name: string;
      };
      servers: DocumentAreaServerSummary[];
      document: {
        id: string;
        title: string;
        status: "draft" | "generated" | "published";
        createdAt: string;
        updatedAt: string;
        snapshotCapturedAt: string;
        formSchemaVersion: string;
        generatedAt: string | null;
        generatedFormSchemaVersion: string | null;
        generatedOutputFormat: string | null;
        generatedRendererVersion: string | null;
        generatedArtifact: LegalServicesAgreementRenderedArtifact | null;
        isModifiedAfterGeneration: boolean;
        server: {
          code: string;
          name: string;
        };
        authorSnapshot: {
          fullName: string;
          passportNumber: string;
          position?: string;
          address?: string;
          phone?: string;
          icEmail?: string;
          passportImageUrl?: string;
          nickname: string;
          roleKeys: string[];
          accessFlags: string[];
          isProfileComplete: boolean;
        };
        payload: LegalServicesAgreementDraftPayload;
      };
    };

type ClaimsEditorRouteContext =
  | {
      status: "server_not_found";
      account: AccountDocumentsOverviewContext["account"];
      requestedServerSlug: string;
      servers: DocumentAreaServerSummary[];
    }
  | {
      status: "document_not_found";
      account: AccountDocumentsOverviewContext["account"];
      server: {
        id: string;
        code: string;
        name: string;
      };
      servers: DocumentAreaServerSummary[];
      documentId: string;
    }
  | InvalidDocumentDataEditorRouteContext
  | {
      status: "ready";
      account: AccountDocumentsOverviewContext["account"];
      server: {
        id: string;
        code: string;
        name: string;
      };
      servers: DocumentAreaServerSummary[];
      document: {
        id: string;
        title: string;
        documentType: ClaimDocumentType;
        status: "draft" | "generated" | "published";
        createdAt: string;
        updatedAt: string;
        snapshotCapturedAt: string;
        formSchemaVersion: string;
        generatedAt: string | null;
        generatedFormSchemaVersion: string | null;
        generatedOutputFormat: string | null;
        generatedRendererVersion: string | null;
        generatedArtifact: ClaimsRenderedOutput | null;
        isModifiedAfterGeneration: boolean;
        server: {
          code: string;
          name: string;
        };
        authorSnapshot: {
          fullName: string;
          passportNumber: string;
          position?: string;
          address?: string;
          phone?: string;
          icEmail?: string;
          passportImageUrl?: string;
          nickname: string;
          roleKeys: string[];
          accessFlags: string[];
          isProfileComplete: boolean;
        };
        trustorRegistry: DocumentTrustorRegistrySummary[];
        payload: ClaimsDraftPayload;
      };
    };

type OgpComplaintEditorRouteContext =
  | {
      status: "server_not_found";
      account: AccountDocumentsOverviewContext["account"];
      requestedServerSlug: string;
      servers: DocumentAreaServerSummary[];
    }
  | {
      status: "document_not_found";
      account: AccountDocumentsOverviewContext["account"];
      server: {
        id: string;
        code: string;
        name: string;
      };
      servers: DocumentAreaServerSummary[];
      documentId: string;
    }
  | InvalidDocumentDataEditorRouteContext
  | {
      status: "ready";
      account: AccountDocumentsOverviewContext["account"];
      server: {
        id: string;
        code: string;
        name: string;
      };
      servers: DocumentAreaServerSummary[];
      document: {
        id: string;
        title: string;
        status: "draft" | "generated" | "published";
        createdAt: string;
        updatedAt: string;
        snapshotCapturedAt: string;
        formSchemaVersion: string;
        lastGeneratedBbcode: string | null;
        generatedAt: string | null;
        generatedLawVersion: string | null;
        generatedTemplateVersion: string | null;
        generatedFormSchemaVersion: string | null;
        publicationUrl: string | null;
        isSiteForumSynced: boolean;
        forumSyncState: OgpForumSyncState;
        forumThreadId: string | null;
        forumPostId: string | null;
        forumPublishedBbcodeHash: string | null;
        forumLastPublishedAt: string | null;
        forumLastSyncError: string | null;
        isModifiedAfterGeneration: boolean;
        forumConnection: ForumConnectionSummary;
        server: {
          code: string;
          name: string;
        };
        authorSnapshot: {
          fullName: string;
          passportNumber: string;
          position?: string;
          address?: string;
          phone?: string;
          icEmail?: string;
          passportImageUrl?: string;
          nickname: string;
          roleKeys: string[];
          accessFlags: string[];
          isProfileComplete: boolean;
        };
        trustorRegistry: DocumentTrustorRegistrySummary[];
        payload: OgpComplaintDraftPayload;
      };
    };

function buildSelectableCharacterSummary(character: CharacterSummaryInput) {
  return {
    id: character.id,
    fullName: character.fullName,
    passportNumber: character.passportNumber,
    isProfileComplete: character.isProfileComplete,
    canUseRepresentative: character.accessFlags.some((flag) => flag.flagKey === "advocate"),
    canCreateAttorneyRequest: character.roles.some((role) => role.roleKey === "lawyer"),
    hasActiveSignature: Boolean(character.activeSignature),
  } satisfies SelectableCharacterSummary;
}

function buildSelectedCharacterSummary(input: {
  serverId: string;
  characters: Array<{
    id: string;
    serverId: string;
    fullName: string;
    passportNumber: string;
    isProfileComplete: boolean;
    activeSignature?:
      | {
          id: string;
          storagePath: string;
        }
      | null;
    accessFlags: Array<{
      flagKey: string;
    }>;
    roles: Array<{
      roleKey: string;
    }>;
  }>;
  serverStates: Array<{
    serverId: string;
    activeCharacterId: string | null;
    lastSelectedAt: Date | null;
  }>;
}) {
  const activeCharacterId = resolveActiveCharacterId(
    input.serverId,
    input.characters,
    input.serverStates,
  );
  const activeCharacter = activeCharacterId
    ? input.characters.find((character) => character.id === activeCharacterId) ?? null
    : null;

  if (activeCharacter) {
    return {
      ...buildSelectableCharacterSummary(activeCharacter),
      source: "last_used" as const,
    };
  }

  const firstCharacter = input.characters[0] ?? null;

  if (!firstCharacter) {
    return null;
  }

  return {
    ...buildSelectableCharacterSummary(firstCharacter),
    source: "first_available" as const,
  };
}

function buildDocumentTrustorRegistrySummary(
  trustors: Awaited<ReturnType<typeof listTrustorsForAccountAndServer>>,
) {
  return trustors.map((trustor) => ({
    id: trustor.id,
    fullName: trustor.fullName,
    passportNumber: trustor.passportNumber,
    phone: trustor.phone,
    icEmail: trustor.icEmail,
    passportImageUrl: trustor.passportImageUrl,
    note: trustor.note,
    isRepresentativeReady: isOgpTrustorRepresentativeReady({
      fullName: trustor.fullName,
      passportNumber: trustor.passportNumber,
      phone: trustor.phone,
      icEmail: trustor.icEmail,
      passportImageUrl: trustor.passportImageUrl,
    }),
  })) satisfies DocumentTrustorRegistrySummary[];
}

const INVALID_DOCUMENT_WORKING_NOTES_PREVIEW = "Документ требует восстановления данных.";

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

function logDocumentEditorContextParseFailure(input: {
  accountId: string;
  document: NonNullable<Awaited<ReturnType<typeof getDocumentByIdForAccount>>>;
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

function buildInvalidDocumentDataEditorRouteContext(input: {
  account: AccountDocumentsOverviewContext["account"];
  server: {
    id: string;
    code: string;
    name: string;
  };
  servers: DocumentAreaServerSummary[];
  document: NonNullable<Awaited<ReturnType<typeof getDocumentByIdForAccount>>>;
}): InvalidDocumentDataEditorRouteContext {
  return {
    status: "invalid_document_data",
    account: input.account,
    server: input.server,
    servers: input.servers,
    document: {
      id: input.document.id,
      title: input.document.title,
      status: input.document.status,
      createdAt: input.document.createdAt.toISOString(),
      updatedAt: input.document.updatedAt.toISOString(),
      snapshotCapturedAt: input.document.snapshotCapturedAt.toISOString(),
      dataHealth: "invalid_payload",
    },
  };
}

function buildPersistedDocumentListItem(
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

function buildDocumentTypeCountMapFromDocuments(
  documents: ReadonlyArray<
    AccountDocumentRecord | (ServerDocumentRecord & { server: AccountDocumentRecord["server"] })
  >,
) {
  const map = new Map<string, number>();

  for (const document of documents) {
    const key = `${document.serverId}:${document.documentType}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  return map;
}

function buildDocumentAreaServerSummariesFromLoadedData(input: {
  servers: Awaited<ReturnType<typeof getServers>>;
  serverStates: Awaited<ReturnType<typeof getUserServerStates>>;
  characters: AccountCharacterRecord[];
  countMap: Map<string, number>;
}) {
  return input.servers.map((server) => {
    const serverCharacters = input.characters.filter((character) => character.serverId === server.id);
    const ogpComplaintDocumentCount = readDocumentTypeCount(
      input.countMap,
      server.id,
      "ogp_complaint",
    );
    const rehabilitationDocumentCount = readDocumentTypeCount(
      input.countMap,
      server.id,
      "rehabilitation",
    );
    const lawsuitDocumentCount = readDocumentTypeCount(input.countMap, server.id, "lawsuit");
    const attorneyRequestDocumentCount = readDocumentTypeCount(
      input.countMap,
      server.id,
      "attorney_request",
    );
    const legalServicesAgreementDocumentCount = readDocumentTypeCount(
      input.countMap,
      server.id,
      "legal_services_agreement",
    );
    const selectedCharacter = buildSelectedCharacterSummary({
      serverId: server.id,
      characters: serverCharacters,
      serverStates: input.serverStates,
    });

    return {
      id: server.id,
      code: server.code,
      name: server.name,
      characterCount: serverCharacters.length,
      selectedCharacterId: selectedCharacter?.id ?? null,
      selectedCharacterName: selectedCharacter?.fullName ?? null,
      selectedCharacterSource: selectedCharacter?.source ?? "none",
      ogpComplaintDocumentCount,
      claimsDocumentCount: rehabilitationDocumentCount + lawsuitDocumentCount,
      attorneyRequestDocumentCount,
      legalServicesAgreementDocumentCount,
    } satisfies DocumentAreaServerSummary;
  });
}

async function buildDocumentAreaServerSummaries(accountId: string) {
  const [servers, serverStates, groupedCounts, characters] = await Promise.all([
    getServers(),
    getUserServerStates(accountId),
    listDocumentCountsByAccountGrouped(accountId),
    listCharactersForAccount(accountId),
  ]);

  const countMap = buildDocumentTypeCountMap(groupedCounts);

  return buildDocumentAreaServerSummariesFromLoadedData({
    servers,
    serverStates,
    characters,
    countMap,
  });
}

function buildDocumentTypeCountMap(
  rows: ReadonlyArray<GroupedAccountDocumentCountRow | GroupedServerDocumentCountRow>,
) {
  const map = new Map<string, number>();

  for (const row of rows) {
    const serverId = "serverId" in row ? row.serverId : "__single_server__";
    map.set(`${serverId}:${row.documentType}`, row._count._all);
  }

  return map;
}

function readDocumentTypeCount(
  map: Map<string, number>,
  serverId: string,
  documentType: DocumentAreaPersistedListItem["documentType"],
) {
  return map.get(`${serverId}:${documentType}`) ?? 0;
}

export async function getAccountDocumentsOverviewContext(
  nextPath = "/account/documents",
): Promise<AccountDocumentsOverviewContext> {
  const { account } = await requireProtectedAccountContext(nextPath, undefined, {
    allowMustChangePassword: true,
  });
  let servers: Awaited<ReturnType<typeof getServers>>;
  let serverStates: Awaited<ReturnType<typeof getUserServerStates>>;
  let characters: Awaited<ReturnType<typeof listCharactersForAccount>>;
  let documents: Awaited<ReturnType<typeof listDocumentsByAccount>>;

  try {
    [servers, serverStates, characters, documents] = await Promise.all([
      getServers(),
      getUserServerStates(account.id),
      listCharactersForAccount(account.id),
      listDocumentsByAccount(account.id),
    ]);
  } catch (error) {
    console.error("ACCOUNT_DOCUMENTS_REQUIRED_DATA_LOAD_FAILED", {
      accountId: account.id,
      message: buildReadPathErrorMessage(error),
    });
    throw error;
  }
  const countMap = buildDocumentTypeCountMapFromDocuments(documents);

  return {
    account,
    servers: buildDocumentAreaServerSummariesFromLoadedData({
      servers,
      serverStates,
      characters,
      countMap,
    }),
    documents: documents.map((document) => buildPersistedDocumentListItem(document)),
  };
}

export async function getServerDocumentsRouteContext(input: {
  serverSlug: string;
  nextPath: string;
}): Promise<ServerDocumentsRouteContext> {
  const { account } = await requireProtectedAccountContext(input.nextPath, undefined, {
    allowMustChangePassword: true,
  });
  const [server, servers, serverStates] = await Promise.all([
    getServerByCode(input.serverSlug),
    buildDocumentAreaServerSummaries(account.id),
    getUserServerStates(account.id),
  ]);

  if (!server) {
    return {
      status: "server_not_found",
      account,
      requestedServerSlug: input.serverSlug,
      servers,
    };
  }

  const [characters, trustorRegistryRecords, groupedCounts] = await Promise.all([
    getCharactersByServer({
      accountId: account.id,
      serverId: server.id,
    }),
    listTrustorsForAccountAndServer({
      accountId: account.id,
      serverId: server.id,
    }),
    listDocumentCountsByAccountAndServerGrouped({
      accountId: account.id,
      serverId: server.id,
    }),
  ]);
  const groupedCountMap = buildDocumentTypeCountMap(groupedCounts);
  const ogpComplaintDocumentCount = readDocumentTypeCount(
    groupedCountMap,
    "__single_server__",
    "ogp_complaint",
  );
  const rehabilitationDocumentCount = readDocumentTypeCount(
    groupedCountMap,
    "__single_server__",
    "rehabilitation",
  );
  const lawsuitDocumentCount = readDocumentTypeCount(
    groupedCountMap,
    "__single_server__",
    "lawsuit",
  );
  const attorneyRequestDocumentCount = readDocumentTypeCount(
    groupedCountMap,
    "__single_server__",
    "attorney_request",
  );
  const legalServicesAgreementDocumentCount = readDocumentTypeCount(
    groupedCountMap,
    "__single_server__",
    "legal_services_agreement",
  );
  const selectedCharacter = buildSelectedCharacterSummary({
    serverId: server.id,
    characters,
    serverStates,
  });
  const trustorRegistry = buildDocumentTrustorRegistrySummary(trustorRegistryRecords);

  if (!selectedCharacter) {
    return {
      status: "no_characters",
      account,
      server: {
        id: server.id,
        code: server.code,
        name: server.name,
      },
      servers,
      ogpComplaintDocumentCount,
      claimsDocumentCount: rehabilitationDocumentCount + lawsuitDocumentCount,
      attorneyRequestDocumentCount,
      legalServicesAgreementDocumentCount,
    };
  }

  return {
    status: "ready",
    account,
    server: {
      id: server.id,
      code: server.code,
      name: server.name,
    },
    servers,
    characters: characters.map((character) => buildSelectableCharacterSummary(character)),
    selectedCharacter,
    trustorRegistry,
    ogpComplaintDocumentCount,
    claimsDocumentCount: rehabilitationDocumentCount + lawsuitDocumentCount,
    attorneyRequestDocumentCount,
    legalServicesAgreementDocumentCount,
  };
}

export async function getOgpComplaintFamilyRouteContext(input: {
  serverSlug: string;
  nextPath: string;
}): Promise<OgpComplaintFamilyRouteContext> {
  const { account } = await requireProtectedAccountContext(input.nextPath, undefined, {
    allowMustChangePassword: true,
  });
  const [server, servers, serverStates] = await Promise.all([
    getServerByCode(input.serverSlug),
    buildDocumentAreaServerSummaries(account.id),
    getUserServerStates(account.id),
  ]);

  if (!server) {
    return {
      status: "server_not_found",
      account,
      requestedServerSlug: input.serverSlug,
      servers,
    };
  }

  const [characters, documents] = await Promise.all([
    getCharactersByServer({
      accountId: account.id,
      serverId: server.id,
    }),
    listDocumentsByAccountAndServerAndType({
      accountId: account.id,
      serverId: server.id,
      documentType: "ogp_complaint",
    }),
  ]);
  const selectedCharacter = buildSelectedCharacterSummary({
    serverId: server.id,
    characters,
    serverStates,
  });

  return {
    status: "ready",
    account,
    server: {
      id: server.id,
      code: server.code,
      name: server.name,
    },
    servers,
    canCreateDocuments: selectedCharacter !== null,
    selectedCharacter,
    documents: documents.map((document) =>
      buildPersistedDocumentListItem({
        ...document,
        server,
      }),
    ),
  };
}

export async function getClaimsFamilyRouteContext(input: {
  serverSlug: string;
  nextPath: string;
}): Promise<ClaimsFamilyRouteContext> {
  const { account } = await requireProtectedAccountContext(input.nextPath, undefined, {
    allowMustChangePassword: true,
  });
  const [server, servers, serverStates] = await Promise.all([
    getServerByCode(input.serverSlug),
    buildDocumentAreaServerSummaries(account.id),
    getUserServerStates(account.id),
  ]);

  if (!server) {
    return {
      status: "server_not_found",
      account,
      requestedServerSlug: input.serverSlug,
      servers,
    };
  }

  const [characters, rehabilitationDocuments, lawsuitDocuments] = await Promise.all([
    getCharactersByServer({
      accountId: account.id,
      serverId: server.id,
    }),
    listDocumentsByAccountAndServerAndType({
      accountId: account.id,
      serverId: server.id,
      documentType: "rehabilitation",
    }),
    listDocumentsByAccountAndServerAndType({
      accountId: account.id,
      serverId: server.id,
      documentType: "lawsuit",
    }),
  ]);
  const selectedCharacter = buildSelectedCharacterSummary({
    serverId: server.id,
    characters,
    serverStates,
  });
  const documents = [...rehabilitationDocuments, ...lawsuitDocuments]
    .sort((left, right) => {
      const updatedAtDiff = right.updatedAt.getTime() - left.updatedAt.getTime();

      if (updatedAtDiff !== 0) {
        return updatedAtDiff;
      }

      return right.createdAt.getTime() - left.createdAt.getTime();
    })
    .map((document) =>
      buildPersistedDocumentListItem({
        ...document,
        server,
      }),
    );

  return {
    status: "ready",
    account,
    server: {
      id: server.id,
      code: server.code,
      name: server.name,
    },
    servers,
    canCreateDocuments: selectedCharacter !== null,
    selectedCharacter,
    documents,
  };
}

export async function getLegalServicesAgreementFamilyRouteContext(input: {
  serverSlug: string;
  nextPath: string;
}): Promise<LegalServicesAgreementFamilyRouteContext> {
  const { account } = await requireProtectedAccountContext(input.nextPath, undefined, {
    allowMustChangePassword: true,
  });
  const [server, servers, serverStates] = await Promise.all([
    getServerByCode(input.serverSlug),
    buildDocumentAreaServerSummaries(account.id),
    getUserServerStates(account.id),
  ]);

  if (!server) {
    return {
      status: "server_not_found",
      account,
      requestedServerSlug: input.serverSlug,
      servers,
    };
  }

  const [characters, documents, trustorRegistryRecords] = await Promise.all([
    getCharactersByServer({
      accountId: account.id,
      serverId: server.id,
    }),
    listDocumentsByAccountAndServerAndType({
      accountId: account.id,
      serverId: server.id,
      documentType: "legal_services_agreement",
    }),
    listTrustorsForAccountAndServer({
      accountId: account.id,
      serverId: server.id,
    }),
  ]);
  const selectedCharacter = buildSelectedCharacterSummary({
    serverId: server.id,
    characters,
    serverStates,
  });

  return {
    status: "ready",
    account,
    server: {
      id: server.id,
      code: server.code,
      name: server.name,
    },
    servers,
    canCreateDocuments: selectedCharacter !== null && trustorRegistryRecords.length > 0,
    selectedCharacter,
    trustorRegistry: buildDocumentTrustorRegistrySummary(trustorRegistryRecords),
    documents: documents.map((document) =>
      buildPersistedDocumentListItem({
        ...document,
        server,
      }),
    ),
  };
}

export async function getAttorneyRequestFamilyRouteContext(input: {
  serverSlug: string;
  nextPath: string;
}): Promise<AttorneyRequestFamilyRouteContext> {
  const { account } = await requireProtectedAccountContext(input.nextPath, undefined, {
    allowMustChangePassword: true,
  });
  const [server, servers, serverStates] = await Promise.all([
    getServerByCode(input.serverSlug),
    buildDocumentAreaServerSummaries(account.id),
    getUserServerStates(account.id),
  ]);

  if (!server) {
    return {
      status: "server_not_found",
      account,
      requestedServerSlug: input.serverSlug,
      servers,
    };
  }

  const [characters, documents, trustorRegistryRecords] = await Promise.all([
    getCharactersByServer({
      accountId: account.id,
      serverId: server.id,
    }),
    listDocumentsByAccountAndServerAndType({
      accountId: account.id,
      serverId: server.id,
      documentType: "attorney_request",
    }),
    listTrustorsForAccountAndServer({
      accountId: account.id,
      serverId: server.id,
    }),
  ]);
  const selectedCharacter = buildSelectedCharacterSummary({
    serverId: server.id,
    characters,
    serverStates,
  });

  return {
    status: "ready",
    account,
    server: {
      id: server.id,
      code: server.code,
      name: server.name,
    },
    servers,
    canCreateDocuments:
      selectedCharacter?.canCreateAttorneyRequest === true && trustorRegistryRecords.length > 0,
    selectedCharacter,
    trustorRegistry: buildDocumentTrustorRegistrySummary(trustorRegistryRecords),
    documents: documents.map((document) =>
      buildPersistedDocumentListItem({
        ...document,
        server,
      }),
    ),
  };
}

function readAttorneyRequestGeneratedArtifact(value: unknown) {
  const parsed = attorneyRequestRenderedArtifactSchema.safeParse(value);

  return parsed.success ? parsed.data : null;
}

function readLegalServicesAgreementGeneratedArtifact(value: unknown) {
  const parsed = legalServicesAgreementRenderedArtifactSchema.safeParse(value);

  return parsed.success ? parsed.data : null;
}

export async function getClaimsEditorRouteContext(input: {
  serverSlug: string;
  documentId: string;
  nextPath: string;
}): Promise<ClaimsEditorRouteContext> {
  const { account } = await requireProtectedAccountContext(input.nextPath, undefined, {
    allowMustChangePassword: true,
  });
  const [server, servers] = await Promise.all([
    getServerByCode(input.serverSlug),
    buildDocumentAreaServerSummaries(account.id),
  ]);

  if (!server) {
    return {
      status: "server_not_found",
      account,
      requestedServerSlug: input.serverSlug,
      servers,
    };
  }

  const document = await getDocumentByIdForAccount({
    accountId: account.id,
    documentId: input.documentId,
  });

  if (!document || document.serverId !== server.id || !isClaimsDocumentType(document.documentType)) {
    return {
      status: "document_not_found",
      account,
      server: {
        id: server.id,
        code: server.code,
        name: server.name,
      },
      servers,
      documentId: input.documentId,
    };
  }

  const authorSnapshot = safeReadDocumentAuthorSnapshot(document.authorSnapshotJson);

  if (!authorSnapshot.ok) {
    logDocumentEditorContextParseFailure({
      accountId: account.id,
      document,
      message: authorSnapshot.message,
    });

    return buildInvalidDocumentDataEditorRouteContext({
      account,
      server: {
        id: server.id,
        code: server.code,
        name: server.name,
      },
      servers,
      document,
    });
  }

  const payload = readClaimsDraftPayload(document.documentType, document.formPayloadJson);
  const generatedArtifact = readClaimsGeneratedArtifact(document.generatedArtifactJson);
  const trustorRegistry = buildDocumentTrustorRegistrySummary(
    await listTrustorsForAccountAndServer({
      accountId: account.id,
      serverId: server.id,
    }),
  );

  return {
    status: "ready",
    account,
    server: {
      id: server.id,
      code: server.code,
      name: server.name,
    },
    servers,
    document: {
      id: document.id,
      title: document.title,
      documentType: document.documentType,
      status: document.status,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
      snapshotCapturedAt: document.snapshotCapturedAt.toISOString(),
      formSchemaVersion: document.formSchemaVersion,
      generatedAt: document.generatedAt?.toISOString() ?? null,
      generatedFormSchemaVersion: document.generatedFormSchemaVersion,
      generatedOutputFormat: document.generatedOutputFormat,
      generatedRendererVersion: document.generatedRendererVersion,
      generatedArtifact,
      isModifiedAfterGeneration: document.isModifiedAfterGeneration,
      server: {
        code: document.server.code,
        name: document.server.name,
      },
      authorSnapshot: {
        fullName: authorSnapshot.data.fullName,
        passportNumber: authorSnapshot.data.passportNumber,
        position: authorSnapshot.data.position,
        address: authorSnapshot.data.address,
        phone: authorSnapshot.data.phone,
        icEmail: authorSnapshot.data.icEmail,
        passportImageUrl: authorSnapshot.data.passportImageUrl,
        nickname: authorSnapshot.data.nickname,
        roleKeys: authorSnapshot.data.roleKeys,
        accessFlags: authorSnapshot.data.accessFlags,
        isProfileComplete: authorSnapshot.data.isProfileComplete,
      },
      trustorRegistry,
      payload,
    },
  };
}

export async function getLegalServicesAgreementEditorRouteContext(input: {
  serverSlug: string;
  documentId: string;
  nextPath: string;
}): Promise<LegalServicesAgreementEditorRouteContext> {
  const { account } = await requireProtectedAccountContext(input.nextPath, undefined, {
    allowMustChangePassword: true,
  });
  const [server, servers] = await Promise.all([
    getServerByCode(input.serverSlug),
    buildDocumentAreaServerSummaries(account.id),
  ]);

  if (!server) {
    return {
      status: "server_not_found",
      account,
      requestedServerSlug: input.serverSlug,
      servers,
    };
  }

  const document = await getDocumentByIdForAccount({
    accountId: account.id,
    documentId: input.documentId,
  });

  if (!document || document.serverId !== server.id || document.documentType !== "legal_services_agreement") {
    return {
      status: "document_not_found",
      account,
      server: {
        id: server.id,
        code: server.code,
        name: server.name,
      },
      servers,
      documentId: input.documentId,
    };
  }

  const authorSnapshot = safeReadDocumentAuthorSnapshot(document.authorSnapshotJson);

  if (!authorSnapshot.ok) {
    logDocumentEditorContextParseFailure({
      accountId: account.id,
      document,
      message: authorSnapshot.message,
    });

    return buildInvalidDocumentDataEditorRouteContext({
      account,
      server: {
        id: server.id,
        code: server.code,
        name: server.name,
      },
      servers,
      document,
    });
  }

  const payload = safeReadLegalServicesAgreementDraftPayload(document.formPayloadJson);

  if (!payload.ok) {
    logDocumentEditorContextParseFailure({
      accountId: account.id,
      document,
      message: payload.message,
    });

    return buildInvalidDocumentDataEditorRouteContext({
      account,
      server: {
        id: server.id,
        code: server.code,
        name: server.name,
      },
      servers,
      document,
    });
  }

  const generatedArtifact = readLegalServicesAgreementGeneratedArtifact(document.generatedArtifactJson);

  return {
    status: "ready",
    account,
    server: {
      id: server.id,
      code: server.code,
      name: server.name,
    },
    servers,
    document: {
      id: document.id,
      title: document.title,
      status: document.status,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
      snapshotCapturedAt: document.snapshotCapturedAt.toISOString(),
      formSchemaVersion: document.formSchemaVersion,
      generatedAt: document.generatedAt?.toISOString() ?? null,
      generatedFormSchemaVersion: document.generatedFormSchemaVersion,
      generatedOutputFormat: document.generatedOutputFormat,
      generatedRendererVersion: document.generatedRendererVersion,
      generatedArtifact,
      isModifiedAfterGeneration: document.isModifiedAfterGeneration,
      server: {
        code: document.server.code,
        name: document.server.name,
      },
      authorSnapshot: {
        fullName: authorSnapshot.data.fullName,
        passportNumber: authorSnapshot.data.passportNumber,
        position: authorSnapshot.data.position,
        address: authorSnapshot.data.address,
        phone: authorSnapshot.data.phone,
        icEmail: authorSnapshot.data.icEmail,
        passportImageUrl: authorSnapshot.data.passportImageUrl,
        nickname: authorSnapshot.data.nickname,
        roleKeys: authorSnapshot.data.roleKeys,
        accessFlags: authorSnapshot.data.accessFlags,
        isProfileComplete: authorSnapshot.data.isProfileComplete,
      },
      payload: payload.data,
    },
  };
}

export async function getAttorneyRequestEditorRouteContext(input: {
  serverSlug: string;
  documentId: string;
  nextPath: string;
}): Promise<AttorneyRequestEditorRouteContext> {
  const { account } = await requireProtectedAccountContext(input.nextPath, undefined, {
    allowMustChangePassword: true,
  });
  const [server, servers] = await Promise.all([
    getServerByCode(input.serverSlug),
    buildDocumentAreaServerSummaries(account.id),
  ]);

  if (!server) {
    return {
      status: "server_not_found",
      account,
      requestedServerSlug: input.serverSlug,
      servers,
    };
  }

  const document = await getDocumentByIdForAccount({
    accountId: account.id,
    documentId: input.documentId,
  });

  if (!document || document.serverId !== server.id || document.documentType !== "attorney_request") {
    return {
      status: "document_not_found",
      account,
      server: {
        id: server.id,
        code: server.code,
        name: server.name,
      },
      servers,
      documentId: input.documentId,
    };
  }

  const authorSnapshot = safeReadDocumentAuthorSnapshot(document.authorSnapshotJson);

  if (!authorSnapshot.ok) {
    logDocumentEditorContextParseFailure({
      accountId: account.id,
      document,
      message: authorSnapshot.message,
    });

    return buildInvalidDocumentDataEditorRouteContext({
      account,
      server: {
        id: server.id,
        code: server.code,
        name: server.name,
      },
      servers,
      document,
    });
  }

  const signatureSnapshot = safeReadDocumentSignatureSnapshot(document.signatureSnapshotJson);
  let normalizedSignatureSnapshot: DocumentSignatureSnapshot | null = null;

  if (!signatureSnapshot.ok) {
    logDocumentEditorContextParseFailure({
      accountId: account.id,
      document,
      message: `Invalid signature snapshot: ${signatureSnapshot.message}`,
    });
  } else {
    normalizedSignatureSnapshot = signatureSnapshot.data;
  }

  const payload = safeReadAttorneyRequestDraftPayload(document.formPayloadJson);

  if (!payload.ok) {
    logDocumentEditorContextParseFailure({
      accountId: account.id,
      document,
      message: payload.message,
    });

    return buildInvalidDocumentDataEditorRouteContext({
      account,
      server: {
        id: server.id,
        code: server.code,
        name: server.name,
      },
      servers,
      document,
    });
  }

  const generatedArtifact = readAttorneyRequestGeneratedArtifact(document.generatedArtifactJson);

  return {
    status: "ready",
    account,
    server: {
      id: server.id,
      code: server.code,
      name: server.name,
    },
    servers,
    document: {
      id: document.id,
      title: document.title,
      status: document.status,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
      snapshotCapturedAt: document.snapshotCapturedAt.toISOString(),
      formSchemaVersion: document.formSchemaVersion,
      generatedAt: document.generatedAt?.toISOString() ?? null,
      generatedFormSchemaVersion: document.generatedFormSchemaVersion,
      generatedOutputFormat: document.generatedOutputFormat,
      generatedRendererVersion: document.generatedRendererVersion,
      generatedArtifact,
      isModifiedAfterGeneration: document.isModifiedAfterGeneration,
      server: {
        code: document.server.code,
        name: document.server.name,
      },
      authorSnapshot: {
        fullName: authorSnapshot.data.fullName,
        passportNumber: authorSnapshot.data.passportNumber,
        position: authorSnapshot.data.position,
        address: authorSnapshot.data.address,
        phone: authorSnapshot.data.phone,
        icEmail: authorSnapshot.data.icEmail,
        passportImageUrl: authorSnapshot.data.passportImageUrl,
        nickname: authorSnapshot.data.nickname,
        roleKeys: authorSnapshot.data.roleKeys,
        accessFlags: authorSnapshot.data.accessFlags,
        isProfileComplete: authorSnapshot.data.isProfileComplete,
      },
      signatureSnapshot: normalizedSignatureSnapshot,
      hasActiveCharacterSignature: Boolean(document.character?.activeSignature),
      payload: payload.data,
    },
  };
}

export async function getOgpComplaintEditorRouteContext(input: {
  serverSlug: string;
  documentId: string;
  nextPath: string;
}): Promise<OgpComplaintEditorRouteContext> {
  const { account } = await requireProtectedAccountContext(input.nextPath, undefined, {
    allowMustChangePassword: true,
  });
  const [server, servers] = await Promise.all([
    getServerByCode(input.serverSlug),
    buildDocumentAreaServerSummaries(account.id),
  ]);

  if (!server) {
    return {
      status: "server_not_found",
      account,
      requestedServerSlug: input.serverSlug,
      servers,
    };
  }

  const document = await getDocumentByIdForAccount({
    accountId: account.id,
    documentId: input.documentId,
  });

  if (!document || document.serverId !== server.id || document.documentType !== "ogp_complaint") {
    return {
      status: "document_not_found",
      account,
      server: {
        id: server.id,
        code: server.code,
        name: server.name,
      },
      servers,
      documentId: input.documentId,
    };
  }

  const authorSnapshot = safeReadDocumentAuthorSnapshot(document.authorSnapshotJson);

  if (!authorSnapshot.ok) {
    logDocumentEditorContextParseFailure({
      accountId: account.id,
      document,
      message: authorSnapshot.message,
    });

    return buildInvalidDocumentDataEditorRouteContext({
      account,
      server: {
        id: server.id,
        code: server.code,
        name: server.name,
      },
      servers,
      document,
    });
  }

  const payload = readOgpComplaintDraftPayload(document.formPayloadJson);
  const forumConnection = await getAccountForumConnectionSummary(account.id);
  const trustorRegistry = buildDocumentTrustorRegistrySummary(
    await listTrustorsForAccountAndServer({
      accountId: account.id,
      serverId: server.id,
    }),
  );

  return {
    status: "ready",
    account,
    server: {
      id: server.id,
      code: server.code,
      name: server.name,
    },
    servers,
    document: {
      id: document.id,
      title: document.title,
      status: document.status,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
      snapshotCapturedAt: document.snapshotCapturedAt.toISOString(),
      formSchemaVersion: document.formSchemaVersion,
      lastGeneratedBbcode: document.lastGeneratedBbcode,
      generatedAt: document.generatedAt?.toISOString() ?? null,
      generatedLawVersion: document.generatedLawVersion,
      generatedTemplateVersion: document.generatedTemplateVersion,
      generatedFormSchemaVersion: document.generatedFormSchemaVersion,
      publicationUrl: document.publicationUrl,
      isSiteForumSynced: document.isSiteForumSynced,
      forumSyncState: document.forumSyncState,
      forumThreadId: document.forumThreadId,
      forumPostId: document.forumPostId,
      forumPublishedBbcodeHash: document.forumPublishedBbcodeHash,
      forumLastPublishedAt: document.forumLastPublishedAt?.toISOString() ?? null,
      forumLastSyncError: document.forumLastSyncError,
      isModifiedAfterGeneration: document.isModifiedAfterGeneration,
      forumConnection,
      server: {
        code: document.server.code,
        name: document.server.name,
      },
      authorSnapshot: {
        fullName: authorSnapshot.data.fullName,
        passportNumber: authorSnapshot.data.passportNumber,
        position: authorSnapshot.data.position,
        address: authorSnapshot.data.address,
        phone: authorSnapshot.data.phone,
        icEmail: authorSnapshot.data.icEmail,
        passportImageUrl: authorSnapshot.data.passportImageUrl,
        nickname: authorSnapshot.data.nickname,
        roleKeys: authorSnapshot.data.roleKeys,
        accessFlags: authorSnapshot.data.accessFlags,
        isProfileComplete: authorSnapshot.data.isProfileComplete,
      },
      trustorRegistry,
      payload,
    },
  };
}

export function buildCharactersBridgePath(serverCode: string) {
  return buildAccountCharactersBridgeHref(serverCode);
}
