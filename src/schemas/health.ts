import { z } from "zod";

export const healthPayloadSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("lawyer5rp-mvp"),
  environment: z.string(),
  timestamp: z.string().datetime(),
  checks: z.object({
    api: z.literal("ok"),
    prisma: z.string(),
    database: z.string(),
  }),
});

export type HealthPayload = z.infer<typeof healthPayloadSchema>;
