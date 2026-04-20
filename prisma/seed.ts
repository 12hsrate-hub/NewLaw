import { PrismaClient } from "@prisma/client";

import { bootstrapServers } from "../src/db/seeds/servers";

const prisma = new PrismaClient();

async function main() {
  for (const server of bootstrapServers) {
    await prisma.server.upsert({
      where: {
        code: server.code,
      },
      update: {
        name: server.name,
        isActive: server.isActive,
        sortOrder: server.sortOrder,
      },
      create: {
        code: server.code,
        name: server.name,
        isActive: server.isActive,
        sortOrder: server.sortOrder,
      },
    });
  }
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
