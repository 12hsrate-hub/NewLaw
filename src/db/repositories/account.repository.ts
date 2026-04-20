import type { PrismaClient } from "@prisma/client";

import { prisma } from "@/db/prisma";
import { accountIdentitySchema, type AccountIdentityInput } from "@/schemas/account";

type PrismaLike = PrismaClient;

export async function getAccountById(accountId: string, db: PrismaLike = prisma) {
  return db.account.findUnique({
    where: {
      id: accountId,
    },
  });
}

export async function upsertAccountFromAuthUser(input: AccountIdentityInput, db: PrismaLike = prisma) {
  const parsed = accountIdentitySchema.parse(input);

  return db.account.upsert({
    where: {
      id: parsed.id,
    },
    update: {
      email: parsed.email,
    },
    create: {
      id: parsed.id,
      email: parsed.email,
    },
  });
}
