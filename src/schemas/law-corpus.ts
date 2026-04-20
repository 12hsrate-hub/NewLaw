import { z } from "zod";

export const lawKinds = ["primary", "supplement"] as const;
export const lawTopicClassifications = ["primary", "supplement", "ignored"] as const;
export const lawVersionStatuses = ["imported_draft", "current", "superseded"] as const;
export const lawImportRunStatuses = ["running", "success", "failure"] as const;
export const lawImportRunModes = ["discovery", "import_law"] as const;
export const lawBlockTypes = [
  "section",
  "chapter",
  "article",
  "appendix",
  "unstructured",
] as const;

export const lawKindSchema = z.enum(lawKinds);
export const lawTopicClassificationSchema = z.enum(lawTopicClassifications);
export const lawVersionStatusSchema = z.enum(lawVersionStatuses);
export const lawImportRunStatusSchema = z.enum(lawImportRunStatuses);
export const lawImportRunModeSchema = z.enum(lawImportRunModes);
export const lawBlockTypeSchema = z.enum(lawBlockTypes);

export const lawSourceIndexIdSchema = z.string().min(1);
export const lawIdSchema = z.string().min(1);
export const lawVersionIdSchema = z.string().min(1);
export const lawBlockIdSchema = z.string().min(1);

export function normalizeLawSourceIndexUrl(input: string) {
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

export const lawSourceIndexUrlSchema = z
  .string()
  .trim()
  .url("Укажи корректный URL источника.")
  .transform((value, ctx) => {
    try {
      return normalizeLawSourceIndexUrl(value);
    } catch (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: error instanceof Error ? error.message : "Некорректный URL источника.",
      });

      return z.NEVER;
    }
  });

const lawKeyPattern = /^[a-z0-9_]{2,64}$/;

export function normalizeLawKeyCandidate(input: string) {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);

  return normalized || "law";
}

export const lawKeySchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    lawKeyPattern,
    "law_key должен содержать от 2 до 64 символов: латиницу, цифры и нижнее подчёркивание.",
  );

export const articleNumberNormalizedSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9.\-_]+$/, "Некорректный нормализованный номер статьи.");

export const createLawSourceIndexInputSchema = z.object({
  serverId: z.string().min(1),
  indexUrl: lawSourceIndexUrlSchema,
});

export const updateLawSourceIndexEnabledInputSchema = z.object({
  sourceIndexId: lawSourceIndexIdSchema,
  isEnabled: z.boolean(),
});

export const registerLawInputSchema = z.object({
  serverId: z.string().min(1),
  title: z.string().trim().min(3).max(300),
  topicUrl: lawSourceIndexUrlSchema,
  topicExternalId: z.string().trim().min(1).max(120),
  lawKind: lawKindSchema,
  relatedPrimaryLawId: lawIdSchema.nullish(),
  isExcluded: z.boolean().optional(),
  classificationOverride: lawKindSchema.nullish(),
  internalNote: z.string().trim().max(2000).nullish(),
});

export const lawManualOverrideSchema = z.object({
  lawId: lawIdSchema,
  isExcluded: z.boolean(),
  classificationOverride: lawKindSchema.nullish(),
  internalNote: z.string().trim().max(2000).nullish(),
});

export const createLawVersionInputSchema = z.object({
  lawId: lawIdSchema,
  status: lawVersionStatusSchema.default("imported_draft"),
  normalizedFullText: z.string().min(1),
  sourceSnapshotHash: z.string().trim().min(1).max(255),
  normalizedTextHash: z.string().trim().min(1).max(255),
  importedAt: z.date().optional(),
});

export const updateLawVersionStatusInputSchema = z.object({
  lawVersionId: lawVersionIdSchema,
  status: lawVersionStatusSchema,
  confirmedAt: z.date().nullish(),
  confirmedByAccountId: z.string().uuid().nullish(),
});

export const createLawSourcePostInputSchema = z.object({
  postExternalId: z.string().trim().min(1).max(255),
  postUrl: lawSourceIndexUrlSchema,
  postOrder: z.number().int().min(0),
  authorName: z.string().trim().max(255).nullish(),
  postedAt: z.date().nullish(),
  rawHtml: z.string(),
  rawText: z.string(),
  normalizedTextFragment: z.string(),
});

export const createLawBlockInputSchema = z
  .object({
    blockType: lawBlockTypeSchema,
    blockOrder: z.number().int().min(0),
    blockTitle: z.string().trim().max(500).nullish(),
    blockText: z.string().min(1),
    parentBlockId: lawBlockIdSchema.nullish(),
    articleNumberNormalized: articleNumberNormalizedSchema.nullish(),
  })
  .superRefine((value, ctx) => {
    if (value.blockType === "article" && !value.articleNumberNormalized) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Для article-блока article_number_normalized обязателен.",
        path: ["articleNumberNormalized"],
      });
    }
  });

export const createLawImportRunInputSchema = z.object({
  serverId: z.string().min(1),
  sourceIndexId: lawSourceIndexIdSchema.nullish(),
  mode: lawImportRunModeSchema,
});

export const finishLawImportRunInputSchema = z.object({
  runId: z.string().min(1),
  status: lawImportRunStatusSchema,
  summary: z.string().trim().max(5000).nullish(),
  error: z.string().trim().max(5000).nullish(),
});

export const runLawSourceDiscoveryInputSchema = z.object({
  sourceIndexId: lawSourceIndexIdSchema,
});

export const runLawTopicImportInputSchema = z.object({
  lawId: lawIdSchema,
});

export type LawKind = z.infer<typeof lawKindSchema>;
export type LawTopicClassification = z.infer<typeof lawTopicClassificationSchema>;
export type LawVersionStatus = z.infer<typeof lawVersionStatusSchema>;
export type LawImportRunStatus = z.infer<typeof lawImportRunStatusSchema>;
export type LawImportRunMode = z.infer<typeof lawImportRunModeSchema>;
export type LawBlockType = z.infer<typeof lawBlockTypeSchema>;
export type CreateLawSourceIndexInput = z.infer<typeof createLawSourceIndexInputSchema>;
export type UpdateLawSourceIndexEnabledInput = z.infer<typeof updateLawSourceIndexEnabledInputSchema>;
export type RegisterLawInput = z.infer<typeof registerLawInputSchema>;
export type LawManualOverrideInput = z.infer<typeof lawManualOverrideSchema>;
export type CreateLawVersionInput = z.infer<typeof createLawVersionInputSchema>;
export type UpdateLawVersionStatusInput = z.infer<typeof updateLawVersionStatusInputSchema>;
export type CreateLawSourcePostInput = z.infer<typeof createLawSourcePostInputSchema>;
export type CreateLawBlockInput = z.infer<typeof createLawBlockInputSchema>;
export type CreateLawImportRunInput = z.infer<typeof createLawImportRunInputSchema>;
export type FinishLawImportRunInput = z.infer<typeof finishLawImportRunInputSchema>;
export type RunLawSourceDiscoveryInput = z.infer<typeof runLawSourceDiscoveryInputSchema>;
export type RunLawTopicImportInput = z.infer<typeof runLawTopicImportInputSchema>;
