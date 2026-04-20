import type { PrismaClient } from "@prisma/client";

import { prisma } from "@/db/prisma";
import {
  createPrecedentVersionInputSchema,
  precedentVersionIdSchema,
  updatePrecedentVersionStatusInputSchema,
} from "@/schemas/precedent-corpus";

type PrismaLike = PrismaClient;

type PrecedentVersionMutableFields = {
  status?: "imported_draft" | "current" | "superseded";
  confirmedAt?: Date | null;
  confirmedByAccountId?: string | null;
};

export class DirectPrecedentTextUpdateError extends Error {
  constructor() {
    super("Текст прецедента можно менять только через snapshot/import слой");
    this.name = "DirectPrecedentTextUpdateError";
  }
}

export function assertNoDirectPrecedentTextUpdate(input: Record<string, unknown>) {
  if (
    "normalizedFullText" in input ||
    "sourceSnapshotHash" in input ||
    "normalizedTextHash" in input
  ) {
    throw new DirectPrecedentTextUpdateError();
  }
}

export async function getPrecedentVersionById(
  precedentVersionId: string,
  db: PrismaLike = prisma,
) {
  return db.precedentVersion.findUnique({
    where: {
      id: precedentVersionIdSchema.parse(precedentVersionId),
    },
  });
}

export async function findPrecedentVersionByNormalizedHash(
  input: {
    precedentId: string;
    normalizedTextHash: string;
  },
  db: PrismaLike = prisma,
) {
  return db.precedentVersion.findFirst({
    where: {
      precedentId: createPrecedentVersionInputSchema.shape.precedentId.parse(input.precedentId),
      normalizedTextHash: createPrecedentVersionInputSchema.shape.normalizedTextHash.parse(
        input.normalizedTextHash,
      ),
    },
  });
}

export async function createPrecedentVersionRecord(
  input: {
    precedentId: string;
    status?: "imported_draft" | "current" | "superseded";
    normalizedFullText: string;
    sourceSnapshotHash: string;
    normalizedTextHash: string;
    importedAt?: Date;
  },
  db: PrismaLike = prisma,
) {
  const parsed = createPrecedentVersionInputSchema.parse(input);

  return db.precedentVersion.create({
    data: {
      precedentId: parsed.precedentId,
      status: parsed.status,
      normalizedFullText: parsed.normalizedFullText,
      sourceSnapshotHash: parsed.sourceSnapshotHash,
      normalizedTextHash: parsed.normalizedTextHash,
      importedAt: parsed.importedAt ?? new Date(),
    },
  });
}

export async function updatePrecedentVersionMutableFields(
  precedentVersionId: string,
  input: PrecedentVersionMutableFields & Record<string, unknown>,
  db: PrismaLike = prisma,
) {
  assertNoDirectPrecedentTextUpdate(input);
  const parsed = updatePrecedentVersionStatusInputSchema.partial().parse({
    precedentVersionId,
    ...input,
  });

  return db.precedentVersion.update({
    where: {
      id: parsed.precedentVersionId,
    },
    data: {
      status: parsed.status,
      confirmedAt: "confirmedAt" in parsed ? parsed.confirmedAt ?? null : undefined,
      confirmedByAccountId:
        "confirmedByAccountId" in parsed ? parsed.confirmedByAccountId ?? null : undefined,
    },
  });
}

export async function listPrecedentVersionsByPrecedent(
  precedentId: string,
  db: PrismaLike = prisma,
) {
  return db.precedentVersion.findMany({
    where: {
      precedentId: createPrecedentVersionInputSchema.shape.precedentId.parse(precedentId),
    },
    orderBy: [{ importedAt: "desc" }],
  });
}
