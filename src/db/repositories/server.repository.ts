import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/db/prisma";

type PrismaLike = PrismaClient;
const serverIdSchema = z.string().min(1);
const serverCodeSchema = z.string().min(1);

export async function getServers(db: PrismaLike = prisma) {
  return db.server.findMany({
    where: {
      isActive: true,
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function getServerById(serverId: string, db: PrismaLike = prisma) {
  return db.server.findFirst({
    where: {
      id: serverIdSchema.parse(serverId),
      isActive: true,
    },
  });
}

export async function getServerByCode(serverCode: string, db: PrismaLike = prisma) {
  return db.server.findFirst({
    where: {
      code: serverCodeSchema.parse(serverCode),
      isActive: true,
    },
  });
}

export async function listAssistantServers(db: PrismaLike = prisma) {
  const servers = await db.server.findMany({
    where: {
      isActive: true,
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      laws: {
        where: {
          lawKind: "primary",
          isExcluded: false,
          currentVersionId: {
            not: null,
          },
        },
        select: {
          id: true,
        },
      },
    },
  });

  return servers.map((server) => ({
    id: server.id,
    code: server.code,
    name: server.name,
    hasCurrentLawCorpus: server.laws.length > 0,
    currentPrimaryLawCount: server.laws.length,
  }));
}
