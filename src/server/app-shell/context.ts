import { getCharactersByServer } from "@/db/repositories/character.repository";
import { getServers } from "@/db/repositories/server.repository";
import { getUserServerStates } from "@/db/repositories/user-server-state.repository";
import { requireProtectedAccountContext } from "@/server/auth/protected";
import {
  resolveActiveCharacterId,
  resolveActiveServerId,
} from "@/server/app-shell/state";

type AppShellContextOptions = {
  allowMustChangePassword?: boolean;
};

export async function getAppShellContext(
  nextPath = "/",
  options: AppShellContextOptions = {},
) {
  const { user, account } = await requireProtectedAccountContext(
    nextPath,
    undefined,
    {
      allowMustChangePassword: options.allowMustChangePassword,
    },
  );
  const servers = await getServers();
  const serverStates = await getUserServerStates(account.id);
  const activeServerId = resolveActiveServerId(servers, serverStates);

  const activeServer = activeServerId
    ? servers.find((server) => server.id === activeServerId) ?? null
    : null;
  const characters = activeServer
    ? await getCharactersByServer({
        accountId: account.id,
        serverId: activeServer.id,
      })
    : [];
  const activeCharacterId = resolveActiveCharacterId(
    activeServer?.id ?? null,
    characters,
    serverStates,
  );

  const activeCharacter = activeCharacterId
    ? characters.find((character) => character.id === activeCharacterId) ?? null
    : characters[0] ?? null;

  return {
    user,
    account,
    currentPath: nextPath,
    servers,
    serverStates,
    activeServer,
    activeCharacter,
    characters,
  };
}
