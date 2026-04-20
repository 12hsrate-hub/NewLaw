import type { Character, Server, UserServerState } from "@prisma/client";

type CharacterSummary = Pick<Character, "id" | "serverId">;
type ServerSummary = Pick<Server, "id">;
type ServerStateSummary = Pick<UserServerState, "serverId" | "activeCharacterId" | "lastSelectedAt">;

export class ActiveCharacterSelectionError extends Error {
  constructor() {
    super("Character does not belong to the selected server");
    this.name = "ActiveCharacterSelectionError";
  }
}

export function resolveActiveServerId(
  servers: ServerSummary[],
  states: ServerStateSummary[],
) {
  const availableServerIds = new Set(servers.map((server) => server.id));
  const selectedState = states.find((state) => availableServerIds.has(state.serverId));

  if (selectedState) {
    return selectedState.serverId;
  }

  return servers[0]?.id ?? null;
}

export function resolveActiveCharacterId(
  activeServerId: string | null,
  characters: CharacterSummary[],
  states: ServerStateSummary[],
) {
  if (!activeServerId) {
    return null;
  }

  const selectedState = states.find((state) => state.serverId === activeServerId);

  if (!selectedState?.activeCharacterId) {
    return null;
  }

  const hasCharacter = characters.some(
    (character) =>
      character.id === selectedState.activeCharacterId && character.serverId === activeServerId,
  );

  return hasCharacter ? selectedState.activeCharacterId : null;
}

export function assertCharacterBelongsToServer(input: {
  serverId: string;
  characterId: string;
  characters: CharacterSummary[];
}) {
  const exists = input.characters.some(
    (character) =>
      character.id === input.characterId && character.serverId === input.serverId,
  );

  if (!exists) {
    throw new ActiveCharacterSelectionError();
  }
}
