import { z } from "zod";

const precedentTopicClassificationOverrides = ["precedent", "ignored"] as const;
const precedentVersionStatuses = ["imported_draft", "current", "superseded"] as const;
const precedentValidityStatuses = ["applicable", "limited", "obsolete"] as const;
const precedentBlockTypes = [
  "facts",
  "issue",
  "holding",
  "reasoning",
  "resolution",
  "unstructured",
] as const;
const precedentDiscoveryStatuses = ["running", "success", "failure"] as const;

export const precedentTopicClassificationOverrideSchema = z.enum(
  precedentTopicClassificationOverrides,
);
export const precedentVersionStatusSchema = z.enum(precedentVersionStatuses);
export const precedentValidityStatusSchema = z.enum(precedentValidityStatuses);
export const precedentBlockTypeSchema = z.enum(precedentBlockTypes);
export const precedentDiscoveryStatusSchema = z.enum(precedentDiscoveryStatuses);

export const precedentSourceTopicIdSchema = z.string().min(1);
export const precedentIdSchema = z.string().min(1);
export const precedentVersionIdSchema = z.string().min(1);
export const precedentBlockIdSchema = z.string().min(1);

function normalizeForumUrl(input: string) {
  const url = new URL(input.trim());

  if (url.protocol !== "https:") {
    throw new Error("Источник должен использовать https.");
  }

  if (url.hostname !== "forum.gta5rp.com") {
    throw new Error("Источник должен быть только с домена forum.gta5rp.com.");
  }

  url.hash = "";
  const normalizedPath = url.pathname.replace(/\/+$/, "");
  url.pathname = normalizedPath || "/";

  return url.toString();
}

export function normalizePrecedentTopicUrl(input: string) {
  const normalizedUrl = normalizeForumUrl(input);
  const url = new URL(normalizedUrl);

  if (!url.pathname.includes("/threads/")) {
    throw new Error("Источник прецедента должен указывать на тему форума.");
  }

  return normalizedUrl;
}

export function extractPrecedentTopicExternalId(input: string) {
  const normalizedUrl = normalizePrecedentTopicUrl(input);
  const url = new URL(normalizedUrl);
  const lastSegment = url.pathname.split("/").filter(Boolean).at(-1);

  if (!lastSegment) {
    throw new Error("Не удалось определить topic_external_id из URL темы.");
  }

  const dottedParts = lastSegment.split(".");
  const lastDottedPart = dottedParts.at(-1)?.trim();

  if (lastDottedPart && lastDottedPart.length > 0) {
    return lastDottedPart;
  }

  return lastSegment;
}

const precedentKeyPattern = /^[a-z0-9_]{2,64}$/;

export function normalizePrecedentKeyCandidate(input: string) {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);

  return normalized || "precedent";
}

export const precedentKeySchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    precedentKeyPattern,
    "precedent_key должен содержать от 2 до 64 символов: латиницу, цифры и нижнее подчёркивание.",
  );

export const precedentLocatorKeySchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    precedentKeyPattern,
    "precedent_locator_key должен содержать от 2 до 64 символов: латиницу, цифры и нижнее подчёркивание.",
  );

export const precedentTopicUrlSchema = z
  .string()
  .trim()
  .url("Укажи корректный URL темы форума.")
  .transform((value, ctx) => {
    try {
      return normalizePrecedentTopicUrl(value);
    } catch (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: error instanceof Error ? error.message : "Некорректный URL темы форума.",
      });

      return z.NEVER;
    }
  });

export const createPrecedentSourceTopicInputSchema = z.object({
  sourceIndexId: z.string().min(1),
  topicUrl: precedentTopicUrlSchema,
  title: z.string().trim().min(3).max(300),
});

export const createPrecedentSourceTopicRecordInputSchema = z.object({
  serverId: z.string().min(1),
  sourceIndexId: z.string().min(1),
  topicUrl: precedentTopicUrlSchema,
  topicExternalId: z.string().trim().min(1).max(120),
  title: z.string().trim().min(3).max(300),
  isExcluded: z.boolean().optional(),
  classificationOverride: precedentTopicClassificationOverrideSchema.nullish(),
  internalNote: z.string().trim().max(2000).nullish(),
});

export const precedentSourceTopicManualOverrideSchema = z.object({
  sourceTopicId: precedentSourceTopicIdSchema,
  isExcluded: z.boolean(),
  classificationOverride: precedentTopicClassificationOverrideSchema.nullish(),
  internalNote: z.string().trim().max(2000).nullish(),
});

export const createPrecedentInputSchema = z.object({
  serverId: z.string().min(1),
  precedentSourceTopicId: precedentSourceTopicIdSchema,
  precedentKey: precedentKeySchema,
  displayTitle: z.string().trim().min(3).max(300),
  precedentLocatorKey: precedentLocatorKeySchema,
  validityStatus: precedentValidityStatusSchema.default("applicable"),
});

export const updatePrecedentValidityStatusInputSchema = z.object({
  precedentId: precedentIdSchema,
  validityStatus: precedentValidityStatusSchema,
});

export const createPrecedentVersionInputSchema = z.object({
  precedentId: precedentIdSchema,
  status: precedentVersionStatusSchema.default("imported_draft"),
  normalizedFullText: z.string().min(1),
  sourceSnapshotHash: z.string().trim().min(1).max(255),
  normalizedTextHash: z.string().trim().min(1).max(255),
  importedAt: z.date().optional(),
});

export const updatePrecedentVersionStatusInputSchema = z.object({
  precedentVersionId: precedentVersionIdSchema,
  status: precedentVersionStatusSchema,
  confirmedAt: z.date().nullish(),
  confirmedByAccountId: z.string().uuid().nullish(),
});

export const createPrecedentSourcePostInputSchema = z.object({
  postExternalId: z.string().trim().min(1).max(255),
  postUrl: precedentTopicUrlSchema,
  postOrder: z.number().int().min(0),
  authorName: z.string().trim().max(255).nullish(),
  postedAt: z.date().nullish(),
  rawHtml: z.string(),
  rawText: z.string(),
  normalizedTextFragment: z.string(),
});

export const createPrecedentBlockInputSchema = z.object({
  blockType: precedentBlockTypeSchema,
  blockOrder: z.number().int().min(0),
  blockTitle: z.string().trim().max(500).nullish(),
  blockText: z.string().min(1),
  parentBlockId: precedentBlockIdSchema.nullish(),
});

export type PrecedentTopicClassificationOverride = z.infer<
  typeof precedentTopicClassificationOverrideSchema
>;
export type PrecedentVersionStatus = z.infer<typeof precedentVersionStatusSchema>;
export type PrecedentValidityStatus = z.infer<typeof precedentValidityStatusSchema>;
export type PrecedentBlockType = z.infer<typeof precedentBlockTypeSchema>;
export type PrecedentDiscoveryStatus = z.infer<typeof precedentDiscoveryStatusSchema>;
export type CreatePrecedentSourceTopicInput = z.infer<typeof createPrecedentSourceTopicInputSchema>;
export type CreatePrecedentSourceTopicRecordInput = z.infer<
  typeof createPrecedentSourceTopicRecordInputSchema
>;
export type PrecedentSourceTopicManualOverrideInput = z.infer<
  typeof precedentSourceTopicManualOverrideSchema
>;
export type CreatePrecedentInput = z.infer<typeof createPrecedentInputSchema>;
export type UpdatePrecedentValidityStatusInput = z.infer<
  typeof updatePrecedentValidityStatusInputSchema
>;
export type CreatePrecedentVersionInput = z.infer<typeof createPrecedentVersionInputSchema>;
export type UpdatePrecedentVersionStatusInput = z.infer<
  typeof updatePrecedentVersionStatusInputSchema
>;
export type CreatePrecedentSourcePostInput = z.infer<typeof createPrecedentSourcePostInputSchema>;
export type CreatePrecedentBlockInput = z.infer<typeof createPrecedentBlockInputSchema>;
