import type { PrismaClient } from "@prisma/client";

import { prisma } from "@/db/prisma";
import {
  createLawImportRunInputSchema,
  finishLawImportRunInputSchema,
} from "@/schemas/law-corpus";

type PrismaLike = PrismaClient;

export async function getActiveLawImportRunByLockKey(
  lockKey: string,
  db: PrismaLike = prisma,
) {
  return db.lawImportRun.findFirst({
    where: {
      lockKey,
      status: "running",
    },
  });
}

export async function createLawImportRunRecord(
  input: {
    serverId: string;
    sourceIndexId?: string | null;
    mode: "discovery" | "import_law";
    status?: "running" | "success" | "failure";
    lockKey?: string | null;
  },
  db: PrismaLike = prisma,
) {
  const parsed = createLawImportRunInputSchema.parse(input);

  return db.lawImportRun.create({
    data: {
      serverId: parsed.serverId,
      sourceIndexId: parsed.sourceIndexId ?? null,
      mode: parsed.mode,
      status: input.status ?? "running",
      lockKey: input.lockKey ?? null,
    },
  });
}

export async function finishLawImportRunRecord(
  input: {
    runId: string;
    status: "running" | "success" | "failure";
    summary?: string | null;
    error?: string | null;
  },
  db: PrismaLike = prisma,
) {
  const parsed = finishLawImportRunInputSchema.parse(input);

  return db.lawImportRun.update({
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

export async function listLawImportRunsByServer(serverId: string, db: PrismaLike = prisma) {
  return db.lawImportRun.findMany({
    where: {
      serverId: createLawImportRunInputSchema.shape.serverId.parse(serverId),
    },
    orderBy: [{ startedAt: "desc" }],
  });
}
