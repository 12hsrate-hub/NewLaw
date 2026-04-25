import { buildAssistantRetrievalQuery } from "@/server/legal-core/assistant-retrieval-query";
import type {
  LegalCoreActorContext,
  LegalCoreIntent,
  LegalCoreResponseMode,
} from "@/server/legal-core/metadata";
import type { LawFamily, NormRole } from "@/server/legal-core/legal-selection";

export const legalAnchors = [
  "administrative_offense",
  "detention_procedure",
  "attorney_rights",
  "attorney_request",
  "video_recording",
  "official_duty",
  "sanction",
  "exception",
  "remedy",
  "evidence",
] as const;

export type LegalAnchor = (typeof legalAnchors)[number];

export type LegalQueryPlan = {
  normalized_input: string;
  intent: LegalCoreIntent;
  actor_context: LegalCoreActorContext;
  response_mode: LegalCoreResponseMode;
  server_id: string;
  law_version: "current_snapshot_only";
  question_scope: "general_question" | "self_case" | "representative_case";
  legal_anchors: LegalAnchor[];
  required_law_families: LawFamily[];
  preferred_norm_roles: NormRole[];
  forbidden_scope_markers: string[];
  expanded_query: string;
};

function hasKeyword(source: string, keywords: string[]) {
  return keywords.some((keyword) => source.includes(keyword));
}

function pushUniqueValue<T>(target: T[], value: T) {
  if (!target.includes(value)) {
    target.push(value);
  }
}

function pushUniqueValues<T>(target: T[], values: T[]) {
  for (const value of values) {
    pushUniqueValue(target, value);
  }
}

function normalizeQuestion(input: string) {
  return input.trim().toLowerCase();
}

function buildLegalAnchors(input: {
  normalizedInput: string;
  intent: LegalCoreIntent;
}): LegalAnchor[] {
  const normalizedSource = normalizeQuestion(input.normalizedInput);
  const anchors: LegalAnchor[] = [];

  if (hasKeyword(normalizedSource, ["маск"])) {
    pushUniqueValues(anchors, ["administrative_offense", "detention_procedure", "sanction"]);
  }

  if (hasKeyword(normalizedSource, ["задерж", "арест", "кпз"])) {
    pushUniqueValues(anchors, ["detention_procedure"]);
  }

  if (hasKeyword(normalizedSource, ["адвокат", "защитник"])) {
    pushUniqueValues(anchors, ["attorney_rights"]);
  }

  if (hasKeyword(normalizedSource, ["запрос"]) && hasKeyword(normalizedSource, ["адвокат"])) {
    pushUniqueValues(anchors, ["attorney_request", "official_duty", "sanction"]);
  }

  if (
    hasKeyword(normalizedSource, [
      "бодикам",
      "body-cam",
      "bodycam",
      "видеозапис",
      "видеофиксац",
      "запись задержания",
    ])
  ) {
    pushUniqueValues(anchors, ["video_recording", "official_duty", "evidence"]);
  }

  if (input.intent === "complaint_strategy") {
    pushUniqueValue(anchors, "remedy");
  }

  if (input.intent === "evidence_check") {
    pushUniqueValue(anchors, "evidence");
  }

  if (hasKeyword(normalizedSource, ["исключ", "кроме случаев"])) {
    pushUniqueValue(anchors, "exception");
  }

  return anchors;
}

function deriveRequiredLawFamilies(anchors: LegalAnchor[]) {
  const families: LawFamily[] = [];

  for (const anchor of anchors) {
    switch (anchor) {
      case "administrative_offense":
      case "sanction":
        pushUniqueValue(families, "administrative_code");
        break;
      case "detention_procedure":
      case "video_recording":
      case "evidence":
        pushUniqueValue(families, "procedural_code");
        break;
      case "attorney_rights":
        pushUniqueValues(families, ["procedural_code", "advocacy_law"]);
        break;
      case "attorney_request":
        pushUniqueValue(families, "advocacy_law");
        break;
      case "official_duty":
        pushUniqueValues(families, ["government_code", "department_specific"]);
        break;
      case "remedy":
        pushUniqueValues(families, ["procedural_code", "advocacy_law"]);
        break;
      case "exception":
        pushUniqueValue(families, "procedural_code");
        break;
    }
  }

  return families;
}

function derivePreferredNormRoles(anchors: LegalAnchor[], intent: LegalCoreIntent) {
  const roles: NormRole[] = [];

  for (const anchor of anchors) {
    switch (anchor) {
      case "administrative_offense":
        pushUniqueValues(roles, ["primary_basis", "sanction"]);
        break;
      case "detention_procedure":
        pushUniqueValues(roles, ["primary_basis", "procedure"]);
        break;
      case "attorney_rights":
        pushUniqueValues(roles, ["right_or_guarantee", "procedure"]);
        break;
      case "attorney_request":
        pushUniqueValues(roles, ["primary_basis", "sanction", "remedy"]);
        break;
      case "video_recording":
        pushUniqueValues(roles, ["procedure", "right_or_guarantee"]);
        break;
      case "official_duty":
        pushUniqueValues(roles, ["primary_basis", "procedure"]);
        break;
      case "sanction":
        pushUniqueValue(roles, "sanction");
        break;
      case "exception":
        pushUniqueValue(roles, "exception");
        break;
      case "remedy":
        pushUniqueValue(roles, "remedy");
        break;
      case "evidence":
        pushUniqueValues(roles, ["procedure", "right_or_guarantee"]);
        break;
    }
  }

  if (intent === "law_explanation") {
    pushUniqueValues(roles, ["primary_basis", "right_or_guarantee"]);
  }

  if (intent === "qualification_check") {
    pushUniqueValues(roles, ["primary_basis", "sanction"]);
  }

  if (roles.length === 0) {
    pushUniqueValues(roles, ["primary_basis", "procedure"]);
  }

  return roles;
}

function deriveForbiddenScopeMarkers(input: {
  actorContext: LegalCoreActorContext;
  anchors: LegalAnchor[];
}) {
  const markers: string[] = [];

  if (input.actorContext === "general_question") {
    pushUniqueValues(markers, [
      "иммунитет",
      "неприкосновенность",
      "публичное мероприятие",
      "митинг",
      "национальная гвардия",
    ]);
  }

  if (!input.anchors.includes("attorney_request")) {
    pushUniqueValue(markers, "официальный адвокатский запрос");
  }

  return markers;
}

function deriveQuestionScope(actorContext: LegalCoreActorContext): LegalQueryPlan["question_scope"] {
  switch (actorContext) {
    case "self":
      return "self_case";
    case "representative_for_trustor":
      return "representative_case";
    default:
      return "general_question";
  }
}

export function buildLegalQueryPlan(input: {
  normalizedInput: string;
  intent: LegalCoreIntent;
  actorContext: LegalCoreActorContext;
  responseMode: LegalCoreResponseMode;
  serverId: string;
}) {
  const legalAnchors = buildLegalAnchors({
    normalizedInput: input.normalizedInput,
    intent: input.intent,
  });
  const requiredLawFamilies = deriveRequiredLawFamilies(legalAnchors);
  const preferredNormRoles = derivePreferredNormRoles(legalAnchors, input.intent);
  const questionScope = deriveQuestionScope(input.actorContext);
  const forbiddenScopeMarkers = deriveForbiddenScopeMarkers({
    actorContext: input.actorContext,
    anchors: legalAnchors,
  });
  const retrievalQuery = buildAssistantRetrievalQuery({
    normalized_input: input.normalizedInput,
    intent: input.intent,
    required_law_families: requiredLawFamilies,
    preferred_norm_roles: preferredNormRoles,
    legal_anchors: [...legalAnchors],
    question_scope: questionScope,
    forbidden_scope_markers: forbiddenScopeMarkers,
  });

  return {
    normalized_input: input.normalizedInput,
    intent: input.intent,
    actor_context: input.actorContext,
    response_mode: input.responseMode,
    server_id: input.serverId,
    law_version: "current_snapshot_only",
    question_scope: questionScope,
    legal_anchors: legalAnchors,
    required_law_families: requiredLawFamilies,
    preferred_norm_roles: preferredNormRoles,
    forbidden_scope_markers: forbiddenScopeMarkers,
    expanded_query: retrievalQuery.expanded_query,
  } satisfies LegalQueryPlan;
}
