import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/db/prisma";
import { characterIdSchema } from "@/schemas/character";
import { activeServerSelectionSchema } from "@/schemas/server";

type PrismaLike = PrismaClient;
const accountIdSchema = z.string().uuid();

export async function getUserServerStates(accountId: string, db: PrismaLike = prisma) {
  return db.userServerState.findMany({
    where: {
      accountId,
    },
    orderBy: [{ lastSelectedAt: "desc" }, { updatedAt: "desc" }],
  });
}

export async function getUserServerState(
  input: {
    accountId: string;
    serverId: string;
  },
  db: PrismaLike = prisma,
) {
  const parsed = activeServerSelectionSchema.extend({
    accountId: accountIdSchema,
  }).parse(input);

  return db.userServerState.findUnique({
    where: {
      accountId_serverId: {
        accountId: parsed.accountId,
        serverId: parsed.serverId,
      },
    },
  });
}

export async function ensureUserServerState(
  input: {
    accountId: string;
    serverId: string;
  },
  db: PrismaLike = prisma,
) {
  const parsed = activeServerSelectionSchema.extend({
    accountId: accountIdSchema,
  }).parse(input);

  return db.userServerState.upsert({
    where: {
      accountId_serverId: {
        accountId: parsed.accountId,
        serverId: parsed.serverId,
      },
    },
    update: {},
    create: {
      accountId: parsed.accountId,
      serverId: parsed.serverId,
    },
  });
}

export async function selectActiveServer(
  input: {
    accountId: string;
    serverId: string;
  },
  db: PrismaLike = prisma,
) {
  const parsed = activeServerSelectionSchema.extend({
    accountId: accountIdSchema,
  }).parse(input);

  return db.userServerState.upsert({
    where: {
      accountId_serverId: {
        accountId: parsed.accountId,
        serverId: parsed.serverId,
      },
    },
    update: {
      lastSelectedAt: new Date(),
    },
    create: {
      accountId: parsed.accountId,
      serverId: parsed.serverId,
      lastSelectedAt: new Date(),
    },
  });
}

export async function selectActiveCharacter(
  input: {
    accountId: string;
    serverId: string;
    characterId: string | null;
  },
  db: PrismaLike = prisma,
) {
  const parsedAccountId = accountIdSchema.parse(input.accountId);
  const parsedServerId = activeServerSelectionSchema.shape.serverId.parse(input.serverId);
  const parsedCharacterId = input.characterId === null ? null : characterIdSchema.parse(input.characterId);

  return db.userServerState.upsert({
    where: {
      accountId_serverId: {
        accountId: parsedAccountId,
        serverId: parsedServerId,
      },
    },
    update: {
      activeCharacterId: parsedCharacterId,
      lastSelectedAt: new Date(),
    },
    create: {
      accountId: parsedAccountId,
      serverId: parsedServerId,
      activeCharacterId: parsedCharacterId,
      lastSelectedAt: new Date(),
    },
  });
}

export async function setInitialDefaultCharacterIfMissing(
  input: {
    accountId: string;
    serverId: string;
    characterId: string;
  },
  db: PrismaLike = prisma,
) {
  const parsedAccountId = accountIdSchema.parse(input.accountId);
  const parsedServerId = activeServerSelectionSchema.shape.serverId.parse(input.serverId);
  const parsedCharacterId = characterIdSchema.parse(input.characterId);

  const existingState = await db.userServerState.findUnique({
    where: {
      accountId_serverId: {
        accountId: parsedAccountId,
        serverId: parsedServerId,
      },
    },
  });

  if (existingState?.activeCharacterId) {
    return existingState;
  }

  if (existingState) {
    return db.userServerState.update({
      where: {
        id: existingState.id,
      },
      data: {
        activeCharacterId: parsedCharacterId,
      },
    });
  }

  return db.userServerState.create({
    data: {
      accountId: parsedAccountId,
      serverId: parsedServerId,
      activeCharacterId: parsedCharacterId,
    },
  });
}
