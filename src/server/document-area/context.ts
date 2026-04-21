import { getCharactersByServer } from "@/db/repositories/character.repository";
import { getServerByCode, getServers } from "@/db/repositories/server.repository";
import { getUserServerStates } from "@/db/repositories/user-server-state.repository";
import { requireProtectedAccountContext } from "@/server/auth/protected";
import { resolveActiveCharacterId } from "@/server/app-shell/state";

export type DocumentAreaServerSummary = {
  id: string;
  code: string;
  name: string;
  characterCount: number;
  selectedCharacterId: string | null;
  selectedCharacterName: string | null;
  selectedCharacterSource: "last_used" | "first_available" | "none";
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

async function buildDocumentAreaServerSummaries(accountId: string) {
  const [servers, serverStates] = await Promise.all([
    getServers(),
    getUserServerStates(accountId),
  ]);

  const serverSummaries = await Promise.all(
    servers.map(async (server) => {
      const characters = await getCharactersByServer({
        accountId,
        serverId: server.id,
      });
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
  const servers = await buildDocumentAreaServerSummaries(account.id);

  return {
    account,
    servers,
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

  const characters = await getCharactersByServer({
    accountId: account.id,
    serverId: server.id,
  });
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
    characters: characters.map((character) => ({
      id: character.id,
      fullName: character.fullName,
      passportNumber: character.passportNumber,
    })),
    selectedCharacter,
  };
}

export function buildCharactersBridgePath() {
  return "/app";
}
