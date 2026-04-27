import { getServers } from "@/db/repositories/server.repository";
import { getUserServerStates } from "@/db/repositories/user-server-state.repository";
import { resolveActiveServerId } from "@/server/app-shell/state";
import { syncAccountFromSupabaseUser } from "@/server/auth/account";
import { getCurrentUser } from "@/server/auth/helpers";

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
      internalHref: null,
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
    const activeServerId = resolveActiveServerId(servers, serverStates);
    const activeServer = activeServerId
      ? servers.find((server) => server.id === activeServerId) ?? null
      : null;

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
      activeServer: {
        id: activeServer?.id ?? null,
        name: activeServer?.name ?? null,
        slug: activeServer?.code ?? null,
      },
      navigation: {
        documentsHref: activeServer ? `/servers/${activeServer.code}/documents` : null,
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
  const activeServerId = resolveActiveServerId(servers, serverStates);
  const activeServer = activeServerId
    ? servers.find((server) => server.id === activeServerId) ?? null
    : null;

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
    activeServer: {
      id: activeServer?.id ?? null,
      name: activeServer?.name ?? null,
      slug: activeServer?.code ?? null,
    },
    navigation: {
      documentsHref: activeServer ? `/servers/${activeServer.code}/documents` : null,
      internalHref: account.isSuperAdmin ? "/internal" : null,
    },
  };
}
