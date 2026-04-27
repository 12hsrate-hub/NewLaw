import { getCharactersByServer } from "@/db/repositories/character.repository";
import { getServerDirectoryServerByCode } from "@/db/repositories/server.repository";
import { listTrustorsForAccountAndServer } from "@/db/repositories/trustor.repository";
import { getUserServerStates } from "@/db/repositories/user-server-state.repository";
import { requireProtectedAccountContext } from "@/server/auth/protected";
import { resolveActiveCharacterId } from "@/server/app-shell/state";
import {
  buildDocumentEntryCapabilities,
  buildWorkspaceCapabilities,
  type DocumentEntryCapabilities,
  type WorkspaceCapabilities,
} from "@/server/navigation/capabilities";
import {
  resolveAssistantStatus,
  type ServerAssistantStatus,
  type ServerDirectoryAvailability,
  type ServerDocumentsAvailabilityForViewer,
} from "@/server/server-directory/context";

type ServerDirectoryRecord = NonNullable<
  Awaited<ReturnType<typeof getServerDirectoryServerByCode>>
>;

export type ServerHubViewerSummary = {
  accountId: string;
  email: string;
  login: string;
};

export type ServerHubSelectedCharacterSummary = {
  id: string;
  fullName: string;
  passportNumber: string;
  source: "last_used" | "first_available";
};

type ServerHubBaseServerSummary = {
  id: string;
  code: string;
  slug: string;
  name: string;
  directoryAvailability: ServerDirectoryAvailability;
};

type ServerHubReadyContext = {
  status: "ready";
  viewer: ServerHubViewerSummary;
  server: ServerHubBaseServerSummary;
  assistantStatus: ServerAssistantStatus;
  documentsAvailabilityForViewer: Exclude<
    ServerDocumentsAvailabilityForViewer,
    "requires_auth"
  >;
  selectedCharacterSummary: ServerHubSelectedCharacterSummary | null;
  workspaceCapabilities?: WorkspaceCapabilities;
  documentEntryCapabilities?: DocumentEntryCapabilities;
};

type ServerHubNotFoundContext = {
  status: "server_not_found";
  viewer: ServerHubViewerSummary;
  requestedServerSlug: string;
};

type ServerHubUnavailableContext = {
  status: "server_unavailable";
  viewer: ServerHubViewerSummary;
  server: ServerHubBaseServerSummary;
};

export type ServerHubRouteContext =
  | ServerHubReadyContext
  | ServerHubNotFoundContext
  | ServerHubUnavailableContext;

function buildServerSummary(
  server: Pick<ServerDirectoryRecord, "id" | "code" | "name" | "isActive">,
  assistantStatus: ServerAssistantStatus,
): ServerHubBaseServerSummary {
  return {
    id: server.id,
    code: server.code,
    slug: server.code,
    name: server.name,
    directoryAvailability:
      assistantStatus === "maintenance_mode"
        ? "maintenance"
        : server.isActive
          ? "active"
          : "unavailable",
  };
}

function buildViewerSummary(input: {
  account: {
    id: string;
    email: string;
    login: string;
  };
}): ServerHubViewerSummary {
  return {
    accountId: input.account.id,
    email: input.account.email,
    login: input.account.login,
  };
}

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
}): ServerHubSelectedCharacterSummary | null {
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
      source: "last_used",
    };
  }

  const fallbackCharacter = input.characters[0] ?? null;

  if (!fallbackCharacter) {
    return null;
  }

  return {
    id: fallbackCharacter.id,
    fullName: fallbackCharacter.fullName,
    passportNumber: fallbackCharacter.passportNumber,
    source: "first_available",
  };
}

function resolveSelectedCharacterForCapabilities(input: {
  serverId: string;
  characters: Array<{
    id: string;
    serverId: string;
    fullName: string;
    passportNumber: string;
    accessFlags?: Array<{
      flagKey: string;
    }>;
    roles?: Array<{
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
    return activeCharacter;
  }

  return input.characters[0] ?? null;
}

function isAssistantEntryAvailable(status: ServerAssistantStatus) {
  return (
    status === "current_corpus_ready" ||
    status === "corpus_bootstrap_incomplete" ||
    status === "corpus_stale"
  );
}

export async function getProtectedServerHubContext(input: {
  serverSlug: string;
  nextPath: string;
}): Promise<ServerHubRouteContext> {
  const { account } = await requireProtectedAccountContext(input.nextPath, undefined, {
    allowMustChangePassword: true,
  });
  const viewer = buildViewerSummary({ account });
  const server = await getServerDirectoryServerByCode(input.serverSlug);

  if (!server) {
    return {
      status: "server_not_found",
      viewer,
      requestedServerSlug: input.serverSlug,
    };
  }

  const assistantStatus = resolveAssistantStatus(server);
  const serverSummary = buildServerSummary(server, assistantStatus);

  if (serverSummary.directoryAvailability === "unavailable") {
    return {
      status: "server_unavailable",
      viewer,
      server: serverSummary,
    };
  }

  const [characters, serverStates, trustorRegistryRecords] = await Promise.all([
    getCharactersByServer({
      accountId: account.id,
      serverId: server.id,
    }),
    getUserServerStates(account.id),
    listTrustorsForAccountAndServer({
      accountId: account.id,
      serverId: server.id,
    }),
  ]);
  const selectedCharacter = resolveSelectedCharacterForCapabilities({
    serverId: server.id,
    characters,
    serverStates,
  });
  const selectedCharacterSummary = buildSelectedCharacterSummary({
    serverId: server.id,
    characters,
    serverStates,
  });
  const documentsAvailabilityForViewer =
    serverSummary.directoryAvailability === "maintenance"
      ? "unavailable"
      : selectedCharacterSummary
        ? "available"
        : "needs_character";
  const hasAdvocateCharacter =
    selectedCharacter?.accessFlags?.some((flag) => flag.flagKey === "advocate") === true;
  const canCreateAttorneyRequestLegacy =
    selectedCharacter?.roles?.some((role) => role.roleKey === "lawyer") === true;
  const workspaceCapabilities = buildWorkspaceCapabilities({
    isAuthenticated: true,
    hasServer: true,
    hasAssistantMaterials: isAssistantEntryAvailable(assistantStatus),
    hasSelectedCharacter: selectedCharacterSummary !== null,
    hasAdvocateCharacter,
  });
  const documentEntryCapabilities = buildDocumentEntryCapabilities({
    isAuthenticated: true,
    hasServer: true,
    hasSelectedCharacter: selectedCharacterSummary !== null,
    hasAdvocateCharacter,
    hasTrustorRegistry: trustorRegistryRecords.length > 0,
    canCreateAttorneyRequestLegacy,
    compatibilityRequiresTrustorRegistryForLegalServicesAgreement: true,
  });

  return {
    status: "ready",
    viewer,
    server: serverSummary,
    assistantStatus,
    documentsAvailabilityForViewer,
    selectedCharacterSummary,
    workspaceCapabilities,
    documentEntryCapabilities,
  };
}
