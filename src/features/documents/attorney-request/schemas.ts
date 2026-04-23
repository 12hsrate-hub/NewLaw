import { z } from "zod";

import {
  ATTORNEY_REQUEST_OUTPUT_FORMAT,
  ATTORNEY_REQUEST_RENDERER_VERSION,
} from "@/features/documents/attorney-request/types";

export const attorneyRequestAddresseePresetSchema = z.enum([
  "LSPD_CHIEF",
  "LSSD_SHERIFF",
  "FIB_DIRECTOR",
  "NG_GENERAL",
  "EMS_CHIEF_DOCTOR",
  "SASPA_CHIEF",
  "USSS_DIRECTOR",
]);

export const attorneyRequestSignerTitleSnapshotSchema = z.object({
  sourceTitle: z.string().trim().max(160).default(""),
  leftColumnEn: z.string().trim().max(160).default(""),
  bodyRu: z.string().trim().max(240).default(""),
  footerRu: z.string().trim().max(160).default(""),
});

export const attorneyRequestTrustorSnapshotSchema = z.object({
  trustorId: z.string().trim().min(1),
  fullName: z.string().trim().max(160).default(""),
  passportNumber: z.string().trim().max(64).default(""),
  phone: z.string().trim().max(64).nullable().default(null),
  icEmail: z.string().trim().max(320).nullable().default(null),
  passportImageUrl: z.string().trim().max(2_048).nullable().default(null),
  note: z.string().max(2_000).nullable().default(null),
});

export const attorneyRequestSection1ItemSchema = z.object({
  id: z.enum(["1", "2", "3"]),
  text: z.string().max(4_000).default(""),
});

export const attorneyRequestDraftPayloadSchema = z.object({
  requestNumberRawInput: z.string().max(80).default(""),
  requestNumberNormalized: z.string().trim().max(80).default(""),
  contractNumber: z.string().trim().max(120).default(""),
  addresseePreset: attorneyRequestAddresseePresetSchema.nullable().default(null),
  targetOfficerInput: z.string().trim().max(240).default(""),
  requestDate: z.string().trim().max(16).default(""),
  timeFrom: z.string().trim().max(8).default(""),
  timeTo: z.string().trim().max(8).default(""),
  crossesMidnight: z.boolean().default(false),
  periodStartAt: z.string().datetime().nullable().default(null),
  periodEndAt: z.string().datetime().nullable().default(null),
  startedAtMsk: z.string().datetime(),
  documentDateMsk: z.string().max(32),
  responseDueAtMsk: z.string().datetime(),
  signerTitleSnapshot: attorneyRequestSignerTitleSnapshotSchema.nullable().default(null),
  trustorSnapshot: attorneyRequestTrustorSnapshotSchema,
  section1Items: z.array(attorneyRequestSection1ItemSchema).length(3),
  section3Text: z.string().max(6_000).default(""),
  validationState: z.record(z.string(), z.unknown()).default({}),
  workingNotes: z.string().max(12_000).default(""),
});

export const attorneyRequestRenderedArtifactSchema = z.object({
  family: z.literal("attorney_request"),
  format: z.literal(ATTORNEY_REQUEST_OUTPUT_FORMAT),
  rendererVersion: z.literal(ATTORNEY_REQUEST_RENDERER_VERSION),
  previewHtml: z.string().max(500_000),
  previewText: z.string().max(200_000),
  pdfDataUrl: z.string().max(1_000_000),
  jpgDataUrl: z.string().max(1_000_000),
  pageCount: z.literal(1),
  blockingReasons: z.array(z.string()).max(64),
});

export type AttorneyRequestDraftPayload = z.infer<typeof attorneyRequestDraftPayloadSchema>;
export type AttorneyRequestRenderedArtifact = z.infer<typeof attorneyRequestRenderedArtifactSchema>;
