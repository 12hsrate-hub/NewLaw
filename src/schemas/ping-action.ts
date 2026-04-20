import { z } from "zod";

export const pingActionSchema = z.object({
  message: z.string().trim().min(1).max(120),
});

export type PingActionInput = z.infer<typeof pingActionSchema>;
