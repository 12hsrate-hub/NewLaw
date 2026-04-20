import type { PrismaClient } from "@prisma/client";

import { prisma } from "@/db/prisma";
import {
  createLawVersionInputSchema,
  lawVersionIdSchema,
  updateLawVersionStatusInputSchema,
} from "@/schemas/law-corpus";

type PrismaLike = PrismaClient;

type LawVersionMutableFields = {
  status?: "imported_draft" | "current" | "superseded";
  confirmedAt?: Date | null;
  confirmedByAccountId?: string | null;
};

export class DirectLawTextUpdateError extends Error {
  constructor() {
    super("Текст закона можно менять только через import snapshot слой");
    this.name = "DirectLawTextUpdateError";
  }
}

export function assertNoDirectLawTextUpdate(input: Record<string, unknown>) {
  if (
    "normalizedFullText" in input ||
    "sourceSnapshotHash" in input ||
    "normalizedTextHash" in input
  ) {
    throw new DirectLawTextUpdateError();
  }
}

export async function getLawVersionById(lawVersionId: string, db: PrismaLike = prisma) {
  return db.lawVersion.findUnique({
    where: {
      id: lawVersionIdSchema.parse(lawVersionId),
    },
  });
}

export async function findLawVersionByNormalizedHash(
  input: {
    lawId: string;
    normalizedTextHash: string;
  },
  db: PrismaLike = prisma,
) {
  return db.lawVersion.findFirst({
    where: {
      lawId: createLawVersionInputSchema.shape.lawId.parse(input.lawId),
      normalizedTextHash: createLawVersionInputSchema.shape.normalizedTextHash.parse(
        input.normalizedTextHash,
      ),
    },
  });
}

export async function createLawVersionRecord(
  input: {
    lawId: string;
    status?: "imported_draft" | "current" | "superseded";
    normalizedFullText: string;
    sourceSnapshotHash: string;
    normalizedTextHash: string;
    importedAt?: Date;
  },
  db: PrismaLike = prisma,
) {
  const parsed = createLawVersionInputSchema.parse(input);

  return db.lawVersion.create({
    data: {
      lawId: parsed.lawId,
      status: parsed.status,
      normalizedFullText: parsed.normalizedFullText,
      sourceSnapshotHash: parsed.sourceSnapshotHash,
      normalizedTextHash: parsed.normalizedTextHash,
      importedAt: parsed.importedAt ?? new Date(),
    },
  });
}

export async function updateLawVersionMutableFields(
  lawVersionId: string,
  input: LawVersionMutableFields & Record<string, unknown>,
  db: PrismaLike = prisma,
) {
  assertNoDirectLawTextUpdate(input);
  const parsed = updateLawVersionStatusInputSchema.partial().parse({
    lawVersionId,
    ...input,
  });

  return db.lawVersion.update({
    where: {
      id: parsed.lawVersionId,
    },
    data: {
      status: parsed.status,
      confirmedAt: "confirmedAt" in parsed ? parsed.confirmedAt ?? null : undefined,
      confirmedByAccountId:
        "confirmedByAccountId" in parsed ? parsed.confirmedByAccountId ?? null : undefined,
    },
  });
}

export async function listLawVersionsByLaw(lawId: string, db: PrismaLike = prisma) {
  return db.lawVersion.findMany({
    where: {
      lawId: createLawVersionInputSchema.shape.lawId.parse(lawId),
    },
    orderBy: [{ importedAt: "desc" }],
  });
}
