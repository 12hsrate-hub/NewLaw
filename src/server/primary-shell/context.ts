import { getCharactersByServer } from "@/db/repositories/character.repository";
import { getServers } from "@/db/repositories/server.repository";
import { getUserServerStates } from "@/db/repositories/user-server-state.repository";
import { resolveActiveCharacterId, resolveActiveServerId } from "@/server/app-shell/state";
import { syncAccountFromSupabaseUser } from "@/server/auth/account";
import { getCurrentUser } from "@/server/auth/helpers";
import { buildWorkspaceCapabilities } from "@/server/navigation/capabilities";

type PrimaryShellProtectedContext = {
  user: {
    id: string;
    email?: string | null;
  };
  account: {
    id: string;
    email: string;
    login: string;
    isSuperAdmin: boolean;
  };
};

export type PrimaryShellContext = {
  viewer: {
    isAuthenticated: boolean;
    accountLogin: string | null;
    accountEmail: string | null;
    isSuperAdmin: boolean;
  };
  currentPath: string;
  availableServers: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  activeServer: {
    id: string | null;
    name: string | null;
    slug: string | null;
  };
  navigation: {
    documentsHref: string | null;
    lawyerWorkspaceHref: string | null;
    internalHref: string | null;
  };
};

type GetPrimaryShellContextInput = {
  currentPath: string;
  protectedContext?: PrimaryShellProtectedContext;
};

function buildGuestContext(currentPath: string): PrimaryShellContext {
  return {
    viewer: {
      isAuthenticated: false,
      accountLogin: null,
      accountEmail: null,
      isSuperAdmin: false,
    },
    currentPath,
    availableServers: [],
    activeServer: {
      id: null,
      name: null,
      slug: null,
    },
    navigation: {
      documentsHref: null,
      lawyerWorkspaceHref: null,
      internalHref: null,
    },
  };
}

async function resolveShellNavigation(input: {
  accountId: string;
  servers: Awaited<ReturnType<typeof getServers>>;
  serverStates: Awaited<ReturnType<typeof getUserServerStates>>;
}) {
  const activeServerId = resolveActiveServerId(input.servers, input.serverStates);
  const activeServer = activeServerId
    ? input.servers.find((server) => server.id === activeServerId) ?? null
    : null;

  if (!activeServer) {
    return {
      activeServer: {
        id: null,
        name: null,
        slug: null,
      },
      navigation: {
        documentsHref: null,
        lawyerWorkspaceHref: null,
      },
    };
  }

  const characters = await getCharactersByServer({
    accountId: input.accountId,
    serverId: activeServer.id,
  });
  const activeCharacterId = resolveActiveCharacterId(
    activeServer.id,
    characters,
    input.serverStates,
  );
  const selectedCharacter = activeCharacterId
    ? characters.find((character) => character.id === activeCharacterId) ?? null
    : characters[0] ?? null;
  const hasAdvocateCharacter =
    selectedCharacter?.accessFlags?.some((flag) => flag.flagKey === "advocate") === true;
  const workspaceCapabilities = buildWorkspaceCapabilities({
    isAuthenticated: true,
    hasServer: true,
    hasAssistantMaterials: true,
    hasSelectedCharacter: selectedCharacter !== null,
    hasAdvocateCharacter,
  });

  return {
    activeServer: {
      id: activeServer.id,
      name: activeServer.name,
      slug: activeServer.code,
    },
    navigation: {
      documentsHref: `/servers/${activeServer.code}/documents`,
      lawyerWorkspaceHref: workspaceCapabilities.canOpenLawyerWorkspace
        ? `/servers/${activeServer.code}/lawyer`
        : null,
    },
  };
}

export async function getPrimaryShellContext(
  input: GetPrimaryShellContextInput,
): Promise<PrimaryShellContext> {
  const currentPath = input.currentPath;

  if (input.protectedContext) {
    const { account } = input.protectedContext;
    const [servers, serverStates] = await Promise.all([
      getServers(),
      getUserServerStates(account.id),
    ]);
    const shellNavigation = await resolveShellNavigation({
      accountId: account.id,
      servers,
      serverStates,
    });

    return {
      viewer: {
        isAuthenticated: true,
        accountLogin: account.login,
        accountEmail: account.email,
        isSuperAdmin: account.isSuperAdmin,
      },
      currentPath,
      availableServers: servers.map((server) => ({
        id: server.id,
        name: server.name,
        slug: server.code,
      })),
      activeServer: shellNavigation.activeServer,
      navigation: {
        documentsHref: shellNavigation.navigation.documentsHref,
        lawyerWorkspaceHref: shellNavigation.navigation.lawyerWorkspaceHref,
        internalHref: account.isSuperAdmin ? "/internal" : null,
      },
    };
  }

  const user = await getCurrentUser();

  if (!user?.id || !user.email) {
    return buildGuestContext(currentPath);
  }

  const account = await syncAccountFromSupabaseUser(user);
  const [servers, serverStates] = await Promise.all([
    getServers(),
    getUserServerStates(account.id),
  ]);
  const shellNavigation = await resolveShellNavigation({
    accountId: account.id,
    servers,
    serverStates,
  });

  return {
    viewer: {
      isAuthenticated: true,
      accountLogin: account.login,
      accountEmail: account.email,
      isSuperAdmin: account.isSuperAdmin,
    },
    currentPath,
    availableServers: servers.map((server) => ({
      id: server.id,
      name: server.name,
      slug: server.code,
    })),
    activeServer: shellNavigation.activeServer,
    navigation: {
      documentsHref: shellNavigation.navigation.documentsHref,
      lawyerWorkspaceHref: shellNavigation.navigation.lawyerWorkspaceHref,
      internalHref: account.isSuperAdmin ? "/internal" : null,
    },
  };
}
