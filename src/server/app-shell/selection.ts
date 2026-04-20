import { getCharactersByServer } from "@/db/repositories/character.repository";
import { getServerById } from "@/db/repositories/server.repository";
import {
  selectActiveCharacter,
  selectActiveServer,
} from "@/db/repositories/user-server-state.repository";
import {
  type CharacterSelectionInput,
  characterSelectionSchema,
} from "@/schemas/character";
import {
  type ActiveServerSelectionInput,
  activeServerSelectionSchema,
} from "@/schemas/server";
import { assertCharacterBelongsToServer } from "@/server/app-shell/state";

type ServerSelectionRepository = {
  getServerById: typeof getServerById;
  selectActiveServer: typeof selectActiveServer;
};

type CharacterSelectionRepository = {
  getCharactersByServer: typeof getCharactersByServer;
  selectActiveCharacter: typeof selectActiveCharacter;
};

const defaultServerSelectionRepository: ServerSelectionRepository = {
  getServerById,
  selectActiveServer,
};

const defaultCharacterSelectionRepository: CharacterSelectionRepository = {
  getCharactersByServer,
  selectActiveCharacter,
};

export class ActiveServerNotFoundError extends Error {
  constructor() {
    super("Server not found");
    this.name = "ActiveServerNotFoundError";
  }
}

export async function setActiveServerSelection(
  accountId: string,
  input: ActiveServerSelectionInput,
  repository: ServerSelectionRepository = defaultServerSelectionRepository,
) {
  const parsed = activeServerSelectionSchema.parse(input);
  const server = await repository.getServerById(parsed.serverId);

  if (!server) {
    throw new ActiveServerNotFoundError();
  }

  return repository.selectActiveServer({
    accountId,
    serverId: parsed.serverId,
  });
}

export async function setActiveCharacterSelection(
  accountId: string,
  input: CharacterSelectionInput,
  repository: CharacterSelectionRepository = defaultCharacterSelectionRepository,
) {
  const parsed = characterSelectionSchema.parse(input);
  const characters = await repository.getCharactersByServer({
    accountId,
    serverId: parsed.serverId,
  });

  assertCharacterBelongsToServer({
    serverId: parsed.serverId,
    characterId: parsed.characterId,
    characters,
  });

  return repository.selectActiveCharacter({
    accountId,
    serverId: parsed.serverId,
    characterId: parsed.characterId,
  });
}
