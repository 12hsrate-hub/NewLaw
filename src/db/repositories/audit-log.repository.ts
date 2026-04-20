import { Prisma, type AuditActionKey, type AuditLogStatus } from "@prisma/client";

import { prisma } from "@/db/prisma";

type AuditLogDb = {
  auditLog: {
    create: typeof prisma.auditLog.create;
  };
};

export async function createAuditLog(
  input: {
    actionKey: AuditActionKey;
    status: AuditLogStatus;
    actorAccountId?: string | null;
    targetAccountId?: string | null;
    comment?: string | null;
    metadataJson?: Record<string, unknown> | null;
    ipAddress?: string | null;
    userAgent?: string | null;
  },
  db: AuditLogDb = prisma,
) {
  return db.auditLog.create({
    data: {
      actionKey: input.actionKey,
      status: input.status,
      actorAccountId: input.actorAccountId ?? null,
      targetAccountId: input.targetAccountId ?? null,
      comment: input.comment ?? null,
      metadataJson:
        input.metadataJson === null
          ? Prisma.JsonNull
          : (input.metadataJson as Prisma.InputJsonValue | undefined),
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}
