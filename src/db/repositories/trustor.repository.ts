import type { PrismaClient } from "@prisma/client";

import { prisma } from "@/db/prisma";

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
