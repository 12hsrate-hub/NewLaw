import type { PrismaClient } from "@prisma/client";

import { prisma } from "@/db/prisma";
import {
  createLawSourceIndexInputSchema,
  lawSourceIndexIdSchema,
  lawSourceIndexUrlSchema,
  updateLawSourceIndexEnabledInputSchema,
} from "@/schemas/law-corpus";

type PrismaLike = PrismaClient;

export async function listLawSourceIndexes(db: PrismaLike = prisma) {
  return db.lawSourceIndex.findMany({
    include: {
      server: true,
    },
    orderBy: [{ server: { sortOrder: "asc" } }, { createdAt: "asc" }],
  });
}

export async function listLawSourceIndexesByServer(serverId: string, db: PrismaLike = prisma) {
  return db.lawSourceIndex.findMany({
    where: {
      serverId: createLawSourceIndexInputSchema.shape.serverId.parse(serverId),
    },
    orderBy: [{ createdAt: "asc" }],
  });
}

export async function countLawSourceIndexesByServer(serverId: string, db: PrismaLike = prisma) {
  return db.lawSourceIndex.count({
    where: {
      serverId: createLawSourceIndexInputSchema.shape.serverId.parse(serverId),
    },
  });
}

export async function findLawSourceIndexByServerAndUrl(
  input: {
    serverId: string;
    indexUrl: string;
  },
  db: PrismaLike = prisma,
) {
  return db.lawSourceIndex.findFirst({
    where: {
      serverId: createLawSourceIndexInputSchema.shape.serverId.parse(input.serverId),
      indexUrl: lawSourceIndexUrlSchema.parse(input.indexUrl),
    },
  });
}

export async function getLawSourceIndexById(sourceIndexId: string, db: PrismaLike = prisma) {
  return db.lawSourceIndex.findUnique({
    where: {
      id: lawSourceIndexIdSchema.parse(sourceIndexId),
    },
  });
}

export async function createLawSourceIndexRecord(
  input: {
    serverId: string;
    indexUrl: string;
    isEnabled?: boolean;
  },
  db: PrismaLike = prisma,
) {
  const parsed = createLawSourceIndexInputSchema.parse(input);

  return db.lawSourceIndex.create({
    data: {
      serverId: parsed.serverId,
      indexUrl: parsed.indexUrl,
      isEnabled: input.isEnabled ?? true,
    },
  });
}

export async function updateLawSourceIndexEnabledState(
  input: {
    sourceIndexId: string;
    isEnabled: boolean;
  },
  db: PrismaLike = prisma,
) {
  const parsed = updateLawSourceIndexEnabledInputSchema.parse(input);

  return db.lawSourceIndex.update({
    where: {
      id: parsed.sourceIndexId,
    },
    data: {
      isEnabled: parsed.isEnabled,
    },
  });
}

export async function updateLawSourceIndexDiscoveryState(
  input: {
    sourceIndexId: string;
    lastDiscoveredAt: Date | null;
    lastDiscoveryStatus: "running" | "success" | "failure" | null;
    lastDiscoveryError: string | null;
  },
  db: PrismaLike = prisma,
) {
  return db.lawSourceIndex.update({
    where: {
      id: lawSourceIndexIdSchema.parse(input.sourceIndexId),
    },
    data: {
      lastDiscoveredAt: input.lastDiscoveredAt,
      lastDiscoveryStatus: input.lastDiscoveryStatus,
      lastDiscoveryError: input.lastDiscoveryError,
    },
  });
}
