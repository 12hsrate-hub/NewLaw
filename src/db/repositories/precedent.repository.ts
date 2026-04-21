import type { PrismaClient } from "@prisma/client";

import { prisma } from "@/db/prisma";
import {
  createPrecedentInputSchema,
  precedentIdSchema,
  updatePrecedentValidityStatusInputSchema,
} from "@/schemas/precedent-corpus";

type PrismaLike = PrismaClient;

export async function listPrecedentsByServer(serverId: string, db: PrismaLike = prisma) {
  return db.precedent.findMany({
    where: {
      serverId: createPrecedentInputSchema.shape.serverId.parse(serverId),
    },
    include: {
      sourceTopic: true,
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

export async function listCurrentPrecedentBlocksByServer(
  input: {
    serverId: string;
    includeValidityStatuses?: Array<"applicable" | "limited" | "obsolete">;
  },
  db: PrismaLike = prisma,
) {
  const parsedServerId = createPrecedentInputSchema.shape.serverId.parse(input.serverId);
  const validityStatuses = input.includeValidityStatuses ?? ["applicable", "limited"];

  return db.precedentBlock.findMany({
    where: {
      precedentVersion: {
        status: "current",
        currentForPrecedent: {
          is: {
            serverId: parsedServerId,
            validityStatus: {
              in: validityStatuses,
            },
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
      precedentVersion: {
        select: {
          id: true,
          status: true,
          precedentId: true,
          sourceSnapshotHash: true,
          normalizedTextHash: true,
          currentForPrecedent: {
            select: {
              id: true,
              precedentKey: true,
              displayTitle: true,
              validityStatus: true,
              sourceTopic: {
                select: {
                  topicUrl: true,
                  title: true,
                },
              },
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

export async function getPrecedentById(precedentId: string, db: PrismaLike = prisma) {
  return db.precedent.findUnique({
    where: {
      id: precedentIdSchema.parse(precedentId),
    },
  });
}

export async function getPrecedentByIdForReview(
  precedentId: string,
  db: PrismaLike = prisma,
) {
  return db.precedent.findUnique({
    where: {
      id: precedentIdSchema.parse(precedentId),
    },
    include: {
      currentVersion: {
        include: {
          confirmedByAccount: true,
          blocks: {
            select: {
              blockType: true,
            },
          },
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
          blocks: {
            select: {
              blockType: true,
            },
          },
          _count: {
            select: {
              sourcePosts: true,
              blocks: true,
            },
          },
        },
        orderBy: [{ importedAt: "desc" }],
      },
    },
  });
}

export async function getPrecedentBySourceTopicAndLocator(
  input: {
    precedentSourceTopicId: string;
    precedentLocatorKey: string;
  },
  db: PrismaLike = prisma,
) {
  return db.precedent.findFirst({
    where: {
      precedentSourceTopicId: createPrecedentInputSchema.shape.precedentSourceTopicId.parse(
        input.precedentSourceTopicId,
      ),
      precedentLocatorKey: createPrecedentInputSchema.shape.precedentLocatorKey.parse(
        input.precedentLocatorKey,
      ),
    },
  });
}

export async function getPrecedentByServerAndKey(
  input: {
    serverId: string;
    precedentKey: string;
  },
  db: PrismaLike = prisma,
) {
  return db.precedent.findFirst({
    where: {
      serverId: createPrecedentInputSchema.shape.serverId.parse(input.serverId),
      precedentKey: createPrecedentInputSchema.shape.precedentKey.parse(input.precedentKey),
    },
  });
}

export async function createPrecedentRecord(
  input: {
    serverId: string;
    precedentSourceTopicId: string;
    precedentKey: string;
    displayTitle: string;
    precedentLocatorKey: string;
    validityStatus?: "applicable" | "limited" | "obsolete";
  },
  db: PrismaLike = prisma,
) {
  const parsed = createPrecedentInputSchema.parse(input);

  return db.precedent.create({
    data: {
      serverId: parsed.serverId,
      precedentSourceTopicId: parsed.precedentSourceTopicId,
      precedentKey: parsed.precedentKey,
      displayTitle: parsed.displayTitle,
      precedentLocatorKey: parsed.precedentLocatorKey,
      validityStatus: parsed.validityStatus,
    },
  });
}

export async function updatePrecedentValidityStatus(
  input: {
    precedentId: string;
    validityStatus: "applicable" | "limited" | "obsolete";
  },
  db: PrismaLike = prisma,
) {
  const parsed = updatePrecedentValidityStatusInputSchema.parse(input);

  return db.precedent.update({
    where: {
      id: parsed.precedentId,
    },
    data: {
      validityStatus: parsed.validityStatus,
    },
  });
}

export async function updatePrecedentDisplayTitle(
  input: {
    precedentId: string;
    displayTitle: string;
  },
  db: PrismaLike = prisma,
) {
  return db.precedent.update({
    where: {
      id: precedentIdSchema.parse(input.precedentId),
    },
    data: {
      displayTitle: createPrecedentInputSchema.shape.displayTitle.parse(input.displayTitle),
    },
  });
}

export async function setCurrentPrecedentVersion(
  input: {
    precedentId: string;
    precedentVersionId: string | null;
  },
  db: PrismaLike = prisma,
) {
  return db.precedent.update({
    where: {
      id: precedentIdSchema.parse(input.precedentId),
    },
    data: {
      currentVersionId: input.precedentVersionId,
    },
  });
}
