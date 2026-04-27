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

export const complaintNarrativeLengthModes = ["short", "normal", "detailed"] as const;
export const complaintNarrativeRiskFlags = [
  "insufficient_facts",
  "weak_legal_context",
  "missing_evidence",
  "unclear_roles",
  "unclear_timeline",
  "ambiguous_date_time",
  "possible_overclaiming",
  "legal_basis_not_found",
] as const;

export const complaintNarrativeLengthModeSchema = z.enum(complaintNarrativeLengthModes);
export const complaintNarrativeRiskFlagSchema = z.enum(complaintNarrativeRiskFlags);

export const complaintNarrativeImprovementActionInputSchema = z.object({
  documentId: documentIdSchema,
  lengthMode: complaintNarrativeLengthModeSchema.default("normal"),
});

export const complaintNarrativeApplicantSchema = z.object({
  full_name: z.string().trim().min(1).max(160),
  role_label: z.string().trim().max(160).nullable(),
});

export const complaintNarrativeEvidenceItemSchema = z.object({
  label: z.string().trim().min(1).max(240),
  url: z.string().trim().url().optional(),
});

export const complaintNarrativeLegalContextLawSchema = z.object({
  law_name: z.string().trim().min(1).max(240),
  article: z.string().trim().max(64).optional(),
  part: z.string().trim().max(64).optional(),
  excerpt: z.string().trim().max(2_000).optional(),
});

export const complaintNarrativeLegalContextPrecedentSchema = z.object({
  title: z.string().trim().min(1).max(240),
  reason: z.string().trim().min(1).max(500),
});

export const complaintNarrativeLegalContextSchema = z.object({
  laws: z.array(complaintNarrativeLegalContextLawSchema).max(8).default([]),
  precedents: z.array(complaintNarrativeLegalContextPrecedentSchema).max(4).default([]),
});

export const complaintNarrativeImprovementRuntimeInputSchema = z.object({
  server_id: z.string().trim().min(1),
  law_version: z.string().trim().min(1).nullable(),
  active_character: complaintNarrativeApplicantSchema,
  applicant_role: z.string().trim().min(1).max(160).nullable(),
  representative_mode: z.enum(["self", "representative"]),
  victim_or_trustor_mode: z.enum(["self", "trustor"]),
  victim_or_trustor_name: z.string().trim().max(160).nullable(),
  organization: z.string().trim().min(1).max(160),
  subject_name: z.string().trim().min(1).max(160),
  date_time: z.string().trim().min(1).max(64),
  raw_situation_description: z.string().trim().min(1).max(12_000),
  evidence_list: z.array(complaintNarrativeEvidenceItemSchema).max(40).default([]),
  attorney_request_context: z.record(z.string(), z.unknown()).nullable().optional(),
  arrest_or_bodycam_context: z.record(z.string(), z.unknown()).nullable().optional(),
  selected_legal_context: complaintNarrativeLegalContextSchema.nullable().optional(),
  length_mode: complaintNarrativeLengthModeSchema.default("normal"),
});

export const complaintNarrativeLegalBasisUsedSchema = z.object({
  law_name: z.string().trim().min(1).max(240),
  article: z.string().trim().max(64).optional(),
  part: z.string().trim().max(64).optional(),
  reason: z.string().trim().min(1).max(500),
});

export const complaintNarrativeImprovementResultSchema = z.object({
  improved_text: z.string().trim().min(1).max(4_000),
  legal_basis_used: z.array(complaintNarrativeLegalBasisUsedSchema).max(6),
  used_facts: z.array(z.string().trim().min(1).max(500)).max(32),
  missing_facts: z.array(z.string().trim().min(1).max(500)).max(32),
  review_notes: z.array(z.string().trim().min(1).max(1_000)).max(32),
  risk_flags: z.array(complaintNarrativeRiskFlagSchema).max(16),
  should_send_to_review: z.boolean(),
});

export const complaintNarrativeImprovementUsageMetaSchema = z.object({
  featureKey: z.literal("complaint_narrative_improvement"),
  providerKey: z.string().trim().min(1).nullable(),
  proxyKey: z.string().trim().min(1).nullable(),
  model: z.string().trim().min(1).nullable(),
  latencyMs: z.number().int().nonnegative(),
  finishReason: z.string().trim().min(1).nullable(),
  attemptedProxyKeys: z.array(z.string().trim().min(1)).max(16),
  improvedTextLength: z.number().int().nonnegative(),
  lengthMode: complaintNarrativeLengthModeSchema,
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
export type ComplaintNarrativeLengthMode = z.infer<typeof complaintNarrativeLengthModeSchema>;
export type ComplaintNarrativeRiskFlag = z.infer<typeof complaintNarrativeRiskFlagSchema>;
export type ComplaintNarrativeImprovementActionInput = z.infer<
  typeof complaintNarrativeImprovementActionInputSchema
>;
export type ComplaintNarrativeImprovementRuntimeInput = z.infer<
  typeof complaintNarrativeImprovementRuntimeInputSchema
>;
export type ComplaintNarrativeImprovementResult = z.infer<
  typeof complaintNarrativeImprovementResultSchema
>;
export type ComplaintNarrativeImprovementUsageMeta = z.infer<
  typeof complaintNarrativeImprovementUsageMetaSchema
>;
