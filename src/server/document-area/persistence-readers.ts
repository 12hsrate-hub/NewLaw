import { ZodError } from "zod";

import { buildAttorneyRequestPeriod } from "@/features/documents/attorney-request/build-period";
import { buildDefaultAttorneyRequestSection1 } from "@/features/documents/attorney-request/build-default-section1";
import { buildDefaultAttorneyRequestSection3 } from "@/features/documents/attorney-request/build-default-section3";
import { normalizeAttorneyRequestNumber } from "@/features/documents/attorney-request/normalize-request-number";
import { resolveAttorneyRequestSignerTitle } from "@/features/documents/attorney-request/presets";
import {
  attorneyRequestDraftPayloadSchema,
  type AttorneyRequestDraftPayload,
} from "@/features/documents/attorney-request/schemas";
import { LEGAL_SERVICES_AGREEMENT_FORM_SCHEMA_VERSION } from "@/features/documents/legal-services-agreement/types";
import {
  legalServicesAgreementDraftPayloadSchema,
  type LegalServicesAgreementDraftPayload,
} from "@/features/documents/legal-services-agreement/schemas";
import { normalizeLegalServicesAgreementNumber } from "@/features/documents/legal-services-agreement/formatting";
import {
  normalizeIcEmail,
  normalizePassportNumber,
  normalizePhone,
  normalizeSafeUrl,
} from "@/lib/ogp/generation-contract";
import {
  claimDocumentTypeSchema,
  documentAuthorSnapshotSchema,
  documentSignatureSnapshotSchema,
  lawsuitClaimDraftPayloadSchema,
  ogpComplaintDraftPayloadSchema,
  rehabilitationClaimDraftPayloadSchema,
  type ClaimDocumentType,
  type ClaimsDraftPayload,
  type DocumentAuthorSnapshot,
  type DocumentSignatureSnapshot,
  type OgpComplaintDraftPayload,
} from "@/schemas/document";
import { DocumentValidationError } from "@/server/document-area/persistence-errors";

export type SafeDocumentReadResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      message: string;
    };

function readLegacyEvidenceText(row: unknown, key: string) {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return "";
  }

  const value = (row as Record<string, unknown>)[key];

  return typeof value === "string" ? value.trim() : "";
}

function readLegacyEvidenceSortOrder(row: unknown, fallbackSortOrder: number) {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return fallbackSortOrder;
  }

  const value = (row as Record<string, unknown>).sortOrder;

  return typeof value === "number" && Number.isInteger(value) ? value : fallbackSortOrder;
}

function normalizeLegacyOgpEvidenceItems(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return input;
  }

  const payload = input as Record<string, unknown>;

  if (Array.isArray(payload.evidenceItems)) {
    return input;
  }

  if (!Array.isArray(payload.evidenceGroups)) {
    return input;
  }

  let fallbackSortOrder = 0;
  const evidenceItems = payload.evidenceGroups.flatMap((group) => {
    if (!group || typeof group !== "object" || Array.isArray(group)) {
      return [];
    }

    const groupTitle = readLegacyEvidenceText(group, "title");
    const rows = (group as Record<string, unknown>).rows;

    if (!Array.isArray(rows)) {
      return [];
    }

    return rows.map((row) => {
      const item = {
        id: readLegacyEvidenceText(row, "id") || `legacy_evidence_${fallbackSortOrder}`,
        mode: "custom" as const,
        templateKey: null,
        labelSnapshot:
          readLegacyEvidenceText(row, "labelSnapshot") ||
          readLegacyEvidenceText(row, "label") ||
          groupTitle,
        url: readLegacyEvidenceText(row, "url"),
        sortOrder: readLegacyEvidenceSortOrder(row, fallbackSortOrder),
      };
      fallbackSortOrder += 1;

      return item;
    });
  });

  return {
    ...payload,
    evidenceItems,
  };
}

export function normalizeOgpComplaintDraftPayload(input: unknown): OgpComplaintDraftPayload {
  try {
    const parsed = ogpComplaintDraftPayloadSchema.parse(normalizeLegacyOgpEvidenceItems(input));

    return {
      ...parsed,
      trustorSnapshot:
        parsed.filingMode === "representative"
          ? {
              sourceType: parsed.trustorSnapshot?.sourceType ?? "inline_manual",
              fullName: parsed.trustorSnapshot?.fullName.trim() ?? "",
              passportNumber: normalizePassportNumber(parsed.trustorSnapshot?.passportNumber ?? ""),
              address: parsed.trustorSnapshot?.address.trim() ?? "",
              phone: normalizePhone(parsed.trustorSnapshot?.phone ?? ""),
              icEmail: normalizeIcEmail(parsed.trustorSnapshot?.icEmail ?? ""),
              passportImageUrl: normalizeSafeUrl(parsed.trustorSnapshot?.passportImageUrl ?? ""),
              note: parsed.trustorSnapshot?.note ?? "",
            }
          : null,
      evidenceItems: parsed.evidenceItems
        .map((item, index) => ({
          ...item,
          templateKey: item.mode === "template" ? item.templateKey : null,
          labelSnapshot: item.labelSnapshot.trim(),
          url: normalizeSafeUrl(item.url),
          sortOrder: item.sortOrder ?? index,
        }))
        .sort((left, right) =>
          left.sortOrder === right.sortOrder
            ? left.id.localeCompare(right.id)
            : left.sortOrder - right.sortOrder,
        ),
    };
  } catch (error) {
    if (error instanceof ZodError) {
      throw new DocumentValidationError();
    }

    throw error;
  }
}

function buildEmptyTrustorSnapshot() {
  return {
    sourceType: "inline_manual" as const,
    fullName: "",
    passportNumber: "",
    address: "",
    phone: "",
    icEmail: "",
    passportImageUrl: "",
    note: "",
  };
}

function buildEmptyClaimsDraftPayload(documentType: ClaimDocumentType): ClaimsDraftPayload {
  const commonFields = {
    filingMode: "self" as const,
    respondentName: "",
    claimSubject: "",
    factualBackground: "",
    legalBasisSummary: "",
    requestedRelief: "",
    workingNotes: "",
    trustorSnapshot: null,
    evidenceGroups: [],
  };

  if (documentType === "rehabilitation") {
    return {
      ...commonFields,
      caseReference: "",
      rehabilitationBasis: "",
      harmSummary: "",
    };
  }

  return {
    ...commonFields,
    courtName: "",
    defendantName: "",
    claimAmount: "",
    pretrialSummary: "",
  };
}

export function normalizeClaimsDraftPayload(
  documentType: ClaimDocumentType,
  input: unknown,
): ClaimsDraftPayload {
  try {
    const parsed =
      documentType === "rehabilitation"
        ? rehabilitationClaimDraftPayloadSchema.parse(input)
        : lawsuitClaimDraftPayloadSchema.parse(input);

    return {
      ...parsed,
      trustorSnapshot:
        parsed.filingMode === "representative"
          ? (parsed.trustorSnapshot ?? buildEmptyTrustorSnapshot())
          : null,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      throw new DocumentValidationError();
    }

    throw error;
  }
}

function buildMskNow(now: Date) {
  return now.toISOString();
}

function buildMskDateLabel(now: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Moscow",
  }).format(now);
}

function buildResponseDueAtMsk(now: Date) {
  return new Date(now.getTime() + 26 * 60 * 60 * 1000).toISOString();
}

function isDefaultAttorneyRequestSection1Item(input: {
  item: unknown;
  id: "1" | "2" | "3";
}) {
  if (!input.item || typeof input.item !== "object" || Array.isArray(input.item)) {
    return false;
  }

  const text = String((input.item as { text?: unknown }).text ?? "").trim();

  if (text.length === 0) {
    return true;
  }

  if (input.id === "1") {
    return text.startsWith("Прошу предоставить видеозаписи и материалы фиксации");
  }

  if (input.id === "2") {
    return text.startsWith("Если процессуальные действия");
  }

  return text.startsWith("Прошу предоставить личные данные");
}

function shouldRefreshAttorneyRequestSection1(section1Items: unknown) {
  if (!Array.isArray(section1Items) || section1Items.length !== 3) {
    return true;
  }

  return (
    isDefaultAttorneyRequestSection1Item({ item: section1Items[0], id: "1" }) &&
    isDefaultAttorneyRequestSection1Item({ item: section1Items[1], id: "2" }) &&
    isDefaultAttorneyRequestSection1Item({ item: section1Items[2], id: "3" })
  );
}

function isDefaultAttorneyRequestSection3(section3Text: unknown) {
  const text = String(section3Text ?? "").trim();

  return text.length === 0 || text.startsWith("Адвокатский запрос о предоставлении личных данных");
}

export function normalizeAttorneyRequestDraftPayload(input: {
  rawPayload: unknown;
  authorSnapshot: DocumentAuthorSnapshot;
  trustorSnapshot: AttorneyRequestDraftPayload["trustorSnapshot"];
  frozenSignerTitleSnapshot?: AttorneyRequestDraftPayload["signerTitleSnapshot"];
  frozenTemporalSnapshot?: Pick<
    AttorneyRequestDraftPayload,
    "startedAtMsk" | "documentDateMsk" | "responseDueAtMsk"
  >;
  capturedAt: Date;
}): AttorneyRequestDraftPayload {
  const raw =
    typeof input.rawPayload === "object" && input.rawPayload !== null && !Array.isArray(input.rawPayload)
      ? (input.rawPayload as Record<string, unknown>)
      : {};
  const requestNumberRawInput = String(raw.requestNumberRawInput ?? "");
  const requestNumber = normalizeAttorneyRequestNumber(requestNumberRawInput);
  const requestDate = String(raw.requestDate ?? "");
  const timeFrom = String(raw.timeFrom ?? "");
  const timeTo = String(raw.timeTo ?? "");
  const period = buildAttorneyRequestPeriod({
    requestDate,
    timeFrom,
    timeTo,
  });
  const signerTitleSnapshot =
    input.frozenSignerTitleSnapshot ?? resolveAttorneyRequestSignerTitle(input.authorSnapshot.position);
  const temporalSnapshot = input.frozenTemporalSnapshot ?? {
    startedAtMsk: buildMskNow(input.capturedAt),
    documentDateMsk: buildMskDateLabel(input.capturedAt),
    responseDueAtMsk: buildResponseDueAtMsk(input.capturedAt),
  };
  const addresseePreset = raw.addresseePreset ?? null;
  const targetOfficerInput = String(raw.targetOfficerInput ?? "");
  const contractNumber = String(raw.contractNumber ?? "");
  const defaultSection1Items = buildDefaultAttorneyRequestSection1({
    contractNumber,
    trustorSnapshot: input.trustorSnapshot,
    targetOfficerInput,
    period,
    authorIcEmail: input.authorSnapshot.icEmail,
  });
  const section1Items = shouldRefreshAttorneyRequestSection1(raw.section1Items)
    ? defaultSection1Items
    : raw.section1Items;
  const defaultSection3Text = buildDefaultAttorneyRequestSection3({
    addresseePreset: addresseePreset as AttorneyRequestDraftPayload["addresseePreset"],
    targetOfficerInput,
  });
  const section3Text = String(
    isDefaultAttorneyRequestSection3(raw.section3Text)
      ? defaultSection3Text
      : raw.section3Text ?? defaultSection3Text,
  );

  return attorneyRequestDraftPayloadSchema.parse({
    ...raw,
    requestNumberRawInput,
    requestNumberNormalized: requestNumber.normalized,
    contractNumber,
    addresseePreset,
    targetOfficerInput,
    requestDate,
    timeFrom,
    timeTo,
    crossesMidnight: period.crossesMidnight,
    periodStartAt: period.periodStartAt,
    periodEndAt: period.periodEndAt,
    startedAtMsk: temporalSnapshot.startedAtMsk,
    documentDateMsk: temporalSnapshot.documentDateMsk,
    responseDueAtMsk: temporalSnapshot.responseDueAtMsk,
    signerTitleSnapshot,
    trustorSnapshot: input.trustorSnapshot,
    section1Items,
    section3Text,
    validationState: raw.validationState ?? {},
    workingNotes: String(raw.workingNotes ?? ""),
  });
}

function buildLegalServicesAgreementDateLabel(now: Date) {
  const parts = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Moscow",
  }).formatToParts(now);
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const year = parts.find((part) => part.type === "year")?.value ?? "";

  return [day, month.charAt(0).toUpperCase() + month.slice(1), year].filter(Boolean).join(" ");
}

export function normalizeLegalServicesAgreementDraftPayload(input: {
  rawPayload: unknown;
  trustorSnapshot: LegalServicesAgreementDraftPayload["trustorSnapshot"];
  capturedAt: Date;
}) {
  const raw =
    typeof input.rawPayload === "object" && input.rawPayload !== null && !Array.isArray(input.rawPayload)
      ? (input.rawPayload as Record<string, unknown>)
      : {};
  const manualFields =
    typeof raw.manualFields === "object" &&
    raw.manualFields !== null &&
    !Array.isArray(raw.manualFields)
      ? (raw.manualFields as Record<string, unknown>)
      : typeof raw.provisionalFields === "object" &&
          raw.provisionalFields !== null &&
          !Array.isArray(raw.provisionalFields)
        ? (raw.provisionalFields as Record<string, unknown>)
        : {};

  return legalServicesAgreementDraftPayloadSchema.parse({
    formSchemaVersion: LEGAL_SERVICES_AGREEMENT_FORM_SCHEMA_VERSION,
    trustorSnapshot: input.trustorSnapshot,
    manualFields: {
      agreementNumber: normalizeLegalServicesAgreementNumber(
        String(manualFields.agreementNumber ?? ""),
      ),
      registerNumber: String(manualFields.registerNumber ?? ""),
      agreementDate:
        String(manualFields.agreementDate ?? manualFields.agreementDateLabel ?? "").trim() ||
        buildLegalServicesAgreementDateLabel(input.capturedAt),
      servicePeriodStart: String(
        manualFields.servicePeriodStart ?? manualFields.servicePeriodStartDate ?? "",
      ),
      servicePeriodEnd: String(
        manualFields.servicePeriodEnd ?? manualFields.servicePeriodEndDate ?? "",
      ),
      priceAmount: String(manualFields.priceAmount ?? manualFields.priceAmountDisplay ?? ""),
    },
    workingNotes: String(raw.workingNotes ?? ""),
  });
}

export function isClaimsDocumentType(
  documentType:
    | "ogp_complaint"
    | "rehabilitation"
    | "lawsuit"
    | "attorney_request"
    | "legal_services_agreement",
): documentType is ClaimDocumentType {
  return claimDocumentTypeSchema.safeParse(documentType).success;
}

export function readDocumentAuthorSnapshot(snapshot: unknown) {
  return documentAuthorSnapshotSchema.parse(snapshot);
}

export function readDocumentSignatureSnapshot(snapshot: unknown): DocumentSignatureSnapshot | null {
  if (!snapshot) {
    return null;
  }

  return documentSignatureSnapshotSchema.parse(snapshot);
}

function buildSafeReadErrorMessage(error: unknown) {
  if (error instanceof ZodError) {
    const issue = error.issues[0];

    if (!issue) {
      return "Invalid document data.";
    }

    const path = issue.path.length > 0 ? issue.path.join(".") : "root";

    return `Invalid document data at ${path}: ${issue.message}`;
  }

  if (error instanceof DocumentValidationError) {
    return error.message;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Unknown document data error.";
}

export function safeReadDocumentAuthorSnapshot(
  snapshot: unknown,
): SafeDocumentReadResult<DocumentAuthorSnapshot> {
  const parsed = documentAuthorSnapshotSchema.safeParse(snapshot);

  if (parsed.success) {
    return {
      ok: true,
      data: parsed.data,
    };
  }

  return {
    ok: false,
    message: buildSafeReadErrorMessage(parsed.error),
  };
}

export function safeReadDocumentSignatureSnapshot(
  snapshot: unknown,
): SafeDocumentReadResult<DocumentSignatureSnapshot | null> {
  if (!snapshot) {
    return {
      ok: true,
      data: null,
    };
  }

  const parsed = documentSignatureSnapshotSchema.safeParse(snapshot);

  if (parsed.success) {
    return {
      ok: true,
      data: parsed.data,
    };
  }

  return {
    ok: false,
    message: buildSafeReadErrorMessage(parsed.error),
  };
}

export function readOgpComplaintDraftPayload(payload: unknown) {
  try {
    return normalizeOgpComplaintDraftPayload(payload);
  } catch (error) {
    if (error instanceof DocumentValidationError) {
      return {
        filingMode: "self",
        appealNumber: "",
        objectOrganization: "",
        objectFullName: "",
        incidentAt: "",
        situationDescription: "",
        violationSummary: "",
        workingNotes: "",
        trustorSnapshot: null,
        evidenceItems: [],
      } satisfies OgpComplaintDraftPayload;
    }

    throw error;
  }
}

export function readClaimsDraftPayload(documentType: ClaimDocumentType, payload: unknown) {
  try {
    return normalizeClaimsDraftPayload(documentType, payload);
  } catch (error) {
    if (error instanceof DocumentValidationError) {
      return buildEmptyClaimsDraftPayload(documentType);
    }

    throw error;
  }
}

export function readAttorneyRequestDraftPayload(payload: unknown) {
  return attorneyRequestDraftPayloadSchema.parse(payload);
}

export function readLegalServicesAgreementDraftPayload(payload: unknown) {
  return legalServicesAgreementDraftPayloadSchema.parse(payload);
}

export function safeReadAttorneyRequestDraftPayload(
  payload: unknown,
): SafeDocumentReadResult<AttorneyRequestDraftPayload> {
  try {
    return {
      ok: true,
      data: readAttorneyRequestDraftPayload(payload),
    };
  } catch (error) {
    return {
      ok: false,
      message: buildSafeReadErrorMessage(error),
    };
  }
}

export function safeReadLegalServicesAgreementDraftPayload(
  payload: unknown,
): SafeDocumentReadResult<LegalServicesAgreementDraftPayload> {
  try {
    return {
      ok: true,
      data: readLegalServicesAgreementDraftPayload(payload),
    };
  } catch (error) {
    return {
      ok: false,
      message: buildSafeReadErrorMessage(error),
    };
  }
}
