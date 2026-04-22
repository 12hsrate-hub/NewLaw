import type { PrismaClient } from "@prisma/client";

import { prisma } from "@/db/prisma";
import {
  type CharacterAccessFlagKey,
  characterIdSchema,
  type CharacterRoleKey,
} from "@/schemas/character";
import { getCharactersByServerSchema } from "@/schemas/server";

type PrismaLike = PrismaClient;

type CharacterQueryInput = {
  accountId: string;
  serverId: string;
};

type FindCharacterByPassportInput = CharacterQueryInput & {
  passportNumber: string;
  excludeCharacterId?: string;
};

type CreateCharacterRecordInput = {
  accountId: string;
  serverId: string;
  fullName: string;
  nickname: string;
  passportNumber: string;
  roleKeys: CharacterRoleKey[];
  accessFlags: CharacterAccessFlagKey[];
};

type UpdateCharacterRecordInput = CreateCharacterRecordInput & {
  characterId: string;
};

export async function getCharactersByServer(input: CharacterQueryInput, db: PrismaLike = prisma) {
  const parsed = getCharactersByServerSchema.parse(input);

  return db.character.findMany({
    where: {
      accountId: parsed.accountId,
      serverId: parsed.serverId,
      deletedAt: null,
    },
    include: {
      roles: true,
      accessFlags: true,
    },
    orderBy: [{ createdAt: "asc" }],
  });
}

export async function listCharactersForAccount(accountId: string, db: PrismaLike = prisma) {
  return db.character.findMany({
    where: {
      accountId,
      deletedAt: null,
    },
    include: {
      roles: true,
      accessFlags: true,
    },
    orderBy: [{ serverId: "asc" }, { createdAt: "asc" }],
  });
}

export async function getCharacterByIdForAccount(
  input: {
    accountId: string;
    characterId: string;
  },
  db: PrismaLike = prisma,
) {
  return db.character.findFirst({
    where: {
      id: characterIdSchema.parse(input.characterId),
      accountId: input.accountId,
      deletedAt: null,
    },
    include: {
      roles: true,
      accessFlags: true,
    },
  });
}

export async function countCharactersByServer(input: CharacterQueryInput, db: PrismaLike = prisma) {
  const parsed = getCharactersByServerSchema.parse(input);

  return db.character.count({
    where: {
      accountId: parsed.accountId,
      serverId: parsed.serverId,
      deletedAt: null,
    },
  });
}

export async function findCharacterByPassport(
  input: FindCharacterByPassportInput,
  db: PrismaLike = prisma,
) {
  const parsed = getCharactersByServerSchema.parse(input);

  return db.character.findFirst({
    where: {
      accountId: parsed.accountId,
      serverId: parsed.serverId,
      passportNumber: input.passportNumber,
      deletedAt: null,
      id: input.excludeCharacterId
        ? {
            not: input.excludeCharacterId,
          }
        : undefined,
    },
  });
}

export async function createCharacterRecord(
  input: CreateCharacterRecordInput,
  db: PrismaLike = prisma,
) {
  return db.character.create({
    data: {
      accountId: input.accountId,
      serverId: input.serverId,
      fullName: input.fullName,
      nickname: input.nickname,
      passportNumber: input.passportNumber,
      roles: {
        createMany: {
          data: input.roleKeys.map((roleKey) => ({ roleKey })),
        },
      },
      accessFlags: {
        createMany: {
          data: input.accessFlags.map((flagKey) => ({ flagKey })),
        },
      },
    },
    include: {
      roles: true,
      accessFlags: true,
    },
  });
}

export async function updateCharacterRecord(
  input: UpdateCharacterRecordInput,
  db: PrismaLike = prisma,
) {
  return db.character.update({
    where: {
      id: input.characterId,
    },
    data: {
      fullName: input.fullName,
      nickname: input.nickname,
      passportNumber: input.passportNumber,
      roles: {
        deleteMany: {},
        createMany: {
          data: input.roleKeys.map((roleKey) => ({ roleKey })),
        },
      },
      accessFlags: {
        deleteMany: {},
        createMany: {
          data: input.accessFlags.map((flagKey) => ({ flagKey })),
        },
      },
    },
    include: {
      roles: true,
      accessFlags: true,
    },
  });
}
