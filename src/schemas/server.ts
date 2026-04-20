import { z } from "zod";

export const serverIdSchema = z.string().min(1);
export const activeServerSelectionSchema = z.object({
  serverId: serverIdSchema,
});

export const getCharactersByServerSchema = z.object({
  accountId: z.string().uuid(),
  serverId: serverIdSchema,
});

export type GetCharactersByServerInput = z.infer<typeof getCharactersByServerSchema>;
export type ActiveServerSelectionInput = z.infer<typeof activeServerSelectionSchema>;
