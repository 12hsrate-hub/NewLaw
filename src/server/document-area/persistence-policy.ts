import { ZodError } from "zod";

import { getCharacterByIdForAccount } from "@/db/repositories/character.repository";
import { getTrustorByIdForAccount } from "@/db/repositories/trustor.repository";
import { getDocumentDefaultTitle } from "@/lib/documents/family-registry";
import {
  normalizeIcEmail,
  normalizePassportNumber,
  normalizePhone,
  normalizeSafeUrl,
  readCharacterProfileData,
} from "@/lib/ogp/generation-contract";
import {
  claimDocumentTypeSchema,
  documentAuthorSnapshotSchema,
  documentTitleSchema,
  type ClaimDocumentType,
  type ClaimsDraftPayload,
  type DocumentAuthorSnapshot,
  type OgpComplaintDraftPayload,
} from "@/schemas/document";
import { ATTORNEY_REQUEST_FORM_SCHEMA_VERSION as ATTORNEY_REQUEST_FORM_SCHEMA_VERSION_BASE } from "@/features/documents/attorney-request/types";
import {
  LEGAL_SERVICES_AGREEMENT_FORM_SCHEMA_VERSION as LEGAL_SERVICES_AGREEMENT_FORM_SCHEMA_VERSION_BASE,
} from "@/features/documents/legal-services-agreement/types";
import {
  DocumentRepresentativeAccessError,
  DocumentValidationError,
} from "@/server/document-area/persistence-errors";

export const OGP_COMPLAINT_FORM_SCHEMA_VERSION = "ogp_complaint_mvp_editor_v1";
export const REHABILITATION_CLAIM_FORM_SCHEMA_VERSION = "rehabilitation_claim_mvp_editor_v1";
export const LAWSUIT_CLAIM_FORM_SCHEMA_VERSION = "lawsuit_claim_mvp_editor_v1";
export const ATTORNEY_REQUEST_FORM_SCHEMA_VERSION = ATTORNEY_REQUEST_FORM_SCHEMA_VERSION_BASE;
export const LEGAL_SERVICES_AGREEMENT_FORM_SCHEMA_VERSION =
  LEGAL_SERVICES_AGREEMENT_FORM_SCHEMA_VERSION_BASE;

export function buildAuthorSnapshot(input: {
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

export function canUseRepresentativeFiling(authorSnapshot: {
  accessFlags: string[];
}) {
  return authorSnapshot.accessFlags.includes("advocate");
}

export function canCreateAttorneyRequest(authorSnapshot: {
  roleKeys: string[];
}) {
  return authorSnapshot.roleKeys.includes("lawyer");
}

export function buildDocumentTrustorSnapshot(input: {
  trustor: NonNullable<Awaited<ReturnType<typeof getTrustorByIdForAccount>>>;
}) {
  return {
    trustorId: input.trustor.id,
    fullName: input.trustor.fullName,
    passportNumber: normalizePassportNumber(input.trustor.passportNumber),
    phone: input.trustor.phone ? normalizePhone(input.trustor.phone) : null,
    icEmail: input.trustor.icEmail ? normalizeIcEmail(input.trustor.icEmail) : null,
    note: input.trustor.note,
    passportImageUrl: input.trustor.passportImageUrl
      ? normalizeSafeUrl(input.trustor.passportImageUrl)
      : null,
  };
}

export function assertRepresentativeAccess(input: {
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
  return getDocumentDefaultTitle(documentType);
}

export function getDocumentFormSchemaVersion(
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

export function normalizeDocumentTitle(input: {
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
