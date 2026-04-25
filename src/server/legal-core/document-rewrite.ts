import {
  readClaimsDraftPayload,
  readOgpComplaintDraftPayload,
} from "@/server/document-area/persistence";

type SupportedDocumentType = "ogp_complaint" | "rehabilitation" | "lawsuit";
type SupportedSectionKey =
  | "situation_description"
  | "violation_summary"
  | "factual_background"
  | "legal_basis_summary"
  | "requested_relief"
  | "rehabilitation_basis"
  | "harm_summary"
  | "pretrial_summary";

export type DocumentRewriteFactLedger = {
  participants: string[];
  event: string | null;
  date_time: string | null;
  organization: string | null;
  evidence: string[];
  missing_data: string[];
};

function clampText(value: string, maxLength: number) {
  return value.trim().slice(0, maxLength);
}

function collectUniqueValues(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => (value ?? "").trim())
        .filter((value) => value.length > 0),
    ),
  );
}

function buildOgpFactLedger(input: {
  payload: ReturnType<typeof readOgpComplaintDraftPayload>;
  sourceText: string;
}) {
  const participants = collectUniqueValues([
    input.payload.objectFullName,
    input.payload.trustorSnapshot?.fullName,
  ]);
  const evidence = input.payload.evidenceItems
    .map((item) => item.labelSnapshot.trim())
    .filter((label) => label.length > 0);
  const missingData = [
    input.payload.objectFullName.trim().length > 0 ? null : "participants",
    input.payload.situationDescription.trim().length > 0 ? null : "event",
    input.payload.incidentAt.trim().length > 0 ? null : "date_time",
    input.payload.objectOrganization.trim().length > 0 ? null : "organization",
    evidence.length > 0 ? null : "evidence",
  ].filter((value): value is string => Boolean(value));

  return {
    participants,
    event: clampText(input.sourceText, 240) || null,
    date_time: input.payload.incidentAt.trim() || null,
    organization: input.payload.objectOrganization.trim() || null,
    evidence,
    missing_data: missingData,
  } satisfies DocumentRewriteFactLedger;
}

function buildClaimsFactLedger(input: {
  documentType: "rehabilitation" | "lawsuit";
  payload: ReturnType<typeof readClaimsDraftPayload>;
  sectionKey: SupportedSectionKey;
  sourceText: string;
}) {
  const evidence = input.payload.evidenceGroups
    .map((group) => group.title.trim())
    .filter((title) => title.length > 0);
  const participants = collectUniqueValues([
    input.payload.respondentName,
    input.payload.trustorSnapshot?.fullName,
  ]);
  const missingData = [
    input.payload.respondentName.trim().length > 0 ? null : "participants",
    input.payload.claimSubject.trim().length > 0 || input.sourceText.trim().length > 0 ? null : "event",
    null,
    input.payload.respondentName.trim().length > 0 ? null : "organization",
    evidence.length > 0 ? null : "evidence",
  ].filter((value): value is string => Boolean(value));

  return {
    participants,
    event:
      clampText(
        input.sectionKey === "factual_background"
          ? input.payload.factualBackground
          : input.payload.claimSubject || input.sourceText,
        240,
      ) || null,
    date_time: null,
    organization: input.payload.respondentName.trim() || null,
    evidence,
    missing_data: missingData,
  } satisfies DocumentRewriteFactLedger;
}

export function buildDocumentRewriteFactLedger(input: {
  documentType: SupportedDocumentType;
  payload: unknown;
  sectionKey: SupportedSectionKey;
  sourceText: string;
}) {
  if (input.documentType === "ogp_complaint") {
    return buildOgpFactLedger({
      payload: readOgpComplaintDraftPayload(input.payload),
      sourceText: input.sourceText,
    });
  }

  return buildClaimsFactLedger({
    documentType: input.documentType,
    payload: readClaimsDraftPayload(input.documentType, input.payload),
    sectionKey: input.sectionKey,
    sourceText: input.sourceText,
  });
}
