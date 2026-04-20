import type { PrismaClient } from "@prisma/client";

import { prisma } from "@/db/prisma";
import {
  createPrecedentSourceTopicRecordInputSchema,
  precedentSourceTopicIdSchema,
  precedentSourceTopicManualOverrideSchema,
} from "@/schemas/precedent-corpus";

type PrismaLike = PrismaClient;

export async function listPrecedentSourceTopics(db: PrismaLike = prisma) {
  return db.precedentSourceTopic.findMany({
    include: {
      server: true,
      sourceIndex: true,
      _count: {
        select: {
          precedents: true,
        },
      },
    },
    orderBy: [{ server: { sortOrder: "asc" } }, { createdAt: "asc" }],
  });
}

export async function listPrecedentSourceTopicsByServer(serverId: string, db: PrismaLike = prisma) {
  return db.precedentSourceTopic.findMany({
    where: {
      serverId: createPrecedentSourceTopicRecordInputSchema.shape.serverId.parse(serverId),
    },
    include: {
      sourceIndex: true,
      _count: {
        select: {
          precedents: true,
        },
      },
    },
    orderBy: [{ createdAt: "asc" }],
  });
}

export async function getPrecedentSourceTopicById(
  sourceTopicId: string,
  db: PrismaLike = prisma,
) {
  return db.precedentSourceTopic.findUnique({
    where: {
      id: precedentSourceTopicIdSchema.parse(sourceTopicId),
    },
    include: {
      sourceIndex: true,
    },
  });
}

export async function findPrecedentSourceTopicByServerAndTopicExternalId(
  input: {
    serverId: string;
    topicExternalId: string;
  },
  db: PrismaLike = prisma,
) {
  return db.precedentSourceTopic.findFirst({
    where: {
      serverId: createPrecedentSourceTopicRecordInputSchema.shape.serverId.parse(input.serverId),
      topicExternalId: createPrecedentSourceTopicRecordInputSchema.shape.topicExternalId.parse(
        input.topicExternalId,
      ),
    },
  });
}

export async function createPrecedentSourceTopicRecord(
  input: {
    serverId: string;
    sourceIndexId: string;
    topicUrl: string;
    topicExternalId: string;
    title: string;
    isExcluded?: boolean;
    classificationOverride?: "precedent" | "ignored" | null;
    internalNote?: string | null;
  },
  db: PrismaLike = prisma,
) {
  const parsed = createPrecedentSourceTopicRecordInputSchema.parse(input);

  return db.precedentSourceTopic.create({
    data: {
      serverId: parsed.serverId,
      sourceIndexId: parsed.sourceIndexId,
      topicUrl: parsed.topicUrl,
      topicExternalId: parsed.topicExternalId,
      title: parsed.title,
      isExcluded: parsed.isExcluded ?? false,
      classificationOverride: parsed.classificationOverride ?? null,
      internalNote: parsed.internalNote ?? null,
    },
  });
}

export async function updatePrecedentSourceTopicManualOverride(
  input: {
    sourceTopicId: string;
    isExcluded: boolean;
    classificationOverride?: "precedent" | "ignored" | null;
    internalNote?: string | null;
  },
  db: PrismaLike = prisma,
) {
  const parsed = precedentSourceTopicManualOverrideSchema.parse(input);

  return db.precedentSourceTopic.update({
    where: {
      id: parsed.sourceTopicId,
    },
    data: {
      isExcluded: parsed.isExcluded,
      classificationOverride: parsed.classificationOverride ?? null,
      internalNote: parsed.internalNote ?? null,
    },
  });
}

export async function updatePrecedentSourceTopicDiscoveryState(
  input: {
    sourceTopicId: string;
    lastDiscoveredAt: Date | null;
    lastDiscoveryStatus: "running" | "success" | "failure" | null;
    lastDiscoveryError: string | null;
  },
  db: PrismaLike = prisma,
) {
  return db.precedentSourceTopic.update({
    where: {
      id: precedentSourceTopicIdSchema.parse(input.sourceTopicId),
    },
    data: {
      lastDiscoveredAt: input.lastDiscoveredAt,
      lastDiscoveryStatus: input.lastDiscoveryStatus,
      lastDiscoveryError: input.lastDiscoveryError,
    },
  });
}
