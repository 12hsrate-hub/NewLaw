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
    include: {
      currentVersion: true,
      versions: {
        orderBy: [{ importedAt: "desc" }],
        take: 1,
      },
      _count: {
        select: {
          versions: true,
        },
      },
    },
    orderBy: [{ createdAt: "asc" }],
  });
}

export async function listLaws(db: PrismaLike = prisma) {
  return db.law.findMany({
    include: {
      server: true,
      currentVersion: true,
      versions: {
        orderBy: [{ importedAt: "desc" }],
        take: 1,
      },
      _count: {
        select: {
          versions: true,
        },
      },
    },
    orderBy: [{ server: { sortOrder: "asc" } }, { title: "asc" }],
  });
}

export async function listLawsForAdminReview(db: PrismaLike = prisma) {
  return db.law.findMany({
    include: {
      server: true,
      currentVersion: {
        include: {
          _count: {
            select: {
              sourcePosts: true,
              blocks: true,
            },
          },
        },
      },
      versions: {
        include: {
          confirmedByAccount: true,
          _count: {
            select: {
              sourcePosts: true,
              blocks: true,
            },
          },
        },
        orderBy: [{ importedAt: "desc" }],
      },
      _count: {
        select: {
          versions: true,
        },
      },
    },
    orderBy: [{ server: { sortOrder: "asc" } }, { title: "asc" }],
  });
}

export async function listCurrentLawBlocksByServer(
  input: {
    serverId: string;
    includeSupplements?: boolean;
  },
  db: PrismaLike = prisma,
) {
  const parsedServerId = registerLawInputSchema.shape.serverId.parse(input.serverId);

  return db.lawBlock.findMany({
    where: {
      lawVersion: {
        status: "current",
        currentForLaw: {
          is: {
            serverId: parsedServerId,
            isExcluded: false,
            lawKind: input.includeSupplements ? undefined : "primary",
          },
        },
      },
    },
    select: {
      id: true,
      blockType: true,
      blockOrder: true,
      blockTitle: true,
      blockText: true,
      articleNumberNormalized: true,
      lawVersion: {
        select: {
          id: true,
          status: true,
          lawId: true,
          sourceSnapshotHash: true,
          normalizedTextHash: true,
          currentForLaw: {
            select: {
              id: true,
              lawKey: true,
              title: true,
              topicUrl: true,
              lawKind: true,
              relatedPrimaryLawId: true,
              classificationOverride: true,
            },
          },
          sourcePosts: {
            orderBy: [{ postOrder: "asc" }],
            select: {
              postExternalId: true,
              postUrl: true,
              postOrder: true,
            },
          },
        },
      },
    },
    orderBy: [{ blockOrder: "asc" }],
  });
}

export async function listCurrentPrimaryLawVersionIdsByServer(
  serverId: string,
  db: PrismaLike = prisma,
) {
  const parsedServerId = registerLawInputSchema.shape.serverId.parse(serverId);
  const laws = await db.law.findMany({
    where: {
      serverId: parsedServerId,
      lawKind: "primary",
      isExcluded: false,
      currentVersionId: {
        not: null,
      },
    },
    select: {
      currentVersionId: true,
    },
    orderBy: [{ lawKey: "asc" }],
  });

  return laws
    .map((law) => law.currentVersionId)
    .filter((currentVersionId): currentVersionId is string => Boolean(currentVersionId));
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

export async function syncLawRecordFromDiscovery(
  input: {
    lawId: string;
    title: string;
    topicUrl: string;
    lawKind: "primary" | "supplement";
    relatedPrimaryLawId?: string | null;
  },
  db: PrismaLike = prisma,
) {
  const parsed = registerLawInputSchema
    .pick({
      title: true,
      topicUrl: true,
      lawKind: true,
      relatedPrimaryLawId: true,
    })
    .extend({
      lawId: lawIdSchema,
    })
    .parse(input);

  return db.law.update({
    where: {
      id: parsed.lawId,
    },
    data: {
      title: parsed.title,
      topicUrl: parsed.topicUrl,
      lawKind: parsed.lawKind,
      relatedPrimaryLawId: parsed.relatedPrimaryLawId ?? null,
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
