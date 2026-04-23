import { z } from "zod";

export const documentTypes = ["ogp_complaint", "rehabilitation", "lawsuit"] as const;
export const documentStatuses = ["draft", "generated", "published"] as const;
export const ogpComplaintFilingModes = ["self", "representative"] as const;
export const trustorSnapshotSourceTypes = ["inline_manual", "registry_prefill"] as const;
export const claimDocumentTypes = ["rehabilitation", "lawsuit"] as const;
export const claimsStructuredPreviewFormat = "claims_structured_preview_v1" as const;
export const ogpForumSyncStates = [
  "not_published",
  "current",
  "outdated",
  "failed",
  "manual_untracked",
] as const;

const datetimeLocalPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function isValidOptionalHttpUrl(value: string) {
  if (value === "") {
    return true;
  }

  const parsed = z.string().url().safeParse(value);

  if (!parsed.success) {
    return false;
  }

  return value.startsWith("http://") || value.startsWith("https://");
}

function isValidOptionalForumPublicationUrl(value: string) {
  if (value === "") {
    return true;
  }

  const parsed = z.string().url().safeParse(value);

  if (!parsed.success) {
    return false;
  }

  return value.startsWith("https://forum.gta5rp.com/");
}

export const documentIdSchema = z.string().trim().min(1);
export const documentTypeSchema = z.enum(documentTypes);
export const claimDocumentTypeSchema = z.enum(claimDocumentTypes);
export const documentStatusSchema = z.enum(documentStatuses);
export const ogpForumSyncStateSchema = z.enum(ogpForumSyncStates);
export const ogpComplaintFilingModeSchema = z.enum(ogpComplaintFilingModes);
export const trustorSnapshotSourceTypeSchema = z.enum(trustorSnapshotSourceTypes);
export const documentTitleSchema = z.string().trim().min(3).max(160);
export const documentWorkingNotesSchema = z.string().max(12_000).default("");
export const documentFormSchemaVersionSchema = z.string().trim().min(1).max(64);
export const documentGeneratedMetadataVersionSchema = z.string().trim().min(1).max(160);
export const documentGeneratedArtifactTextSchema = z.string().max(200_000);
export const documentGeneratedOutputFormatSchema = z.string().trim().min(1).max(160);
export const documentGeneratedRendererVersionSchema = z.string().trim().min(1).max(160);
export const documentPublicationUrlSchema = z
  .string()
  .trim()
  .max(2_048)
  .default("")
  .refine(isValidOptionalForumPublicationUrl, {
    message: "Publication URL должен быть пустым или вести на https://forum.gta5rp.com/.",
  });

export const ogpComplaintTrustorSnapshotSchema = z.object({
  sourceType: trustorSnapshotSourceTypeSchema.default("inline_manual"),
  fullName: z.string().trim().max(160).default(""),
  passportNumber: z.string().trim().max(64).default(""),
  address: z.string().trim().max(240).default(""),
  phone: z.string().trim().max(64).default(""),
  icEmail: z.string().trim().max(320).default(""),
  passportImageUrl: z.string().trim().max(2_048).default(""),
  note: z.string().max(2_000).default(""),
});

export const ogpComplaintEvidenceRowSchema = z.object({
  id: z.string().trim().min(1).max(64),
  mode: z.string().trim().max(64).default("link"),
  templateKey: z.string().trim().max(120).default("custom"),
  labelSnapshot: z.string().trim().max(240).default(""),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
  label: z.string().trim().max(240).default(""),
  url: z
    .string()
    .trim()
    .max(2_048)
    .default("")
    .refine(isValidOptionalHttpUrl, {
      message: "Ссылка должна быть пустой или начинаться с http/https.",
    }),
  note: z.string().max(2_000).default(""),
});

export const ogpComplaintEvidenceGroupSchema = z.object({
  id: z.string().trim().min(1).max(64),
  title: z.string().trim().max(160).default(""),
  rows: z.array(ogpComplaintEvidenceRowSchema).max(20).default([]),
});

export const ogpComplaintDraftPayloadSchema = z.object({
  filingMode: ogpComplaintFilingModeSchema.default("self"),
  appealNumber: z.string().trim().max(120).default(""),
  objectOrganization: z.string().trim().max(160).default(""),
  objectFullName: z.string().trim().max(160).default(""),
  incidentAt: z
    .string()
    .trim()
    .max(32)
    .default("")
    .refine((value) => value === "" || datetimeLocalPattern.test(value), {
      message: "Дата и время инцидента должны быть пустыми или в формате YYYY-MM-DDTHH:mm.",
    }),
  situationDescription: z.string().max(12_000).default(""),
  violationSummary: z.string().max(8_000).default(""),
  workingNotes: documentWorkingNotesSchema,
  trustorSnapshot: ogpComplaintTrustorSnapshotSchema.nullable().optional(),
  evidenceGroups: z.array(ogpComplaintEvidenceGroupSchema).max(12).default([]),
});

const claimsDraftPayloadBaseSchema = z.object({
  filingMode: ogpComplaintFilingModeSchema.default("self"),
  respondentName: z.string().trim().max(160).default(""),
  claimSubject: z.string().trim().max(240).default(""),
  factualBackground: z.string().max(12_000).default(""),
  legalBasisSummary: z.string().max(8_000).default(""),
  requestedRelief: z.string().max(8_000).default(""),
  workingNotes: documentWorkingNotesSchema,
  trustorSnapshot: ogpComplaintTrustorSnapshotSchema.nullable().optional(),
  evidenceGroups: z.array(ogpComplaintEvidenceGroupSchema).max(12).default([]),
});

export const rehabilitationClaimDraftPayloadSchema = claimsDraftPayloadBaseSchema.extend({
  caseReference: z.string().trim().max(160).default(""),
  rehabilitationBasis: z.string().max(8_000).default(""),
  harmSummary: z.string().max(8_000).default(""),
});

export const lawsuitClaimDraftPayloadSchema = claimsDraftPayloadBaseSchema.extend({
  courtName: z.string().trim().max(200).default(""),
  defendantName: z.string().trim().max(160).default(""),
  claimAmount: z.string().trim().max(80).default(""),
  pretrialSummary: z.string().max(8_000).default(""),
});

export const createDocumentDraftInputSchema = z.object({
  accountId: z.string().uuid(),
  serverId: z.string().min(1),
  characterId: z.string().trim().min(1),
  documentType: documentTypeSchema,
  title: documentTitleSchema,
  formSchemaVersion: documentFormSchemaVersionSchema,
  snapshotCapturedAt: z.date(),
  authorSnapshotJson: z.record(z.string(), z.unknown()),
  formPayloadJson: z.record(z.string(), z.unknown()).optional(),
});

export const updateDocumentDraftInputSchema = z.object({
  documentId: documentIdSchema,
  title: documentTitleSchema,
  formPayloadJson: z.record(z.string(), z.unknown()),
});

export const createOgpComplaintDraftActionInputSchema = z.object({
  serverSlug: z.string().trim().min(1),
  characterId: z.string().trim().min(1),
  title: documentTitleSchema.catch("Жалоба в ОГП"),
  payload: z.unknown(),
});

export const createClaimDraftActionInputSchema = z.object({
  serverSlug: z.string().trim().min(1),
  characterId: z.string().trim().min(1),
  documentType: claimDocumentTypeSchema,
  title: z.string().trim().max(160).default(""),
  payload: z.unknown(),
});

export const saveDocumentDraftActionInputSchema = z.object({
  documentId: documentIdSchema,
  title: documentTitleSchema,
  payload: z.unknown(),
});

export const generateOgpComplaintBbcodeActionInputSchema = z.object({
  documentId: documentIdSchema,
});

export const generateClaimsStructuredPreviewActionInputSchema = z.object({
  documentId: documentIdSchema,
});

export const generateClaimsStructuredCheckpointActionInputSchema = z.object({
  documentId: documentIdSchema,
});

export const publishOgpComplaintCreateActionInputSchema = z.object({
  documentId: documentIdSchema,
});

export const updateDocumentPublicationMetadataActionInputSchema = z.object({
  documentId: documentIdSchema,
  publicationUrl: documentPublicationUrlSchema,
  isSiteForumSynced: z.boolean().default(false),
});

export const documentAuthorSnapshotSchema = z.object({
  characterId: z.string().trim().min(1),
  serverId: z.string().trim().min(1),
  serverCode: z.string().trim().min(1),
  serverName: z.string().trim().min(1),
  fullName: z.string().trim().min(1),
  nickname: z.string().trim().min(1),
  passportNumber: z.string().trim().min(1),
  position: z.string().trim().max(160).default(""),
  address: z.string().trim().max(240).default(""),
  phone: z.string().trim().max(64).default(""),
  icEmail: z.string().trim().max(320).default(""),
  passportImageUrl: z.string().trim().max(2_048).default(""),
  isProfileComplete: z.boolean(),
  roleKeys: z.array(z.string()),
  accessFlags: z.array(z.string()),
  capturedAt: z.string().datetime(),
});

export const claimsRenderedSectionSchema = z.object({
  key: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(200),
  body: z.string(),
});

export const claimsRenderedOutputSchema = z.object({
  family: z.literal("claims"),
  documentType: claimDocumentTypeSchema,
  format: z.literal(claimsStructuredPreviewFormat),
  rendererVersion: documentGeneratedRendererVersionSchema,
  sections: z.array(claimsRenderedSectionSchema).max(32),
  copyText: documentGeneratedArtifactTextSchema,
  blockingReasons: z.array(z.string()).max(32),
});

export type DocumentType = z.infer<typeof documentTypeSchema>;
export type DocumentStatus = z.infer<typeof documentStatusSchema>;
export type OgpForumSyncState = z.infer<typeof ogpForumSyncStateSchema>;
export type ClaimDocumentType = z.infer<typeof claimDocumentTypeSchema>;
export type OgpComplaintFilingMode = z.infer<typeof ogpComplaintFilingModeSchema>;
export type DocumentAuthorSnapshot = z.infer<typeof documentAuthorSnapshotSchema>;
export type OgpComplaintTrustorSnapshot = z.infer<typeof ogpComplaintTrustorSnapshotSchema>;
export type OgpComplaintEvidenceRow = z.infer<typeof ogpComplaintEvidenceRowSchema>;
export type OgpComplaintEvidenceGroup = z.infer<typeof ogpComplaintEvidenceGroupSchema>;
export type OgpComplaintDraftPayload = z.infer<typeof ogpComplaintDraftPayloadSchema>;
export type ClaimsCommonDraftPayload = z.infer<typeof claimsDraftPayloadBaseSchema>;
export type RehabilitationClaimDraftPayload = z.infer<typeof rehabilitationClaimDraftPayloadSchema>;
export type LawsuitClaimDraftPayload = z.infer<typeof lawsuitClaimDraftPayloadSchema>;
export type ClaimsDraftPayload = RehabilitationClaimDraftPayload | LawsuitClaimDraftPayload;
export type ClaimsRenderedSection = z.infer<typeof claimsRenderedSectionSchema>;
export type ClaimsRenderedOutput = z.infer<typeof claimsRenderedOutputSchema>;
