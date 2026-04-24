import { z } from "zod";

export const characterRoleKeys = ["citizen", "lawyer"] as const;
export const characterAccessFlagKeys = [
  "advocate",
  "server_editor",
  "server_admin",
  "tester",
] as const;
export const characterAccessRequestTypeKeys = ["advocate_access"] as const;
export const characterAccessRequestStatusKeys = [
  "pending",
  "approved",
  "rejected",
  "cancelled",
] as const;

export const characterIdSchema = z.string().min(1);
export const characterRoleKeySchema = z.enum(characterRoleKeys);
export const characterAccessFlagKeySchema = z.enum(characterAccessFlagKeys);
export const characterAccessRequestTypeSchema = z.enum(characterAccessRequestTypeKeys);
export const characterAccessRequestStatusSchema = z.enum(characterAccessRequestStatusKeys);
export const characterRoleSelectionSchema = z.array(characterRoleKeySchema).default([]);
export const characterAccessFlagSelectionSchema = z
  .array(characterAccessFlagKeySchema)
  .default([]);
export const characterSelectionBehaviorSchema = z
  .enum(["app_shell", "account_zone"])
  .default("app_shell");

export const characterFormSchema = z.object({
  fullName: z.string().trim().min(3).max(120),
  nickname: z.string().trim().max(120).default(""),
  passportNumber: z.string().trim().min(1).max(64),
});

export const characterProfileFormSchema = z.object({
  position: z.string().trim().max(160).default(""),
  address: z.string().trim().max(240).default(""),
  phone: z.string().trim().max(64).default(""),
  icEmail: z.string().trim().max(320).default(""),
  passportImageUrl: z.string().trim().max(2_048).default(""),
  profileSignature: z.string().trim().max(160).default(""),
  profileNote: z.string().trim().max(500).default(""),
});

export const characterProfileDataSchema = z.record(z.string(), z.string()).nullable().default(null);

const characterSelfServiceDetailsSchema = characterFormSchema.extend({
  isProfileComplete: z.boolean().default(false),
  profileDataJson: characterProfileDataSchema,
});

export const createCharacterInputSchema = characterSelfServiceDetailsSchema.extend({
  accountId: z.string().uuid(),
  serverId: z.string().min(1),
});

export const updateCharacterInputSchema = characterSelfServiceDetailsSchema.extend({
  accountId: z.string().uuid(),
  serverId: z.string().min(1),
  characterId: characterIdSchema,
});

export const adminCharacterAssignmentInputSchema = z.object({
  actorAccountId: z.string().uuid(),
  characterId: characterIdSchema,
  roleKeys: characterRoleSelectionSchema,
  accessFlags: characterAccessFlagSelectionSchema,
  comment: z.string().trim().max(500).default(""),
});

export const createCharacterAccessRequestInputSchema = z.object({
  accountId: z.string().uuid(),
  characterId: characterIdSchema,
  requestType: characterAccessRequestTypeSchema,
  requestComment: z.string().trim().max(500).default(""),
});

export const characterSelectionSchema = z.object({
  serverId: z.string().min(1),
  characterId: characterIdSchema,
});

export type CharacterRoleKey = z.infer<typeof characterRoleKeySchema>;
export type CharacterAccessFlagKey = z.infer<typeof characterAccessFlagKeySchema>;
export type CharacterAccessRequestType = z.infer<typeof characterAccessRequestTypeSchema>;
export type CharacterAccessRequestStatus = z.infer<typeof characterAccessRequestStatusSchema>;
export type CharacterSelectionBehavior = z.infer<typeof characterSelectionBehaviorSchema>;
export type CreateCharacterInput = z.infer<typeof createCharacterInputSchema>;
export type UpdateCharacterInput = z.infer<typeof updateCharacterInputSchema>;
export type AdminCharacterAssignmentInput = z.infer<typeof adminCharacterAssignmentInputSchema>;
export type CreateCharacterAccessRequestInput = z.infer<
  typeof createCharacterAccessRequestInputSchema
>;
export type CharacterSelectionInput = z.infer<typeof characterSelectionSchema>;
