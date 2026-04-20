import { getPersistenceStatus } from "@/db/repositories/health.repository";
import { healthPayloadSchema } from "@/schemas/health";

export function getHealthPayload() {
  const persistenceStatus = getPersistenceStatus();

  return healthPayloadSchema.parse({
    status: "ok",
    service: "lawyer5rp-mvp",
    environment: process.env.APP_ENV ?? "unknown",
    timestamp: new Date().toISOString(),
    checks: {
      api: "ok",
      prisma: persistenceStatus.prisma,
      database: persistenceStatus.database,
    },
  });
}
