import type {
  ClaimDocumentType,
  ClaimsDraftPayload,
  OgpComplaintDraftPayload,
} from "@/schemas/document";
import type {
  ClaimsDocumentRewriteSectionKey,
  DocumentRewriteSectionKey,
  GroundedClaimsDocumentRewriteSectionKey,
  GroundedDocumentRewriteSectionKey,
  GroundedOgpDocumentRewriteSectionKey,
  OgpDocumentRewriteSectionKey,
} from "@/schemas/document-ai";

export function getDocumentRewriteSectionLabel(sectionKey: DocumentRewriteSectionKey) {
  switch (sectionKey) {
    case "situation_description":
      return "Situation description";
    case "violation_summary":
      return "Violation summary";
    case "factual_background":
      return "Factual background";
    case "legal_basis_summary":
      return "Legal basis summary";
    case "requested_relief":
      return "Requested relief";
    case "rehabilitation_basis":
      return "Rehabilitation basis";
    case "harm_summary":
      return "Harm summary";
    case "pretrial_summary":
      return "Pretrial summary";
  }
}

export function isOgpRewriteSectionKey(
  sectionKey: DocumentRewriteSectionKey,
): sectionKey is OgpDocumentRewriteSectionKey {
  return sectionKey === "situation_description" || sectionKey === "violation_summary";
}

export function isClaimsRewriteSectionKey(
  sectionKey: DocumentRewriteSectionKey,
): sectionKey is ClaimsDocumentRewriteSectionKey {
  return (
    sectionKey === "factual_background" ||
    sectionKey === "legal_basis_summary" ||
    sectionKey === "requested_relief" ||
    sectionKey === "rehabilitation_basis" ||
    sectionKey === "harm_summary" ||
    sectionKey === "pretrial_summary"
  );
}

export function isGroundedOgpRewriteSectionKey(
  sectionKey: GroundedDocumentRewriteSectionKey,
): sectionKey is GroundedOgpDocumentRewriteSectionKey {
  return sectionKey === "violation_summary";
}

export function isGroundedClaimsRewriteSectionKey(
  sectionKey: GroundedDocumentRewriteSectionKey,
): sectionKey is GroundedClaimsDocumentRewriteSectionKey {
  return sectionKey === "legal_basis_summary" || sectionKey === "requested_relief";
}

export function isRewriteSectionSupportedForDocumentType(
  documentType: "ogp_complaint" | ClaimDocumentType,
  sectionKey: DocumentRewriteSectionKey,
) {
  if (documentType === "ogp_complaint") {
    return isOgpRewriteSectionKey(sectionKey);
  }

  if (
    sectionKey === "factual_background" ||
    sectionKey === "legal_basis_summary" ||
    sectionKey === "requested_relief"
  ) {
    return true;
  }

  if (documentType === "rehabilitation") {
    return sectionKey === "rehabilitation_basis" || sectionKey === "harm_summary";
  }

  return sectionKey === "pretrial_summary";
}

export function isGroundedRewriteSectionSupportedForDocumentType(
  documentType: "ogp_complaint" | ClaimDocumentType,
  sectionKey: GroundedDocumentRewriteSectionKey,
) {
  if (documentType === "ogp_complaint") {
    return isGroundedOgpRewriteSectionKey(sectionKey);
  }

  return isGroundedClaimsRewriteSectionKey(sectionKey);
}

export function getOgpRewriteSectionText(
  payload: OgpComplaintDraftPayload,
  sectionKey: OgpDocumentRewriteSectionKey,
) {
  if (sectionKey === "situation_description") {
    return payload.situationDescription;
  }

  return payload.violationSummary;
}

export function applyOgpRewriteSuggestion(
  payload: OgpComplaintDraftPayload,
  sectionKey: OgpDocumentRewriteSectionKey,
  suggestionText: string,
): OgpComplaintDraftPayload {
  if (sectionKey === "situation_description") {
    return {
      ...payload,
      situationDescription: suggestionText,
    };
  }

  return {
    ...payload,
    violationSummary: suggestionText,
  };
}

export function getClaimsRewriteSectionText(
  payload: ClaimsDraftPayload,
  sectionKey: ClaimsDocumentRewriteSectionKey,
) {
  switch (sectionKey) {
    case "factual_background":
      return payload.factualBackground;
    case "legal_basis_summary":
      return payload.legalBasisSummary;
    case "requested_relief":
      return payload.requestedRelief;
    case "rehabilitation_basis":
      return "rehabilitationBasis" in payload ? payload.rehabilitationBasis : "";
    case "harm_summary":
      return "harmSummary" in payload ? payload.harmSummary : "";
    case "pretrial_summary":
      return "pretrialSummary" in payload ? payload.pretrialSummary : "";
  }
}

export function applyClaimsRewriteSuggestion(
  payload: ClaimsDraftPayload,
  sectionKey: ClaimsDocumentRewriteSectionKey,
  suggestionText: string,
): ClaimsDraftPayload {
  switch (sectionKey) {
    case "factual_background":
      return {
        ...payload,
        factualBackground: suggestionText,
      };
    case "legal_basis_summary":
      return {
        ...payload,
        legalBasisSummary: suggestionText,
      };
    case "requested_relief":
      return {
        ...payload,
        requestedRelief: suggestionText,
      };
    case "rehabilitation_basis":
      return {
        ...payload,
        rehabilitationBasis: suggestionText,
      } as ClaimsDraftPayload;
    case "harm_summary":
      return {
        ...payload,
        harmSummary: suggestionText,
      } as ClaimsDraftPayload;
    case "pretrial_summary":
      return {
        ...payload,
        pretrialSummary: suggestionText,
      } as ClaimsDraftPayload;
  }
}
