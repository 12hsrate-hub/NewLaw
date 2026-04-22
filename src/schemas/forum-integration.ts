import { z } from "zod";

export const FORUM_GTA5RP_PROVIDER_KEY = "forum.gta5rp.com" as const;
export const FORUM_GTA5RP_PROVIDER_LABEL = "forum.gta5rp.com" as const;

export const forumConnectionProviderKeySchema = z.literal(FORUM_GTA5RP_PROVIDER_KEY);
export type ForumConnectionProviderKey = z.infer<typeof forumConnectionProviderKeySchema>;

export const forumConnectionStateSchema = z.enum([
  "not_connected",
  "connected_unvalidated",
  "valid",
  "invalid",
  "disabled",
]);
export type ForumConnectionState = z.infer<typeof forumConnectionStateSchema>;

export const persistedForumConnectionStateSchema = z.enum([
  "connected_unvalidated",
  "valid",
  "invalid",
  "disabled",
]);
export type PersistedForumConnectionState = z.infer<typeof persistedForumConnectionStateSchema>;

export const forumSessionPayloadSchema = z.object({
  cookieHeader: z.string().trim().min(1).max(16_000),
});
export type ForumSessionPayload = z.infer<typeof forumSessionPayloadSchema>;

export const forumSessionConnectionInputSchema = z.object({
  rawSessionInput: z
    .string()
    .trim()
    .min(10, "Вставьте Cookie header форума целиком.")
    .max(20_000, "Cookie header получился слишком длинным."),
});
export type ForumSessionConnectionInput = z.infer<typeof forumSessionConnectionInputSchema>;

export const forumConnectionSummarySchema = z.object({
  providerKey: forumConnectionProviderKeySchema,
  state: forumConnectionStateSchema,
  forumUserId: z.string().trim().min(1).nullable(),
  forumUsername: z.string().trim().min(1).nullable(),
  validatedAt: z.string().datetime().nullable(),
  lastValidationError: z.string().trim().min(1).nullable(),
  disabledAt: z.string().datetime().nullable(),
});
export type ForumConnectionSummary = z.infer<typeof forumConnectionSummarySchema>;

export const forumValidationResultSchema = z.object({
  isValid: z.boolean(),
  forumUserId: z.string().trim().min(1).nullable(),
  forumUsername: z.string().trim().min(1).nullable(),
  errorSummary: z.string().trim().min(1).nullable(),
});
export type ForumValidationResult = z.infer<typeof forumValidationResultSchema>;

export const forumPublishResultSchema = z.object({
  publicationUrl: z.string().url(),
  forumThreadId: z.string().trim().min(1),
  forumPostId: z.string().trim().min(1),
});
export const forumPublishCreateResultSchema = forumPublishResultSchema;
export const forumPublishUpdateResultSchema = forumPublishResultSchema;
export type ForumPublishCreateResult = z.infer<typeof forumPublishCreateResultSchema>;
export type ForumPublishUpdateResult = z.infer<typeof forumPublishUpdateResultSchema>;

export function normalizeForumSessionInput(rawInput: string): ForumSessionPayload {
  const parsed = forumSessionConnectionInputSchema.parse({
    rawSessionInput: rawInput,
  });
  const cookieHeader = parsed.rawSessionInput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("; ")
    .replace(/;\s*;/g, ";")
    .trim();

  return forumSessionPayloadSchema.parse({
    cookieHeader,
  });
}

export function buildDisconnectedForumConnectionSummary(): ForumConnectionSummary {
  return {
    providerKey: FORUM_GTA5RP_PROVIDER_KEY,
    state: "not_connected",
    forumUserId: null,
    forumUsername: null,
    validatedAt: null,
    lastValidationError: null,
    disabledAt: null,
  };
}
