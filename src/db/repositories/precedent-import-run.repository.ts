import type { PrismaClient } from "@prisma/client";

import { prisma } from "@/db/prisma";
import {
  createPrecedentImportRunInputSchema,
  finishPrecedentImportRunInputSchema,
} from "@/schemas/precedent-corpus";

type PrismaLike = PrismaClient;

export async function getActivePrecedentImportRunByLockKey(
  lockKey: string,
  db: PrismaLike = prisma,
) {
  return db.precedentImportRun.findFirst({
    where: {
      lockKey,
      status: "running",
    },
  });
}

export async function createPrecedentImportRunRecord(
  input: {
    serverId: string;
    sourceIndexId?: string | null;
    sourceTopicId?: string | null;
    mode: "discovery" | "import_source_topic";
    status?: "running" | "success" | "failure";
    lockKey?: string | null;
  },
  db: PrismaLike = prisma,
) {
  const parsed = createPrecedentImportRunInputSchema.parse(input);

  return db.precedentImportRun.create({
    data: {
      serverId: parsed.serverId,
      sourceIndexId: parsed.sourceIndexId ?? null,
      sourceTopicId: parsed.sourceTopicId ?? null,
      mode: parsed.mode,
      status: input.status ?? "running",
      lockKey: input.lockKey ?? null,
    },
  });
}

export async function finishPrecedentImportRunRecord(
  input: {
    runId: string;
    status: "running" | "success" | "failure";
    summary?: string | null;
    error?: string | null;
  },
  db: PrismaLike = prisma,
) {
  const parsed = finishPrecedentImportRunInputSchema.parse(input);

  return db.precedentImportRun.update({
    where: {
      id: parsed.runId,
    },
    data: {
      status: parsed.status,
      summary: parsed.summary ?? null,
      error: parsed.error ?? null,
      finishedAt: parsed.status === "running" ? null : new Date(),
      lockKey: parsed.status === "running" ? undefined : null,
    },
  });
}
