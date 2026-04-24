import {
  createCharacterAccessRequestRecord,
  findPendingCharacterAccessRequest,
} from "@/db/repositories/character-access-request.repository";
import { getCharacterByIdForAccount } from "@/db/repositories/character.repository";
import {
  createCharacterAccessRequestInputSchema,
  type CreateCharacterAccessRequestInput,
} from "@/schemas/character";

type CharacterAccessRequestDependencies = {
  getCharacterByIdForAccount: typeof getCharacterByIdForAccount;
  findPendingCharacterAccessRequest: typeof findPendingCharacterAccessRequest;
  createCharacterAccessRequestRecord: typeof createCharacterAccessRequestRecord;
};

const defaultDependencies: CharacterAccessRequestDependencies = {
  getCharacterByIdForAccount,
  findPendingCharacterAccessRequest,
  createCharacterAccessRequestRecord,
};

export class CharacterAccessRequestCharacterNotFoundError extends Error {
  constructor() {
    super("Character not found for access request");
    this.name = "CharacterAccessRequestCharacterNotFoundError";
  }
}

export class CharacterAccessRequestAlreadyExistsError extends Error {
  constructor() {
    super("Pending character access request already exists");
    this.name = "CharacterAccessRequestAlreadyExistsError";
  }
}

export class CharacterAccessRequestAlreadyGrantedError extends Error {
  constructor() {
    super("Character already has requested access");
    this.name = "CharacterAccessRequestAlreadyGrantedError";
  }
}

export async function createCharacterAccessRequest(
  input: CreateCharacterAccessRequestInput,
  dependencies: CharacterAccessRequestDependencies = defaultDependencies,
) {
  const parsed = createCharacterAccessRequestInputSchema.parse(input);
  const character = await dependencies.getCharacterByIdForAccount({
    accountId: parsed.accountId,
    characterId: parsed.characterId,
  });

  if (!character) {
    throw new CharacterAccessRequestCharacterNotFoundError();
  }

  if (
    parsed.requestType === "advocate_access" &&
    character.accessFlags.some((flag) => flag.flagKey === "advocate")
  ) {
    throw new CharacterAccessRequestAlreadyGrantedError();
  }

  const existingPendingRequest = await dependencies.findPendingCharacterAccessRequest({
    characterId: character.id,
    requestType: parsed.requestType,
  });

  if (existingPendingRequest) {
    throw new CharacterAccessRequestAlreadyExistsError();
  }

  return dependencies.createCharacterAccessRequestRecord({
    accountId: parsed.accountId,
    serverId: character.serverId,
    characterId: character.id,
    requestType: parsed.requestType,
    requestComment: parsed.requestComment.length ? parsed.requestComment : null,
  });
}
