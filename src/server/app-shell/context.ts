import { getCharactersByServer } from "@/db/repositories/character.repository";
import { getServers } from "@/db/repositories/server.repository";
import {
  getUserServerStates,
  selectActiveCharacter,
  selectActiveServer,
} from "@/db/repositories/user-server-state.repository";
import { requireProtectedAccountContext } from "@/server/auth/protected";
import {
  resolveActiveCharacterId,
  resolveActiveServerId,
} from "@/server/app-shell/state";

export async function getAppShellContext(nextPath = "/app") {
  const { user, account } = await requireProtectedAccountContext(nextPath);
  const servers = await getServers();
  let serverStates = await getUserServerStates(account.id);
  let activeServerId = resolveActiveServerId(servers, serverStates);

  if (!serverStates.length && activeServerId) {
    await selectActiveServer({
      accountId: account.id,
      serverId: activeServerId,
    });

    serverStates = await getUserServerStates(account.id);
    activeServerId = resolveActiveServerId(servers, serverStates);
  }

  const activeServer = activeServerId
    ? servers.find((server) => server.id === activeServerId) ?? null
    : null;
  const characters = activeServer
    ? await getCharactersByServer({
        accountId: account.id,
        serverId: activeServer.id,
      })
    : [];
  let activeCharacterId = resolveActiveCharacterId(activeServer?.id ?? null, characters, serverStates);

  if (activeServer && characters.length > 0 && !activeCharacterId) {
    await selectActiveCharacter({
      accountId: account.id,
      serverId: activeServer.id,
      characterId: characters[0].id,
    });

    serverStates = await getUserServerStates(account.id);
    activeCharacterId = resolveActiveCharacterId(activeServer.id, characters, serverStates);
  }

  const activeCharacter = activeCharacterId
    ? characters.find((character) => character.id === activeCharacterId) ?? null
    : null;

  return {
    user,
    account,
    servers,
    serverStates,
    activeServer,
    activeCharacter,
    characters,
  };
}
