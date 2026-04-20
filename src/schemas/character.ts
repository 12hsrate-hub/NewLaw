import { z } from "zod";

export const characterRoleKeys = ["citizen", "lawyer"] as const;
export const characterAccessFlagKeys = [
  "advocate",
  "server_editor",
  "server_admin",
  "tester",
] as const;

export const characterIdSchema = z.string().min(1);
export const characterRoleKeySchema = z.enum(characterRoleKeys);
export const characterAccessFlagKeySchema = z.enum(characterAccessFlagKeys);
export const characterRoleSelectionSchema = z.array(characterRoleKeySchema).default([]);
export const characterAccessFlagSelectionSchema = z
  .array(characterAccessFlagKeySchema)
  .default([]);

export const characterFormSchema = z.object({
  fullName: z.string().trim().min(3).max(120),
  passportNumber: z.string().trim().min(1).max(64),
});

const characterDetailsSchema = characterFormSchema.extend({
  roleKeys: characterRoleSelectionSchema,
  accessFlags: characterAccessFlagSelectionSchema,
});

export const createCharacterInputSchema = characterDetailsSchema.extend({
  accountId: z.string().uuid(),
  serverId: z.string().min(1),
});

export const updateCharacterInputSchema = characterDetailsSchema.extend({
  accountId: z.string().uuid(),
  serverId: z.string().min(1),
  characterId: characterIdSchema,
});

export const characterSelectionSchema = z.object({
  serverId: z.string().min(1),
  characterId: characterIdSchema,
});

export type CharacterRoleKey = z.infer<typeof characterRoleKeySchema>;
export type CharacterAccessFlagKey = z.infer<typeof characterAccessFlagKeySchema>;
export type CreateCharacterInput = z.infer<typeof createCharacterInputSchema>;
export type UpdateCharacterInput = z.infer<typeof updateCharacterInputSchema>;
export type CharacterSelectionInput = z.infer<typeof characterSelectionSchema>;
