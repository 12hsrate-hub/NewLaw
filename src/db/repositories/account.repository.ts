import { prisma } from "@/db/prisma";

type AccountReadDb = {
  account: {
    findUnique: typeof prisma.account.findUnique;
    findFirst: typeof prisma.account.findFirst;
  };
};

export async function getAccountById(accountId: string, db: AccountReadDb = prisma) {
  return db.account.findUnique({
    where: {
      id: accountId,
    },
  });
}

export async function getAccountByEmail(email: string, db: AccountReadDb = prisma) {
  return db.account.findUnique({
    where: {
      email: email.trim().toLowerCase(),
    },
  });
}

export async function getAccountByLogin(login: string, db: AccountReadDb = prisma) {
  return db.account.findFirst({
    where: {
      login: login.trim().toLowerCase(),
    },
  });
}
