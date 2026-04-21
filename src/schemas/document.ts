import { z } from "zod";

export const documentTypes = ["ogp_complaint", "rehabilitation", "lawsuit"] as const;
export const documentStatuses = ["draft", "generated", "published"] as const;

export const documentIdSchema = z.string().trim().min(1);
export const documentTypeSchema = z.enum(documentTypes);
export const documentStatusSchema = z.enum(documentStatuses);
export const documentTitleSchema = z.string().trim().min(3).max(160);
export const documentWorkingNotesSchema = z.string().max(12_000).default("");
export const documentFormSchemaVersionSchema = z.string().trim().min(1).max(64);

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
  workingNotes: documentWorkingNotesSchema,
});

export const saveDocumentDraftActionInputSchema = z.object({
  documentId: documentIdSchema,
  title: documentTitleSchema,
  workingNotes: documentWorkingNotesSchema,
});

export const documentAuthorSnapshotSchema = z.object({
  characterId: z.string().trim().min(1),
  serverId: z.string().trim().min(1),
  serverCode: z.string().trim().min(1),
  serverName: z.string().trim().min(1),
  fullName: z.string().trim().min(1),
  nickname: z.string().trim().min(1),
  passportNumber: z.string().trim().min(1),
  isProfileComplete: z.boolean(),
  roleKeys: z.array(z.string()),
  accessFlags: z.array(z.string()),
  capturedAt: z.string().datetime(),
});

export const ogpComplaintDraftPayloadSchema = z.object({
  workingNotes: documentWorkingNotesSchema,
});

export type DocumentType = z.infer<typeof documentTypeSchema>;
export type DocumentStatus = z.infer<typeof documentStatusSchema>;
export type DocumentAuthorSnapshot = z.infer<typeof documentAuthorSnapshotSchema>;
export type OgpComplaintDraftPayload = z.infer<typeof ogpComplaintDraftPayloadSchema>;
