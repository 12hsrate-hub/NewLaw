import { ZodError } from "zod";

import {
  createDocumentRecord,
  getDocumentByIdForAccount,
  updateDocumentAuthorSnapshotRecord,
  updateDocumentDraftRecord,
} from "@/db/repositories/document.repository";
import { getCharacterByIdForAccount } from "@/db/repositories/character.repository";
import { getServerByCode } from "@/db/repositories/server.repository";
import { getTrustorByIdForAccount } from "@/db/repositories/trustor.repository";
import { buildAttorneyRequestPeriod } from "@/features/documents/attorney-request/build-period";
import { buildDefaultAttorneyRequestSection1 } from "@/features/documents/attorney-request/build-default-section1";
import { buildDefaultAttorneyRequestSection3 } from "@/features/documents/attorney-request/build-default-section3";
import { normalizeAttorneyRequestNumber } from "@/features/documents/attorney-request/normalize-request-number";
import { resolveAttorneyRequestSignerTitle } from "@/features/documents/attorney-request/presets";
import {
  attorneyRequestDraftPayloadSchema,
  type AttorneyRequestDraftPayload,
} from "@/features/documents/attorney-request/schemas";
import { ATTORNEY_REQUEST_FORM_SCHEMA_VERSION } from "@/features/documents/attorney-request/types";
import {
  legalServicesAgreementDraftPayloadSchema,
  type LegalServicesAgreementDraftPayload,
} from "@/features/documents/legal-services-agreement/schemas";
import {
  LEGAL_SERVICES_AGREEMENT_FORM_SCHEMA_VERSION,
} from "@/features/documents/legal-services-agreement/types";
import {
  buildCharacterSignatureSnapshotFromActiveSignature,
} from "@/server/character-signatures/service";
import {
  normalizeIcEmail,
  normalizePassportNumber,
  normalizePhone,
  normalizeSafeUrl,
  readCharacterProfileData,
} from "@/lib/ogp/generation-contract";
import { setActiveCharacterSelection, setActiveServerSelection } from "@/server/app-shell/selection";
import {
  claimDocumentTypeSchema,
  createClaimDraftActionInputSchema,
  createLegalServicesAgreementDraftActionInputSchema,
  createOgpComplaintDraftActionInputSchema,
  documentAuthorSnapshotSchema,
  documentSignatureSnapshotSchema,
  documentTitleSchema,
  lawsuitClaimDraftPayloadSchema,
  ogpComplaintDraftPayloadSchema,
  rehabilitationClaimDraftPayloadSchema,
  saveDocumentDraftActionInputSchema,
  type ClaimDocumentType,
  type ClaimsDraftPayload,
  type DocumentAuthorSnapshot,
  type DocumentSignatureSnapshot,
  type OgpComplaintDraftPayload,
} from "@/schemas/document";

export const OGP_COMPLAINT_FORM_SCHEMA_VERSION = "ogp_complaint_mvp_editor_v1";
export const REHABILITATION_CLAIM_FORM_SCHEMA_VERSION = "rehabilitation_claim_mvp_editor_v1";
export const LAWSUIT_CLAIM_FORM_SCHEMA_VERSION = "lawsuit_claim_mvp_editor_v1";

type DocumentPersistenceDependencies = {
  getServerByCode: typeof getServerByCode;
  getCharacterByIdForAccount: typeof getCharacterByIdForAccount;
  getTrustorByIdForAccount?: typeof getTrustorByIdForAccount;
  createDocumentRecord: typeof createDocumentRecord;
  getDocumentByIdForAccount: typeof getDocumentByIdForAccount;
  updateDocumentDraftRecord: typeof updateDocumentDraftRecord;
  updateDocumentAuthorSnapshotRecord?: typeof updateDocumentAuthorSnapshotRecord;
  setActiveServerSelection: typeof setActiveServerSelection;
  setActiveCharacterSelection: typeof setActiveCharacterSelection;
  now: () => Date;
};

const defaultDependencies: DocumentPersistenceDependencies = {
  getServerByCode,
  getCharacterByIdForAccount,
  getTrustorByIdForAccount,
  createDocumentRecord,
  getDocumentByIdForAccount,
  updateDocumentDraftRecord,
  updateDocumentAuthorSnapshotRecord,
  setActiveServerSelection,
  setActiveCharacterSelection,
  now: () => new Date(),
};

export class DocumentServerUnavailableError extends Error {
  constructor() {
    super("Документы этого сервера сейчас недоступны. Код: DOCUMENT_SERVER_UNAVAILABLE.");
    this.name = "DocumentServerUnavailableError";
  }
}

export class DocumentCharacterUnavailableError extends Error {
  constructor() {
    super("На этом сервере нельзя создать документ без доступного персонажа.");
    this.name = "DocumentCharacterUnavailableError";
  }
}

export class DocumentAccessDeniedError extends Error {
  constructor() {
    super("Документ не найден или недоступен текущему аккаунту.");
    this.name = "DocumentAccessDeniedError";
  }
}

export class DocumentRepresentativeAccessError extends Error {
  constructor() {
    super("Representative filing доступен только персонажу с access flag advocate.");
    this.name = "DocumentRepresentativeAccessError";
  }
}

export class DocumentAttorneyRoleRequiredError extends Error {
  constructor() {
    super("Создать адвокатский запрос может только персонаж с ролью адвоката.");
    this.name = "DocumentAttorneyRoleRequiredError";
  }
}

export class DocumentValidationError extends Error {
  constructor() {
    super("Документ не прошёл валидацию.");
    this.name = "DocumentValidationError";
  }
}

function buildAuthorSnapshot(input: {
  character: NonNullable<Awaited<ReturnType<typeof getCharacterByIdForAccount>>>;
  server: {
    id: string;
    code: string;
    name: string;
  };
  capturedAt: Date;
}) {
  const profileData = readCharacterProfileData(input.character.profileDataJson);

  return documentAuthorSnapshotSchema.parse({
    characterId: input.character.id,
    serverId: input.server.id,
    serverCode: input.server.code,
    serverName: input.server.name,
    fullName: input.character.fullName,
    nickname: input.character.nickname,
    passportNumber: normalizePassportNumber(input.character.passportNumber),
    position: profileData.position,
    address: profileData.address,
    phone: profileData.phone,
    icEmail: profileData.icEmail,
    passportImageUrl: profileData.passportImageUrl,
    isProfileComplete: input.character.isProfileComplete,
    roleKeys: input.character.roles.map((role) => role.roleKey),
    accessFlags: input.character.accessFlags.map((flag) => flag.flagKey),
    capturedAt: input.capturedAt.toISOString(),
  });
}

function canUseRepresentativeFiling(authorSnapshot: {
  accessFlags: string[];
}) {
  return authorSnapshot.accessFlags.includes("advocate");
}

function canCreateAttorneyRequest(authorSnapshot: {
  roleKeys: string[];
}) {
  return authorSnapshot.roleKeys.includes("lawyer");
}

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

function normalizeOgpComplaintDraftPayload(input: unknown): OgpComplaintDraftPayload {
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

function buildDocumentTrustorSnapshot(input: {
  trustor: NonNullable<Awaited<ReturnType<typeof getTrustorByIdForAccount>>>;
}) {
  return {
    trustorId: input.trustor.id,
    fullName: input.trustor.fullName,
    passportNumber: normalizePassportNumber(input.trustor.passportNumber),
    phone: input.trustor.phone ? normalizePhone(input.trustor.phone) : null,
    icEmail: input.trustor.icEmail ? normalizeIcEmail(input.trustor.icEmail) : null,
    note: input.trustor.note,
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

function normalizeClaimsDraftPayload(documentType: ClaimDocumentType, input: unknown): ClaimsDraftPayload {
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

  return (
    text.length === 0 ||
    text.startsWith("Адвокатский запрос о предоставлении личных данных")
  );
}

function normalizeAttorneyRequestDraftPayload(input: {
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

function normalizeLegalServicesAgreementDraftPayload(input: {
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
      agreementNumber: String(manualFields.agreementNumber ?? ""),
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

function assertRepresentativeAccess(input: {
  authorSnapshot: Pick<DocumentAuthorSnapshot, "accessFlags">;
  payload: Pick<OgpComplaintDraftPayload, "filingMode"> | Pick<ClaimsDraftPayload, "filingMode">;
}) {
  if (input.payload.filingMode !== "representative") {
    return;
  }

  if (!canUseRepresentativeFiling(input.authorSnapshot)) {
    throw new DocumentRepresentativeAccessError();
  }
}

export function getDocumentTitleForType(
  documentType:
    | "ogp_complaint"
    | "rehabilitation"
    | "lawsuit"
    | "attorney_request"
    | "legal_services_agreement",
) {
  if (documentType === "ogp_complaint") {
    return "Жалоба в ОГП";
  }

  if (documentType === "rehabilitation") {
    return "Документ по реабилитации";
  }

  if (documentType === "attorney_request") {
    return "Адвокатский запрос";
  }

  if (documentType === "legal_services_agreement") {
    return "Договор на оказание юридических услуг";
  }

  return "Исковое заявление";
}

function getDocumentFormSchemaVersion(
  documentType:
    | "ogp_complaint"
    | "rehabilitation"
    | "lawsuit"
    | "attorney_request"
    | "legal_services_agreement",
) {
  if (documentType === "ogp_complaint") {
    return OGP_COMPLAINT_FORM_SCHEMA_VERSION;
  }

  if (documentType === "rehabilitation") {
    return REHABILITATION_CLAIM_FORM_SCHEMA_VERSION;
  }

  if (documentType === "attorney_request") {
    return ATTORNEY_REQUEST_FORM_SCHEMA_VERSION;
  }

  if (documentType === "legal_services_agreement") {
    return LEGAL_SERVICES_AGREEMENT_FORM_SCHEMA_VERSION;
  }

  return LAWSUIT_CLAIM_FORM_SCHEMA_VERSION;
}

function normalizeDocumentTitle(input: {
  title: string;
  documentType:
    | "ogp_complaint"
    | "rehabilitation"
    | "lawsuit"
    | "attorney_request"
    | "legal_services_agreement";
}) {
  if (input.title.length === 0) {
    return getDocumentTitleForType(input.documentType);
  }

  try {
    return documentTitleSchema.parse(input.title);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new DocumentValidationError();
    }

    throw error;
  }
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

export async function createInitialOgpComplaintDraft(
  input: {
    accountId: string;
    serverSlug: string;
    characterId: string;
    title: string;
    payload: unknown;
  },
  dependencies: DocumentPersistenceDependencies = defaultDependencies,
) {
  const parsed = createOgpComplaintDraftActionInputSchema.parse(input);
  const server = await dependencies.getServerByCode(parsed.serverSlug);

  if (!server) {
    throw new DocumentServerUnavailableError();
  }

  const character = await dependencies.getCharacterByIdForAccount({
    accountId: input.accountId,
    characterId: parsed.characterId,
  });

  if (!character || character.serverId !== server.id) {
    throw new DocumentCharacterUnavailableError();
  }

  const capturedAt = dependencies.now();
  const authorSnapshot = buildAuthorSnapshot({
    character,
    server,
    capturedAt,
  });
  const payload = normalizeOgpComplaintDraftPayload(parsed.payload);

  assertRepresentativeAccess({
    authorSnapshot,
    payload,
  });

  const createdDocument = await dependencies.createDocumentRecord({
    accountId: input.accountId,
    serverId: server.id,
    characterId: character.id,
    documentType: "ogp_complaint",
    title: parsed.title || getDocumentTitleForType("ogp_complaint"),
    formSchemaVersion: OGP_COMPLAINT_FORM_SCHEMA_VERSION,
    snapshotCapturedAt: capturedAt,
    authorSnapshotJson: authorSnapshot,
    formPayloadJson: payload,
  });

  await dependencies.setActiveServerSelection(input.accountId, {
    serverId: server.id,
  });
  await dependencies.setActiveCharacterSelection(input.accountId, {
    serverId: server.id,
    characterId: character.id,
  });

  return createdDocument;
}

export async function createInitialClaimDraft(
  input: {
    accountId: string;
    serverSlug: string;
    characterId: string;
    documentType: ClaimDocumentType;
    title: string;
    payload: unknown;
  },
  dependencies: DocumentPersistenceDependencies = defaultDependencies,
) {
  const parsed = createClaimDraftActionInputSchema.parse(input);
  const server = await dependencies.getServerByCode(parsed.serverSlug);

  if (!server) {
    throw new DocumentServerUnavailableError();
  }

  const character = await dependencies.getCharacterByIdForAccount({
    accountId: input.accountId,
    characterId: parsed.characterId,
  });

  if (!character || character.serverId !== server.id) {
    throw new DocumentCharacterUnavailableError();
  }

  const capturedAt = dependencies.now();
  const authorSnapshot = buildAuthorSnapshot({
    character,
    server,
    capturedAt,
  });
  const documentType = parsed.documentType;
  const payload = normalizeClaimsDraftPayload(documentType, parsed.payload);

  assertRepresentativeAccess({
    authorSnapshot,
    payload,
  });
  const createdDocument = await dependencies.createDocumentRecord({
    accountId: input.accountId,
    serverId: server.id,
    characterId: character.id,
    documentType,
    title: normalizeDocumentTitle({
      title: parsed.title,
      documentType,
    }),
    formSchemaVersion: getDocumentFormSchemaVersion(documentType),
    snapshotCapturedAt: capturedAt,
    authorSnapshotJson: authorSnapshot,
    formPayloadJson: payload,
  });

  await dependencies.setActiveServerSelection(input.accountId, {
    serverId: server.id,
  });
  await dependencies.setActiveCharacterSelection(input.accountId, {
    serverId: server.id,
    characterId: character.id,
  });

  return createdDocument;
}

export async function createInitialAttorneyRequestDraft(
  input: {
    accountId: string;
    serverSlug: string;
    characterId: string;
    trustorId: string;
    title: string;
    payload: unknown;
  },
  dependencies: DocumentPersistenceDependencies = defaultDependencies,
) {
  const server = await dependencies.getServerByCode(input.serverSlug);

  if (!server) {
    throw new DocumentServerUnavailableError();
  }

  const readTrustorById = dependencies.getTrustorByIdForAccount ?? getTrustorByIdForAccount;
  const [character, trustor] = await Promise.all([
    dependencies.getCharacterByIdForAccount({
      accountId: input.accountId,
      characterId: input.characterId,
    }),
    readTrustorById({
      accountId: input.accountId,
      trustorId: input.trustorId,
    }),
  ]);

  if (!character || character.serverId !== server.id) {
    throw new DocumentCharacterUnavailableError();
  }

  if (!trustor || trustor.serverId !== server.id) {
    throw new DocumentValidationError();
  }

  const capturedAt = dependencies.now();
  const authorSnapshot = buildAuthorSnapshot({
    character,
    server,
    capturedAt,
  });

  if (!canCreateAttorneyRequest(authorSnapshot)) {
    throw new DocumentAttorneyRoleRequiredError();
  }

  const trustorSnapshot = {
    trustorId: trustor.id,
    fullName: trustor.fullName,
    passportNumber: normalizePassportNumber(trustor.passportNumber),
    phone: trustor.phone ? normalizePhone(trustor.phone) : null,
    icEmail: trustor.icEmail ? normalizeIcEmail(trustor.icEmail) : null,
    passportImageUrl: trustor.passportImageUrl ? normalizeSafeUrl(trustor.passportImageUrl) : null,
    note: trustor.note,
  };
  const payload = normalizeAttorneyRequestDraftPayload({
    rawPayload: input.payload,
    authorSnapshot,
    trustorSnapshot,
    capturedAt,
  });
  const signatureSnapshot = buildCharacterSignatureSnapshotFromActiveSignature({
    activeSignature: character.activeSignature,
  });

  const createdDocument = await dependencies.createDocumentRecord({
    accountId: input.accountId,
    serverId: server.id,
    characterId: character.id,
    trustorId: trustor.id,
    documentType: "attorney_request",
    title: normalizeDocumentTitle({
      title: input.title,
      documentType: "attorney_request",
    }),
    formSchemaVersion: ATTORNEY_REQUEST_FORM_SCHEMA_VERSION,
    snapshotCapturedAt: capturedAt,
    authorSnapshotJson: authorSnapshot,
    signatureSnapshotJson: signatureSnapshot,
    formPayloadJson: payload,
  });

  await dependencies.setActiveServerSelection(input.accountId, {
    serverId: server.id,
  });
  await dependencies.setActiveCharacterSelection(input.accountId, {
    serverId: server.id,
    characterId: character.id,
  });

  return createdDocument;
}

export async function createInitialLegalServicesAgreementDraft(
  input: {
    accountId: string;
    serverSlug: string;
    characterId: string;
    trustorId: string;
    title: string;
    payload: unknown;
  },
  dependencies: DocumentPersistenceDependencies = defaultDependencies,
) {
  const parsed = createLegalServicesAgreementDraftActionInputSchema.parse(input);
  const server = await dependencies.getServerByCode(parsed.serverSlug);

  if (!server) {
    throw new DocumentServerUnavailableError();
  }

  const readTrustorById = dependencies.getTrustorByIdForAccount ?? getTrustorByIdForAccount;
  const [character, trustor] = await Promise.all([
    dependencies.getCharacterByIdForAccount({
      accountId: input.accountId,
      characterId: parsed.characterId,
    }),
    readTrustorById({
      accountId: input.accountId,
      trustorId: parsed.trustorId,
    }),
  ]);

  if (!character || character.serverId !== server.id) {
    throw new DocumentCharacterUnavailableError();
  }

  if (!trustor || trustor.serverId !== server.id) {
    throw new DocumentValidationError();
  }

  const capturedAt = dependencies.now();
  const authorSnapshot = buildAuthorSnapshot({
    character,
    server,
    capturedAt,
  });
  const trustorSnapshot = buildDocumentTrustorSnapshot({
    trustor,
  });
  const payload = normalizeLegalServicesAgreementDraftPayload({
    rawPayload: parsed.payload,
    trustorSnapshot,
    capturedAt,
  });

  const createdDocument = await dependencies.createDocumentRecord({
    accountId: input.accountId,
    serverId: server.id,
    characterId: character.id,
    trustorId: trustor.id,
    documentType: "legal_services_agreement",
    title: normalizeDocumentTitle({
      title: parsed.title,
      documentType: "legal_services_agreement",
    }),
    formSchemaVersion: LEGAL_SERVICES_AGREEMENT_FORM_SCHEMA_VERSION,
    snapshotCapturedAt: capturedAt,
    authorSnapshotJson: authorSnapshot,
    formPayloadJson: payload,
  });

  await dependencies.setActiveServerSelection(input.accountId, {
    serverId: server.id,
  });
  await dependencies.setActiveCharacterSelection(input.accountId, {
    serverId: server.id,
    characterId: character.id,
  });

  return createdDocument;
}

export async function saveOwnedDocumentDraft(
  input: {
    accountId: string;
    documentId: string;
    title: string;
    payload: unknown;
  },
  dependencies: DocumentPersistenceDependencies = defaultDependencies,
) {
    const parsed = saveDocumentDraftActionInputSchema.parse(input);
    const existingDocument = await dependencies.getDocumentByIdForAccount({
      accountId: input.accountId,
      documentId: parsed.documentId,
    });

    if (!existingDocument) {
      throw new DocumentAccessDeniedError();
    }

    if (existingDocument.documentType === "ogp_complaint") {
      const authorSnapshot = readDocumentAuthorSnapshot(existingDocument.authorSnapshotJson);
      const payload = normalizeOgpComplaintDraftPayload(parsed.payload);

      assertRepresentativeAccess({
        authorSnapshot,
        payload,
      });

      const savedDocument = await dependencies.updateDocumentDraftRecord({
        documentId: existingDocument.id,
        title: parsed.title,
        formPayloadJson: payload,
      });

      if (!savedDocument) {
        throw new DocumentAccessDeniedError();
      }

      return savedDocument;
    }

    if (existingDocument.documentType === "attorney_request") {
      const authorSnapshot = readDocumentAuthorSnapshot(existingDocument.authorSnapshotJson);
      const currentPayload = readAttorneyRequestDraftPayload(existingDocument.formPayloadJson);
      const payload = normalizeAttorneyRequestDraftPayload({
        rawPayload: {
          ...(parsed.payload && typeof parsed.payload === "object" && !Array.isArray(parsed.payload)
            ? parsed.payload
            : {}),
          trustorSnapshot: currentPayload.trustorSnapshot,
          signerTitleSnapshot: currentPayload.signerTitleSnapshot,
          startedAtMsk: currentPayload.startedAtMsk,
          documentDateMsk: currentPayload.documentDateMsk,
          responseDueAtMsk: currentPayload.responseDueAtMsk,
        },
        authorSnapshot,
        trustorSnapshot: currentPayload.trustorSnapshot,
        frozenSignerTitleSnapshot: currentPayload.signerTitleSnapshot,
        frozenTemporalSnapshot: {
          startedAtMsk: currentPayload.startedAtMsk,
          documentDateMsk: currentPayload.documentDateMsk,
          responseDueAtMsk: currentPayload.responseDueAtMsk,
        },
        capturedAt: existingDocument.snapshotCapturedAt,
      });

      const savedDocument = await dependencies.updateDocumentDraftRecord({
        documentId: existingDocument.id,
        title: parsed.title,
        formPayloadJson: payload,
      });

      if (!savedDocument) {
        throw new DocumentAccessDeniedError();
      }

      return savedDocument;
    }

    if (existingDocument.documentType === "legal_services_agreement") {
      const currentPayload = readLegalServicesAgreementDraftPayload(existingDocument.formPayloadJson);
      const payload = normalizeLegalServicesAgreementDraftPayload({
        rawPayload: {
          ...currentPayload,
          ...(parsed.payload && typeof parsed.payload === "object" && !Array.isArray(parsed.payload)
            ? parsed.payload
            : {}),
          trustorSnapshot: currentPayload.trustorSnapshot,
          formSchemaVersion: currentPayload.formSchemaVersion,
          manualFields: {
            ...currentPayload.manualFields,
            ...(
              parsed.payload &&
              typeof parsed.payload === "object" &&
              !Array.isArray(parsed.payload) &&
              typeof (parsed.payload as Record<string, unknown>).manualFields === "object" &&
              (parsed.payload as Record<string, unknown>).manualFields !== null &&
              !Array.isArray((parsed.payload as Record<string, unknown>).manualFields)
                ? ((parsed.payload as Record<string, unknown>).manualFields as Record<
                    string,
                    unknown
                  >)
                : {}
            ),
          },
        },
        trustorSnapshot: currentPayload.trustorSnapshot,
        capturedAt: existingDocument.snapshotCapturedAt,
      });

      const savedDocument = await dependencies.updateDocumentDraftRecord({
        documentId: existingDocument.id,
        title: parsed.title,
        formPayloadJson: payload,
      });

      if (!savedDocument) {
        throw new DocumentAccessDeniedError();
      }

      return savedDocument;
    }

    const authorSnapshot = readDocumentAuthorSnapshot(existingDocument.authorSnapshotJson);
    const payload = normalizeClaimsDraftPayload(existingDocument.documentType, parsed.payload);

    assertRepresentativeAccess({
      authorSnapshot,
      payload,
    });

    const savedDocument = await dependencies.updateDocumentDraftRecord({
      documentId: existingDocument.id,
      title: parsed.title,
      formPayloadJson: payload,
    });

    if (!savedDocument) {
      throw new DocumentAccessDeniedError();
    }

    return savedDocument;
}

export async function refreshOwnedOgpComplaintAuthorSnapshot(
  input: {
    accountId: string;
    documentId: string;
  },
  dependencies: DocumentPersistenceDependencies = defaultDependencies,
) {
  const existingDocument = await dependencies.getDocumentByIdForAccount({
    accountId: input.accountId,
    documentId: input.documentId,
  });

  if (!existingDocument || existingDocument.documentType !== "ogp_complaint") {
    throw new DocumentAccessDeniedError();
  }

  const character = await dependencies.getCharacterByIdForAccount({
    accountId: input.accountId,
    characterId: existingDocument.characterId,
  });

  if (!character || character.serverId !== existingDocument.serverId) {
    throw new DocumentCharacterUnavailableError();
  }

  const capturedAt = dependencies.now();
  const authorSnapshot = buildAuthorSnapshot({
    character,
    server: existingDocument.server,
    capturedAt,
  });
  const updateAuthorSnapshot =
    dependencies.updateDocumentAuthorSnapshotRecord ??
    updateDocumentAuthorSnapshotRecord;
  const refreshedDocument = await updateAuthorSnapshot({
    documentId: existingDocument.id,
    authorSnapshotJson: authorSnapshot,
    snapshotCapturedAt: capturedAt,
  });

  if (!refreshedDocument) {
    throw new DocumentAccessDeniedError();
  }

  return {
    document: refreshedDocument,
    authorSnapshot,
  };
}
