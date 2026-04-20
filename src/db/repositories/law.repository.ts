import type { PrismaClient } from "@prisma/client";

import { prisma } from "@/db/prisma";
import {
  lawIdSchema,
  lawKeySchema,
  lawManualOverrideSchema,
  lawSourceIndexUrlSchema,
  registerLawInputSchema,
} from "@/schemas/law-corpus";

type PrismaLike = PrismaClient;

export async function listLawsByServer(serverId: string, db: PrismaLike = prisma) {
  return db.law.findMany({
    where: {
      serverId: registerLawInputSchema.shape.serverId.parse(serverId),
    },
    orderBy: [{ createdAt: "asc" }],
  });
}

export async function getLawById(lawId: string, db: PrismaLike = prisma) {
  return db.law.findUnique({
    where: {
      id: lawIdSchema.parse(lawId),
    },
  });
}

export async function getLawByServerAndTopicExternalId(
  input: {
    serverId: string;
    topicExternalId: string;
  },
  db: PrismaLike = prisma,
) {
  const parsed = registerLawInputSchema.pick({
    serverId: true,
    topicExternalId: true,
  }).parse(input);

  return db.law.findFirst({
    where: {
      serverId: parsed.serverId,
      topicExternalId: parsed.topicExternalId,
    },
  });
}

export async function getLawByServerAndLawKey(
  input: {
    serverId: string;
    lawKey: string;
  },
  db: PrismaLike = prisma,
) {
  return db.law.findFirst({
    where: {
      serverId: registerLawInputSchema.shape.serverId.parse(input.serverId),
      lawKey: lawKeySchema.parse(input.lawKey),
    },
  });
}

export async function createLawRecord(
  input: {
    serverId: string;
    lawKey: string;
    title: string;
    topicUrl: string;
    topicExternalId: string;
    lawKind: "primary" | "supplement";
    relatedPrimaryLawId?: string | null;
    isExcluded?: boolean;
    classificationOverride?: "primary" | "supplement" | null;
    internalNote?: string | null;
  },
  db: PrismaLike = prisma,
) {
  const parsed = registerLawInputSchema.extend({
    lawKey: lawKeySchema,
  }).parse(input);

  return db.law.create({
    data: {
      serverId: parsed.serverId,
      lawKey: parsed.lawKey,
      title: parsed.title,
      topicUrl: lawSourceIndexUrlSchema.parse(parsed.topicUrl),
      topicExternalId: parsed.topicExternalId,
      lawKind: parsed.lawKind,
      relatedPrimaryLawId: parsed.relatedPrimaryLawId ?? null,
      isExcluded: parsed.isExcluded ?? false,
      classificationOverride: parsed.classificationOverride ?? null,
      internalNote: parsed.internalNote ?? null,
    },
  });
}

export async function updateLawManualOverride(
  input: {
    lawId: string;
    isExcluded: boolean;
    classificationOverride?: "primary" | "supplement" | null;
    internalNote?: string | null;
  },
  db: PrismaLike = prisma,
) {
  const parsed = lawManualOverrideSchema.parse(input);

  return db.law.update({
    where: {
      id: parsed.lawId,
    },
    data: {
      isExcluded: parsed.isExcluded,
      classificationOverride: parsed.classificationOverride ?? null,
      internalNote: parsed.internalNote ?? null,
    },
  });
}

export async function setCurrentLawVersion(
  input: {
    lawId: string;
    lawVersionId: string | null;
  },
  db: PrismaLike = prisma,
) {
  return db.law.update({
    where: {
      id: lawIdSchema.parse(input.lawId),
    },
    data: {
      currentVersionId: input.lawVersionId,
    },
  });
}
