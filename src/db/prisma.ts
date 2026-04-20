import { PrismaClient } from "@prisma/client";

declare global {
  // Этот singleton нужен, чтобы в dev не плодить клиентов Prisma.
  var __prisma__: PrismaClient | undefined;
}

export const prisma =
  global.__prisma__ ??
  new PrismaClient({
    log: ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__prisma__ = prisma;
}
