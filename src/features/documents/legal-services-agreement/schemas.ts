import { z } from "zod";

import {
  LEGAL_SERVICES_AGREEMENT_FORM_SCHEMA_VERSION,
  LEGAL_SERVICES_AGREEMENT_OUTPUT_FORMAT,
  LEGAL_SERVICES_AGREEMENT_RENDERER_VERSION,
  LEGAL_SERVICES_AGREEMENT_TEMPLATE_VERSION,
} from "@/features/documents/legal-services-agreement/types";

export const legalServicesAgreementTrustorSnapshotSchema = z.object({
  trustorId: z.string().trim().min(1),
  fullName: z.string().trim().max(160).default(""),
  passportNumber: z.string().trim().max(64).default(""),
  phone: z.string().trim().max(64).nullable().default(null),
  icEmail: z.string().trim().max(320).nullable().default(null),
  note: z.string().max(2_000).nullable().default(null),
});

export const legalServicesAgreementManualFieldsSchema = z.object({
  agreementNumber: z.string().trim().max(80).default(""),
  registerNumber: z.string().trim().max(80).default(""),
  agreementDate: z.string().trim().max(80).default(""),
  servicePeriodStart: z.string().trim().max(64).default(""),
  servicePeriodEnd: z.string().trim().max(64).default(""),
  priceAmount: z.string().trim().max(80).default(""),
});

export const legalServicesAgreementDraftPayloadSchema = z.object({
  formSchemaVersion: z.literal(LEGAL_SERVICES_AGREEMENT_FORM_SCHEMA_VERSION),
  trustorSnapshot: legalServicesAgreementTrustorSnapshotSchema,
  manualFields: legalServicesAgreementManualFieldsSchema,
  workingNotes: z.string().max(12_000).default(""),
});

export const legalServicesAgreementGeneratedPageSchema = z.object({
  pageNumber: z.number().int().min(1).max(16),
  fileName: z.string().trim().min(1).max(240),
  pngDataUrl: z.string().max(15_000_000),
  width: z.number().int().min(1),
  height: z.number().int().min(1),
});

export const legalServicesAgreementRenderedArtifactSchema = z.object({
  family: z.literal("legal_services_agreement"),
  format: z.literal(LEGAL_SERVICES_AGREEMENT_OUTPUT_FORMAT),
  templateVersion: z.literal(LEGAL_SERVICES_AGREEMENT_TEMPLATE_VERSION),
  rendererVersion: z.literal(LEGAL_SERVICES_AGREEMENT_RENDERER_VERSION),
  referenceState: z.enum(["ready", "missing"]),
  previewHtml: z.string().max(20_000_000),
  previewText: z.string().max(200_000),
  blockingReasons: z.array(z.string()).max(32),
  pageCount: z.literal(5),
  pages: z.array(legalServicesAgreementGeneratedPageSchema).length(5),
});

export type LegalServicesAgreementDraftPayload = z.infer<
  typeof legalServicesAgreementDraftPayloadSchema
>;
export type LegalServicesAgreementRenderedArtifact = z.infer<
  typeof legalServicesAgreementRenderedArtifactSchema
>;
export type LegalServicesAgreementGeneratedPage = z.infer<
  typeof legalServicesAgreementGeneratedPageSchema
>;
