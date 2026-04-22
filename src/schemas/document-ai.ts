import { z } from "zod";

import { documentIdSchema } from "@/schemas/document";

export const ogpDocumentRewriteSectionKeys = [
  "situation_description",
  "violation_summary",
] as const;

export const claimsDocumentRewriteSectionKeys = [
  "factual_background",
  "legal_basis_summary",
  "requested_relief",
  "rehabilitation_basis",
  "harm_summary",
  "pretrial_summary",
] as const;

export const documentRewriteSectionKeys = [
  ...ogpDocumentRewriteSectionKeys,
  ...claimsDocumentRewriteSectionKeys,
] as const;

export const groundedOgpDocumentRewriteSectionKeys = ["violation_summary"] as const;

export const groundedClaimsDocumentRewriteSectionKeys = [
  "legal_basis_summary",
  "requested_relief",
] as const;

export const groundedDocumentRewriteSectionKeys = [
  ...groundedOgpDocumentRewriteSectionKeys,
  ...groundedClaimsDocumentRewriteSectionKeys,
] as const;

export const ogpDocumentRewriteSectionKeySchema = z.enum(ogpDocumentRewriteSectionKeys);
export const claimsDocumentRewriteSectionKeySchema = z.enum(claimsDocumentRewriteSectionKeys);
export const documentRewriteSectionKeySchema = z.enum(documentRewriteSectionKeys);
export const groundedOgpDocumentRewriteSectionKeySchema = z.enum(groundedOgpDocumentRewriteSectionKeys);
export const groundedClaimsDocumentRewriteSectionKeySchema = z.enum(
  groundedClaimsDocumentRewriteSectionKeys,
);
export const groundedDocumentRewriteSectionKeySchema = z.enum(groundedDocumentRewriteSectionKeys);

export const rewriteDocumentFieldActionInputSchema = z.object({
  documentId: documentIdSchema,
  sectionKey: documentRewriteSectionKeySchema,
});

export const rewriteGroundedDocumentFieldActionInputSchema = z.object({
  documentId: documentIdSchema,
  sectionKey: groundedDocumentRewriteSectionKeySchema,
});

export const documentFieldRewriteUsageMetaSchema = z.object({
  featureKey: z.literal("document_field_rewrite"),
  providerKey: z.string().trim().min(1).nullable(),
  proxyKey: z.string().trim().min(1).nullable(),
  model: z.string().trim().min(1).nullable(),
  latencyMs: z.number().int().nonnegative(),
  suggestionLength: z.number().int().nonnegative(),
  finishReason: z.string().trim().min(1).nullable(),
  attemptedProxyKeys: z.array(z.string().trim().min(1)).max(16),
});

export const groundedDocumentRewriteModeSchema = z.enum([
  "law_grounded",
  "precedent_grounded",
]);

export const groundedDocumentReferenceSchema = z.discriminatedUnion("sourceKind", [
  z.object({
    sourceKind: z.literal("law"),
    lawKey: z.string().trim().min(1),
    lawTitle: z.string().trim().min(1),
    lawVersionId: z.string().trim().min(1),
    lawBlockId: z.string().trim().min(1),
    articleNumberNormalized: z.string().trim().min(1).nullable(),
    sourceTopicUrl: z.string().trim().url(),
  }),
  z.object({
    sourceKind: z.literal("precedent"),
    precedentKey: z.string().trim().min(1),
    precedentTitle: z.string().trim().min(1),
    precedentVersionId: z.string().trim().min(1),
    precedentBlockId: z.string().trim().min(1),
    validityStatus: z.enum(["applicable", "limited", "obsolete"]),
    sourceTopicUrl: z.string().trim().url(),
  }),
]);

export const groundedDocumentFieldRewriteUsageMetaSchema = z.object({
  featureKey: z.literal("document_field_rewrite_grounded"),
  providerKey: z.string().trim().min(1).nullable(),
  proxyKey: z.string().trim().min(1).nullable(),
  model: z.string().trim().min(1).nullable(),
  latencyMs: z.number().int().nonnegative(),
  suggestionLength: z.number().int().nonnegative(),
  finishReason: z.string().trim().min(1).nullable(),
  attemptedProxyKeys: z.array(z.string().trim().min(1)).max(16),
  groundingMode: groundedDocumentRewriteModeSchema,
  lawResultCount: z.number().int().nonnegative(),
  precedentResultCount: z.number().int().nonnegative(),
  retrievalPromptBlockCount: z.number().int().nonnegative(),
});

export type OgpDocumentRewriteSectionKey = z.infer<typeof ogpDocumentRewriteSectionKeySchema>;
export type ClaimsDocumentRewriteSectionKey = z.infer<typeof claimsDocumentRewriteSectionKeySchema>;
export type DocumentRewriteSectionKey = z.infer<typeof documentRewriteSectionKeySchema>;
export type DocumentFieldRewriteUsageMeta = z.infer<typeof documentFieldRewriteUsageMetaSchema>;
export type GroundedOgpDocumentRewriteSectionKey = z.infer<
  typeof groundedOgpDocumentRewriteSectionKeySchema
>;
export type GroundedClaimsDocumentRewriteSectionKey = z.infer<
  typeof groundedClaimsDocumentRewriteSectionKeySchema
>;
export type GroundedDocumentRewriteSectionKey = z.infer<
  typeof groundedDocumentRewriteSectionKeySchema
>;
export type GroundedDocumentRewriteMode = z.infer<typeof groundedDocumentRewriteModeSchema>;
export type GroundedDocumentReference = z.infer<typeof groundedDocumentReferenceSchema>;
export type GroundedDocumentFieldRewriteUsageMeta = z.infer<
  typeof groundedDocumentFieldRewriteUsageMetaSchema
>;
