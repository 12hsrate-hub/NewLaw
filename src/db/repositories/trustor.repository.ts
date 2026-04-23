import type { PrismaClient } from "@prisma/client";

import { prisma } from "@/db/prisma";
import { trustorIdSchema } from "@/schemas/trustor";

type PrismaLike = PrismaClient;

export async function listTrustorsForAccount(accountId: string, db: PrismaLike = prisma) {
  return db.trustor.findMany({
    where: {
      accountId,
      deletedAt: null,
    },
    include: {
      server: true,
    },
    orderBy: [{ serverId: "asc" }, { createdAt: "asc" }],
  });
}

export async function listTrustorsForAccountAndServer(
  input: {
    accountId: string;
    serverId: string;
  },
  db: PrismaLike = prisma,
) {
  return db.trustor.findMany({
    where: {
      accountId: input.accountId,
      serverId: input.serverId,
      deletedAt: null,
    },
    orderBy: [{ createdAt: "asc" }],
  });
}

export async function getTrustorByIdForAccount(
  input: {
    accountId: string;
    trustorId: string;
  },
  db: PrismaLike = prisma,
) {
  return db.trustor.findFirst({
    where: {
      id: trustorIdSchema.parse(input.trustorId),
      accountId: input.accountId,
      deletedAt: null,
    },
  });
}

export async function createTrustorRecord(
  input: {
    accountId: string;
    serverId: string;
    fullName: string;
    passportNumber: string;
    phone: string | null;
    icEmail: string | null;
    passportImageUrl: string | null;
    note: string | null;
  },
  db: PrismaLike = prisma,
) {
  return db.trustor.create({
    data: {
      accountId: input.accountId,
      serverId: input.serverId,
      fullName: input.fullName,
      passportNumber: input.passportNumber,
      phone: input.phone,
      icEmail: input.icEmail,
      passportImageUrl: input.passportImageUrl,
      note: input.note,
    },
  });
}

export async function updateTrustorRecord(
  input: {
    trustorId: string;
    fullName: string;
    passportNumber: string;
    phone: string | null;
    icEmail: string | null;
    passportImageUrl: string | null;
    note: string | null;
  },
  db: PrismaLike = prisma,
) {
  return db.trustor.update({
    where: {
      id: input.trustorId,
    },
    data: {
      fullName: input.fullName,
      passportNumber: input.passportNumber,
      phone: input.phone,
      icEmail: input.icEmail,
      passportImageUrl: input.passportImageUrl,
      note: input.note,
    },
  });
}

export async function softDeleteTrustorRecord(
  input: {
    trustorId: string;
  },
  db: PrismaLike = prisma,
) {
  return db.trustor.update({
    where: {
      id: input.trustorId,
    },
    data: {
      deletedAt: new Date(),
    },
  });
}
