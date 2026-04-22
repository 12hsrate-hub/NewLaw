import type { PrismaClient, Prisma, ForumConnectionState } from "@prisma/client";

import { prisma } from "@/db/prisma";
import {
  FORUM_GTA5RP_PROVIDER_KEY,
  forumConnectionProviderKeySchema,
} from "@/schemas/forum-integration";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

export async function getForumSessionConnectionByAccount(
  input: {
    accountId: string;
    providerKey?: string;
  },
  db: PrismaLike = prisma,
) {
  return db.forumSessionConnection.findUnique({
    where: {
      accountId_providerKey: {
        accountId: input.accountId,
        providerKey: forumConnectionProviderKeySchema.parse(
          input.providerKey ?? FORUM_GTA5RP_PROVIDER_KEY,
        ),
      },
    },
  });
}

export async function upsertForumSessionConnection(
  input: {
    accountId: string;
    providerKey?: string;
    encryptedSessionPayload: string;
    state: ForumConnectionState;
  },
  db: PrismaLike = prisma,
) {
  const providerKey = forumConnectionProviderKeySchema.parse(
    input.providerKey ?? FORUM_GTA5RP_PROVIDER_KEY,
  );

  return db.forumSessionConnection.upsert({
    where: {
      accountId_providerKey: {
        accountId: input.accountId,
        providerKey,
      },
    },
    create: {
      accountId: input.accountId,
      providerKey,
      encryptedSessionPayload: input.encryptedSessionPayload,
      state: input.state,
      forumUserId: null,
      forumUsername: null,
      validatedAt: null,
      lastValidationError: null,
      disabledAt: null,
    },
    update: {
      encryptedSessionPayload: input.encryptedSessionPayload,
      state: input.state,
      forumUserId: null,
      forumUsername: null,
      validatedAt: null,
      lastValidationError: null,
      disabledAt: null,
    },
  });
}

export async function updateForumSessionConnectionState(
  input: {
    connectionId: string;
    state: ForumConnectionState;
    forumUserId: string | null;
    forumUsername: string | null;
    validatedAt: Date | null;
    lastValidationError: string | null;
    disabledAt: Date | null;
    encryptedSessionPayload?: string | null;
  },
  db: PrismaLike = prisma,
) {
  return db.forumSessionConnection.update({
    where: {
      id: input.connectionId,
    },
    data: {
      state: input.state,
      forumUserId: input.forumUserId,
      forumUsername: input.forumUsername,
      validatedAt: input.validatedAt,
      lastValidationError: input.lastValidationError,
      disabledAt: input.disabledAt,
      encryptedSessionPayload:
        input.encryptedSessionPayload === undefined
          ? undefined
          : input.encryptedSessionPayload,
    },
  });
}
