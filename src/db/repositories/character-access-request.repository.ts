import { type Prisma, type PrismaClient } from "@prisma/client";

import { prisma } from "@/db/prisma";
import {
  characterIdSchema,
  type CharacterAccessRequestType,
} from "@/schemas/character";

type PrismaLike = PrismaClient;

export type CharacterAccessRequestRecord = Prisma.CharacterAccessRequestGetPayload<{
  include: {
    character: true;
  };
}>;

export type CharacterAccessRequestListItem = Prisma.CharacterAccessRequestGetPayload<{
  select: {
    id: true;
    accountId: true;
    serverId: true;
    characterId: true;
    requestType: true;
    status: true;
    requestComment: true;
    reviewComment: true;
    reviewedByAccountId: true;
    reviewedAt: true;
    createdAt: true;
    updatedAt: true;
  };
}>;

type FindPendingCharacterAccessRequestInput = {
  characterId: string;
  requestType: CharacterAccessRequestType;
};

type CreateCharacterAccessRequestRecordInput = {
  accountId: string;
  serverId: string;
  characterId: string;
  requestType: CharacterAccessRequestType;
  requestComment: string | null;
};

export async function findPendingCharacterAccessRequest(
  input: FindPendingCharacterAccessRequestInput,
  db: PrismaLike = prisma,
): Promise<CharacterAccessRequestRecord | null> {
  return db.characterAccessRequest.findFirst({
    where: {
      characterId: characterIdSchema.parse(input.characterId),
      requestType: input.requestType,
      status: "pending",
    },
    include: {
      character: true,
    },
  });
}

export async function createCharacterAccessRequestRecord(
  input: CreateCharacterAccessRequestRecordInput,
  db: PrismaLike = prisma,
): Promise<CharacterAccessRequestRecord> {
  return db.characterAccessRequest.create({
    data: {
      accountId: input.accountId,
      serverId: input.serverId,
      characterId: characterIdSchema.parse(input.characterId),
      requestType: input.requestType,
      requestComment: input.requestComment,
    },
    include: {
      character: true,
    },
  });
}

export async function listCharacterAccessRequestsForAccount(
  accountId: string,
  db: PrismaLike = prisma,
): Promise<CharacterAccessRequestListItem[]> {
  return db.characterAccessRequest.findMany({
    where: {
      accountId,
    },
    select: {
      id: true,
      accountId: true,
      serverId: true,
      characterId: true,
      requestType: true,
      status: true,
      requestComment: true,
      reviewComment: true,
      reviewedByAccountId: true,
      reviewedAt: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ createdAt: "desc" }],
  });
}
