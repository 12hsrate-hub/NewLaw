import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/db/prisma";

type PrismaLike = PrismaClient;
const serverIdSchema = z.string().min(1);

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
