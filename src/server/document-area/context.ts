import { getCharactersByServer } from "@/db/repositories/character.repository";
import {
  countDocumentsByAccountAndServerAndType,
  getDocumentByIdForAccount,
  listDocumentsByAccount,
  listDocumentsByAccountAndServerAndType,
} from "@/db/repositories/document.repository";
import { getServerByCode, getServers } from "@/db/repositories/server.repository";
import { getUserServerStates } from "@/db/repositories/user-server-state.repository";
import { requireProtectedAccountContext } from "@/server/auth/protected";
import { resolveActiveCharacterId } from "@/server/app-shell/state";
import { readDocumentAuthorSnapshot, readOgpComplaintDraftPayload } from "@/server/document-area/persistence";

type AccountDocumentRecord = Awaited<ReturnType<typeof listDocumentsByAccount>>[number];
type ServerDocumentRecord = Awaited<ReturnType<typeof listDocumentsByAccountAndServerAndType>>[number];

export type DocumentAreaServerSummary = {
  id: string;
  code: string;
  name: string;
  characterCount: number;
  selectedCharacterId: string | null;
  selectedCharacterName: string | null;
  selectedCharacterSource: "last_used" | "first_available" | "none";
  ogpComplaintDocumentCount: number;
};

export type DocumentAreaPersistedListItem = {
  id: string;
  title: string;
  documentType: "ogp_complaint" | "rehabilitation" | "lawsuit";
  status: "draft" | "generated" | "published";
  server: {
    id: string;
    code: string;
    name: string;
  };
  authorSnapshot: {
    fullName: string;
    passportNumber: string;
  };
  workingNotesPreview: string;
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

type ReadyServerDocumentsRouteContext = {
  status: "ready";
  account: AccountDocumentsOverviewContext["account"];
  server: {
    id: string;
    code: string;
    name: string;
  };
  servers: DocumentAreaServerSummary[];
  characters: Array<{
    id: string;
    fullName: string;
    passportNumber: string;
  }>;
  selectedCharacter: {
    id: string;
    fullName: string;
    passportNumber: string;
    source: "last_used" | "first_available";
  };
  ogpComplaintDocumentCount: number;
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
      selectedCharacter: {
        id: string;
        fullName: string;
        passportNumber: string;
        source: "last_used" | "first_available";
      } | null;
      documents: DocumentAreaPersistedListItem[];
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
        server: {
          code: string;
          name: string;
        };
        authorSnapshot: {
          fullName: string;
          passportNumber: string;
          nickname: string;
          roleKeys: string[];
          accessFlags: string[];
        };
        workingNotes: string;
      };
    };

function buildSelectedCharacterSummary(input: {
  serverId: string;
  characters: Array<{
    id: string;
    serverId: string;
    fullName: string;
    passportNumber: string;
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
      id: activeCharacter.id,
      fullName: activeCharacter.fullName,
      passportNumber: activeCharacter.passportNumber,
      source: "last_used" as const,
    };
  }

  const firstCharacter = input.characters[0] ?? null;

  if (!firstCharacter) {
    return null;
  }

  return {
    id: firstCharacter.id,
    fullName: firstCharacter.fullName,
    passportNumber: firstCharacter.passportNumber,
    source: "first_available" as const,
  };
}

function buildPersistedDocumentListItem(document: AccountDocumentRecord | (ServerDocumentRecord & { server: AccountDocumentRecord["server"] })) {
  const authorSnapshot = readDocumentAuthorSnapshot(document.authorSnapshotJson);
  const payload = readOgpComplaintDraftPayload(document.formPayloadJson);

  return {
    id: document.id,
    title: document.title,
    documentType: document.documentType,
    status: document.status,
    server: {
      id: document.server.id,
      code: document.server.code,
      name: document.server.name,
    },
    authorSnapshot: {
      fullName: authorSnapshot.fullName,
      passportNumber: authorSnapshot.passportNumber,
    },
    workingNotesPreview: payload.workingNotes.slice(0, 240),
    snapshotCapturedAt: document.snapshotCapturedAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
    createdAt: document.createdAt.toISOString(),
  } satisfies DocumentAreaPersistedListItem;
}

async function buildDocumentAreaServerSummaries(accountId: string) {
  const [servers, serverStates] = await Promise.all([
    getServers(),
    getUserServerStates(accountId),
  ]);

  const serverSummaries = await Promise.all(
    servers.map(async (server) => {
      const [characters, ogpComplaintDocumentCount] = await Promise.all([
        getCharactersByServer({
          accountId,
          serverId: server.id,
        }),
        countDocumentsByAccountAndServerAndType({
          accountId,
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
        id: server.id,
        code: server.code,
        name: server.name,
        characterCount: characters.length,
        selectedCharacterId: selectedCharacter?.id ?? null,
        selectedCharacterName: selectedCharacter?.fullName ?? null,
        selectedCharacterSource: selectedCharacter?.source ?? "none",
        ogpComplaintDocumentCount,
      } satisfies DocumentAreaServerSummary;
    }),
  );

  return serverSummaries;
}

export async function getAccountDocumentsOverviewContext(
  nextPath = "/account/documents",
): Promise<AccountDocumentsOverviewContext> {
  const { account } = await requireProtectedAccountContext(nextPath, undefined, {
    allowMustChangePassword: true,
  });
  const [servers, documents] = await Promise.all([
    buildDocumentAreaServerSummaries(account.id),
    listDocumentsByAccount(account.id),
  ]);

  return {
    account,
    servers,
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

  const [characters, ogpComplaintDocumentCount] = await Promise.all([
    getCharactersByServer({
      accountId: account.id,
      serverId: server.id,
    }),
    countDocumentsByAccountAndServerAndType({
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
    characters: characters.map((character: (typeof characters)[number]) => ({
      id: character.id,
      fullName: character.fullName,
      passportNumber: character.passportNumber,
    })),
    selectedCharacter,
    ogpComplaintDocumentCount,
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
    documents: documents.map((document: ServerDocumentRecord) =>
      buildPersistedDocumentListItem({
        ...document,
        server,
      }),
    ),
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

  const authorSnapshot = readDocumentAuthorSnapshot(document.authorSnapshotJson);
  const payload = readOgpComplaintDraftPayload(document.formPayloadJson);

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
      server: {
        code: document.server.code,
        name: document.server.name,
      },
      authorSnapshot: {
        fullName: authorSnapshot.fullName,
        passportNumber: authorSnapshot.passportNumber,
        nickname: authorSnapshot.nickname,
        roleKeys: authorSnapshot.roleKeys,
        accessFlags: authorSnapshot.accessFlags,
      },
      workingNotes: payload.workingNotes,
    },
  };
}

export function buildCharactersBridgePath() {
  return "/app";
}
