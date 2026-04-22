import {
  countCharactersByServer,
  createCharacterRecord,
  findCharacterByPassport,
  getCharacterByIdForAccount,
  updateCharacterRecord,
} from "@/db/repositories/character.repository";
import {
  type CharacterAccessFlagKey,
  type CharacterRoleKey,
  createCharacterInputSchema,
  type CreateCharacterInput,
  type UpdateCharacterInput,
  updateCharacterInputSchema,
} from "@/schemas/character";

export const MAX_CHARACTERS_PER_SERVER = 3;

type CharacterMutationRepository = {
  countCharactersByServer: typeof countCharactersByServer;
  findCharacterByPassport: typeof findCharacterByPassport;
  getCharacterByIdForAccount: typeof getCharacterByIdForAccount;
  createCharacterRecord: typeof createCharacterRecord;
  updateCharacterRecord: typeof updateCharacterRecord;
};

const defaultRepository: CharacterMutationRepository = {
  countCharactersByServer,
  findCharacterByPassport,
  getCharacterByIdForAccount,
  createCharacterRecord,
  updateCharacterRecord,
};

export class CharacterLimitExceededError extends Error {
  constructor() {
    super("Character limit reached for server");
    this.name = "CharacterLimitExceededError";
  }
}

export class CharacterPassportConflictError extends Error {
  constructor() {
    super("Passport already exists for this account and server");
    this.name = "CharacterPassportConflictError";
  }
}

export class CharacterNotFoundError extends Error {
  constructor() {
    super("Character not found");
    this.name = "CharacterNotFoundError";
  }
}

function normalizeFullName(fullName: string) {
  return fullName
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeNickname(input: {
  nickname: string;
  fallbackFullName: string;
}) {
  const normalizedNickname = input.nickname.trim().replace(/\s+/g, " ");

  return normalizedNickname.length > 0 ? normalizedNickname : input.fallbackFullName;
}

function normalizePassportNumber(passportNumber: string) {
  return passportNumber.trim().toUpperCase();
}

function uniqueRoleKeys(roleKeys: CharacterRoleKey[]) {
  return [...new Set<CharacterRoleKey>(roleKeys)];
}

function uniqueAccessFlags(accessFlags: CharacterAccessFlagKey[]) {
  return [...new Set<CharacterAccessFlagKey>(accessFlags)];
}

function normalizeProfileData(profileDataJson: Record<string, string> | null) {
  if (!profileDataJson) {
    return null;
  }

  const normalizedEntries = Object.entries(profileDataJson).filter((entry) => entry[1].trim().length > 0);

  if (!normalizedEntries.length) {
    return null;
  }

  return Object.fromEntries(
    normalizedEntries.map(([key, value]) => [key, value.trim()]),
  );
}

export async function ensureCharacterLimit(
  input: {
    accountId: string;
    serverId: string;
  },
  repository: Pick<CharacterMutationRepository, "countCharactersByServer"> = defaultRepository,
) {
  const currentCount = await repository.countCharactersByServer({
    accountId: input.accountId,
    serverId: input.serverId,
  });

  if (currentCount >= MAX_CHARACTERS_PER_SERVER) {
    throw new CharacterLimitExceededError();
  }
}

export async function ensurePassportIsUnique(
  input: {
    accountId: string;
    serverId: string;
    passportNumber: string;
    excludeCharacterId?: string;
  },
  repository: Pick<CharacterMutationRepository, "findCharacterByPassport"> = defaultRepository,
) {
  const existingCharacter = await repository.findCharacterByPassport({
    accountId: input.accountId,
    serverId: input.serverId,
    passportNumber: normalizePassportNumber(input.passportNumber),
    excludeCharacterId: input.excludeCharacterId,
  });

  if (existingCharacter) {
    throw new CharacterPassportConflictError();
  }
}

export async function createCharacterManually(
  input: CreateCharacterInput,
  repository: CharacterMutationRepository = defaultRepository,
) {
  const parsed = createCharacterInputSchema.parse(input);
  const fullName = normalizeFullName(parsed.fullName);
  const nickname = normalizeNickname({
    nickname: parsed.nickname,
    fallbackFullName: fullName,
  });
  const passportNumber = normalizePassportNumber(parsed.passportNumber);

  await ensureCharacterLimit(
    {
      accountId: parsed.accountId,
      serverId: parsed.serverId,
    },
    repository,
  );

  await ensurePassportIsUnique(
    {
      accountId: parsed.accountId,
      serverId: parsed.serverId,
      passportNumber,
    },
    repository,
  );

  return repository.createCharacterRecord({
    accountId: parsed.accountId,
    serverId: parsed.serverId,
    fullName,
    nickname,
    passportNumber,
    isProfileComplete: parsed.isProfileComplete,
    profileDataJson: normalizeProfileData(parsed.profileDataJson),
    roleKeys: uniqueRoleKeys(parsed.roleKeys),
    accessFlags: uniqueAccessFlags(parsed.accessFlags),
  });
}

export async function updateCharacterManually(
  input: UpdateCharacterInput,
  repository: CharacterMutationRepository = defaultRepository,
) {
  const parsed = updateCharacterInputSchema.parse(input);
  const existingCharacter = await repository.getCharacterByIdForAccount({
    accountId: parsed.accountId,
    characterId: parsed.characterId,
  });

  if (!existingCharacter || existingCharacter.serverId !== parsed.serverId) {
    throw new CharacterNotFoundError();
  }

  const fullName = normalizeFullName(parsed.fullName);
  const nickname = normalizeNickname({
    nickname: parsed.nickname,
    fallbackFullName: fullName,
  });
  const passportNumber = normalizePassportNumber(parsed.passportNumber);

  await ensurePassportIsUnique(
    {
      accountId: parsed.accountId,
      serverId: parsed.serverId,
      passportNumber,
      excludeCharacterId: parsed.characterId,
    },
    repository,
  );

  return repository.updateCharacterRecord({
    accountId: parsed.accountId,
    serverId: parsed.serverId,
    characterId: parsed.characterId,
    fullName,
    nickname,
    passportNumber,
    isProfileComplete: parsed.isProfileComplete,
    profileDataJson: normalizeProfileData(parsed.profileDataJson),
    roleKeys: uniqueRoleKeys(parsed.roleKeys),
    accessFlags: uniqueAccessFlags(parsed.accessFlags),
  });
}
