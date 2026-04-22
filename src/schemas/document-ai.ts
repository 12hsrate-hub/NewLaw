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

export const ogpDocumentRewriteSectionKeySchema = z.enum(ogpDocumentRewriteSectionKeys);
export const claimsDocumentRewriteSectionKeySchema = z.enum(claimsDocumentRewriteSectionKeys);
export const documentRewriteSectionKeySchema = z.enum(documentRewriteSectionKeys);

export const rewriteDocumentFieldActionInputSchema = z.object({
  documentId: documentIdSchema,
  sectionKey: documentRewriteSectionKeySchema,
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

export type OgpDocumentRewriteSectionKey = z.infer<typeof ogpDocumentRewriteSectionKeySchema>;
export type ClaimsDocumentRewriteSectionKey = z.infer<typeof claimsDocumentRewriteSectionKeySchema>;
export type DocumentRewriteSectionKey = z.infer<typeof documentRewriteSectionKeySchema>;
export type DocumentFieldRewriteUsageMeta = z.infer<typeof documentFieldRewriteUsageMetaSchema>;
