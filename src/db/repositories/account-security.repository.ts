import type { AccountSecurityReason } from "@prisma/client";

import { prisma } from "@/db/prisma";
import {
  accountIdentitySchema,
  accountReconciliationSchema,
  mustChangePasswordStateSchema,
  pendingEmailStateSchema,
} from "@/schemas/account";

type AccountWriteDb = {
  account: {
    findUnique: typeof prisma.account.findUnique;
    findFirst: typeof prisma.account.findFirst;
    create: typeof prisma.account.create;
    update: typeof prisma.account.update;
  };
};

type AccountMutableFields = {
  isSuperAdmin?: boolean;
};

export class DirectAccountEmailUpdateError extends Error {
  constructor() {
    super("Account.email можно менять только через security use-case слой");
    this.name = "DirectAccountEmailUpdateError";
  }
}

export function assertNoDirectAccountEmailUpdate(input: Record<string, unknown>) {
  if ("email" in input) {
    throw new DirectAccountEmailUpdateError();
  }
}

export async function isAccountLoginTaken(
  login: string,
  excludeAccountId?: string,
  db: AccountWriteDb = prisma,
) {
  const existingAccount = await db.account.findFirst({
    where: {
      login: login.trim().toLowerCase(),
      id: excludeAccountId
        ? {
            not: excludeAccountId,
          }
        : undefined,
    },
    select: {
      id: true,
    },
  });

  return Boolean(existingAccount);
}

export async function createAccountFromReconciliation(
  input: {
    id: string;
    email: string;
    login: string;
  },
  db: AccountWriteDb = prisma,
) {
  const parsed = accountReconciliationSchema.parse(input);

  if (!parsed.login) {
    throw new Error("Account login is required for account creation");
  }

  return db.account.create({
    data: {
      id: parsed.id,
      email: parsed.email,
      login: parsed.login,
    },
  });
}

export async function syncAccountIdentityState(
  input: {
    accountId: string;
    email: string;
    login?: string;
    clearPendingEmail?: boolean;
  },
  db: AccountWriteDb = prisma,
) {
  const parsedIdentity = accountIdentitySchema.parse({
    id: input.accountId,
    email: input.email,
  });

  const updatePayload: {
    email: string;
    login?: string;
  } = {
    email: parsedIdentity.email,
  };

  if (input.login) {
    updatePayload.login = input.login;
  }

  return db.account.update({
    where: {
      id: parsedIdentity.id,
    },
    data: {
      ...updatePayload,
      pendingEmail: input.clearPendingEmail ? null : undefined,
      pendingEmailRequestedAt: input.clearPendingEmail ? null : undefined,
    },
  });
}

export async function updatePendingEmailState(
  input: {
    accountId: string;
    pendingEmail: string | null;
    requestedAt: Date | null;
  },
  db: AccountWriteDb = prisma,
) {
  const parsed = pendingEmailStateSchema.parse(input);

  return db.account.update({
    where: {
      id: parsed.accountId,
    },
    data: {
      pendingEmail: parsed.pendingEmail,
      pendingEmailRequestedAt: parsed.requestedAt,
    },
  });
}

export async function clearPendingEmailState(accountId: string, db: AccountWriteDb = prisma) {
  return db.account.update({
    where: {
      id: accountId,
    },
    data: {
      pendingEmail: null,
      pendingEmailRequestedAt: null,
    },
  });
}

export async function updateMustChangePasswordState(
  input: {
    accountId: string;
    mustChangePassword: boolean;
    reason: AccountSecurityReason | null;
    changedAt?: Date | null;
  },
  db: AccountWriteDb = prisma,
) {
  const parsed = mustChangePasswordStateSchema.parse(input);

  return db.account.update({
    where: {
      id: parsed.accountId,
    },
    data: {
      mustChangePassword: parsed.mustChangePassword,
      mustChangePasswordReason: parsed.mustChangePassword ? parsed.reason : null,
      passwordChangedAt: parsed.changedAt ?? undefined,
    },
  });
}

export async function updateAccountMutableFields(
  accountId: string,
  input: AccountMutableFields & Record<string, unknown>,
  db: AccountWriteDb = prisma,
) {
  assertNoDirectAccountEmailUpdate(input);

  return db.account.update({
    where: {
      id: accountId,
    },
    data: {
      isSuperAdmin:
        typeof input.isSuperAdmin === "boolean" ? input.isSuperAdmin : undefined,
    },
  });
}
