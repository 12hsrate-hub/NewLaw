import type { LegalAnchor, LegalQueryPlan } from "@/server/legal-core/legal-query-plan";
import {
  LEGAL_SEMANTIC_ANCHOR_MATCH_TERMS,
  LEGAL_SEMANTIC_ELIGIBILITY_KEYWORDS,
  LEGAL_SEMANTIC_FAMILY_HINTS,
  LEGAL_SOURCE_SPECIFICITY_PROFILES,
} from "@/server/legal-core/legal-semantic-dictionaries";

export const lawFamilies = [
  "administrative_code",
  "procedural_code",
  "criminal_code",
  "advocacy_law",
  "ethics_code",
  "constitution",
  "department_specific",
  "government_code",
  "immunity_law",
  "public_assembly_law",
  "other",
] as const;

export const normRoles = [
  "primary_basis",
  "procedure",
  "exception",
  "sanction",
  "right_or_guarantee",
  "remedy",
  "background_only",
] as const;

export const directBasisStatuses = [
  "direct_basis_present",
  "partial_basis_only",
  "no_direct_basis",
] as const;

export const primaryBasisEligibilities = ["eligible", "weak", "ineligible"] as const;

export type LawFamily = (typeof lawFamilies)[number];
export type NormRole = (typeof normRoles)[number];
export type DirectBasisStatus = (typeof directBasisStatuses)[number];
export type PrimaryBasisEligibility = (typeof primaryBasisEligibilities)[number];

export type LegalSelectionCandidate = {
  serverId: string;
  lawId: string;
  lawKey: string;
  lawTitle: string;
  lawVersionId: string;
  lawBlockId: string;
  blockType: string;
  blockText: string;
  articleNumberNormalized?: string | null;
  sourceTopicUrl: string;
  sourceChannel?: "citation_target" | "citation_companion" | "semantic" | null;
  citationResolutionStatus?:
    | "not_attempted"
    | "resolved"
    | "ambiguous"
    | "unresolved"
    | "partially_supported"
    | null;
  citationResolutionReason?: string | null;
  citationMatchStrength?:
    | "exact_article"
    | "exact_article_supported_subunit"
    | "article_with_gap"
    | "same_law_companion"
    | null;
};

export type ScoredLegalCandidate<TCandidate extends LegalSelectionCandidate = LegalSelectionCandidate> = {
  candidate: TCandidate;
  law_family: LawFamily;
  norm_role: NormRole;
  applicability_score: number;
  primary_basis_eligibility: PrimaryBasisEligibility;
  primary_basis_eligibility_reason: string | null;
  ineligible_primary_basis_reasons: string[];
  weak_primary_basis_reasons: string[];
  matched_anchors: LegalAnchor[];
  matched_required_law_family: boolean;
  matched_preferred_norm_role: boolean;
  off_topic: boolean;
  penalties: string[];
  specificity_rank: number;
  specificity_reasons: string[];
  specificity_penalties: string[];
  source_channel: LegalSelectionCandidate["sourceChannel"];
  citation_resolution_status: LegalSelectionCandidate["citationResolutionStatus"];
};

export type SelectedNormRole = {
  server_id: string;
  law_id: string;
  law_version: string;
  law_block_id: string;
  law_family: LawFamily;
  norm_role: NormRole;
  applicability_score: number;
};

export type StructuredSelectionResult<TCandidate extends LegalSelectionCandidate = LegalSelectionCandidate> = {
  scored_candidates: Array<ScoredLegalCandidate<TCandidate>>;
  primary_basis_norms: TCandidate[];
  procedure_norms: TCandidate[];
  exception_norms: TCandidate[];
  supporting_norms: TCandidate[];
  selected_norms: TCandidate[];
  selected_norm_roles: SelectedNormRole[];
  direct_basis_status: DirectBasisStatus;
};

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function hasKeyword(source: string, keywords: readonly string[]) {
  return keywords.some((keyword) => source.includes(keyword));
}

function buildCandidateTitleSearchText(candidate: LegalSelectionCandidate) {
  return normalizeText([candidate.lawKey, candidate.lawTitle].join(" "));
}

function buildCandidateLawTitleText(candidate: LegalSelectionCandidate) {
  return normalizeText(candidate.lawTitle);
}

function buildCandidateLawKeyText(candidate: LegalSelectionCandidate) {
  return normalizeText(candidate.lawKey);
}

function buildCandidateSearchText(candidate: LegalSelectionCandidate) {
  return normalizeText(
    [
      candidate.lawKey,
      candidate.lawTitle,
      candidate.blockType,
      candidate.blockText,
      candidate.articleNumberNormalized ?? "",
      candidate.sourceTopicUrl,
    ].join(" "),
  );
}

function calculateTokenOverlap(input: string, text: string) {
  const inputTokens = Array.from(
    new Set(
      normalizeText(input)
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 4),
    ),
  );

  if (inputTokens.length === 0) {
    return 0;
  }

  return inputTokens.filter((token) => text.includes(token)).length;
}

function isArticleLike(candidate: LegalSelectionCandidate) {
  return candidate.blockType.toLowerCase().includes("article");
}

export function classifyLawFamily(candidate: LegalSelectionCandidate): LawFamily {
  const titleText = buildCandidateLawTitleText(candidate);
  const keyText = buildCandidateLawKeyText(candidate);
  const text = buildCandidateSearchText(candidate);

  if (
    hasKeyword(titleText, LEGAL_SEMANTIC_FAMILY_HINTS.title.advocacy_law) ||
    hasKeyword(keyText, LEGAL_SEMANTIC_FAMILY_HINTS.key.advocacy_law)
  ) {
    return "advocacy_law";
  }

  if (
    hasKeyword(titleText, LEGAL_SEMANTIC_FAMILY_HINTS.title.administrative_code) ||
    hasKeyword(keyText, LEGAL_SEMANTIC_FAMILY_HINTS.key.administrative_code)
  ) {
    return "administrative_code";
  }

  if (
    hasKeyword(titleText, LEGAL_SEMANTIC_FAMILY_HINTS.title.procedural_code) ||
    hasKeyword(keyText, LEGAL_SEMANTIC_FAMILY_HINTS.key.procedural_code)
  ) {
    return "procedural_code";
  }

  if (
    hasKeyword(titleText, LEGAL_SEMANTIC_FAMILY_HINTS.title.criminal_code) ||
    hasKeyword(keyText, LEGAL_SEMANTIC_FAMILY_HINTS.key.criminal_code)
  ) {
    return "criminal_code";
  }

  if (
    hasKeyword(titleText, LEGAL_SEMANTIC_FAMILY_HINTS.title.ethics_code) ||
    hasKeyword(keyText, LEGAL_SEMANTIC_FAMILY_HINTS.key.ethics_code)
  ) {
    return "ethics_code";
  }

  if (
    hasKeyword(titleText, LEGAL_SEMANTIC_FAMILY_HINTS.title.constitution) ||
    hasKeyword(keyText, LEGAL_SEMANTIC_FAMILY_HINTS.key.constitution)
  ) {
    return "constitution";
  }

  if (
    hasKeyword(titleText, LEGAL_SEMANTIC_FAMILY_HINTS.title.public_assembly_law) ||
    hasKeyword(keyText, LEGAL_SEMANTIC_FAMILY_HINTS.key.public_assembly_law)
  ) {
    return "public_assembly_law";
  }

  if (
    hasKeyword(titleText, LEGAL_SEMANTIC_FAMILY_HINTS.title.immunity_law) ||
    hasKeyword(keyText, LEGAL_SEMANTIC_FAMILY_HINTS.key.immunity_law)
  ) {
    return "immunity_law";
  }

  if (
    hasKeyword(titleText, LEGAL_SEMANTIC_FAMILY_HINTS.title.department_specific) ||
    (hasKeyword(titleText, LEGAL_SEMANTIC_FAMILY_HINTS.title.department_specific_guard_pair_left) &&
      hasKeyword(titleText, LEGAL_SEMANTIC_FAMILY_HINTS.title.department_specific_guard_pair_right)) ||
    (hasKeyword(titleText, LEGAL_SEMANTIC_FAMILY_HINTS.title.department_specific_prison_left) &&
      hasKeyword(titleText, LEGAL_SEMANTIC_FAMILY_HINTS.title.department_specific_prison_right)) ||
    hasKeyword(keyText, LEGAL_SEMANTIC_FAMILY_HINTS.key.department_specific)
  ) {
    return "department_specific";
  }

  if (
    hasKeyword(titleText, LEGAL_SEMANTIC_FAMILY_HINTS.title.government_code) ||
    hasKeyword(keyText, LEGAL_SEMANTIC_FAMILY_HINTS.key.government_code)
  ) {
    return "government_code";
  }

  if (hasKeyword(text, LEGAL_SEMANTIC_FAMILY_HINTS.text.administrative_code)) {
    return "administrative_code";
  }

  if (hasKeyword(text, LEGAL_SEMANTIC_FAMILY_HINTS.text.procedural_code)) {
    return "procedural_code";
  }

  if (hasKeyword(text, LEGAL_SEMANTIC_FAMILY_HINTS.text.criminal_code)) {
    return "criminal_code";
  }

  if (
    hasKeyword(text, LEGAL_SEMANTIC_FAMILY_HINTS.text.advocacy_law) &&
    !hasKeyword(titleText, LEGAL_SEMANTIC_FAMILY_HINTS.title.advocacy_law_title_exclusions)
  ) {
    return "advocacy_law";
  }

  if (hasKeyword(text, LEGAL_SEMANTIC_FAMILY_HINTS.text.ethics_code)) {
    return "ethics_code";
  }

  if (hasKeyword(text, LEGAL_SEMANTIC_FAMILY_HINTS.text.constitution)) {
    return "constitution";
  }

  if (hasKeyword(text, LEGAL_SEMANTIC_FAMILY_HINTS.text.public_assembly_law)) {
    return "public_assembly_law";
  }

  if (hasKeyword(text, LEGAL_SEMANTIC_FAMILY_HINTS.text.immunity_law)) {
    return "immunity_law";
  }

  if (hasKeyword(text, LEGAL_SEMANTIC_FAMILY_HINTS.text.government_code)) {
    return "government_code";
  }

  if (hasKeyword(text, LEGAL_SEMANTIC_FAMILY_HINTS.text.department_specific)) {
    return "department_specific";
  }

  return "other";
}

export function classifyNormRole(candidate: LegalSelectionCandidate): NormRole {
  const text = buildCandidateSearchText(candidate);

  if (!isArticleLike(candidate)) {
    return "background_only";
  }

  if (hasKeyword(text, ["за исключением", "кроме случаев", "исключен"])) {
    return "exception";
  }

  if (
    hasKeyword(text, [
      "запрещ",
      "запрещено",
      "допускается",
      "основанием",
      "подлежит",
      "является",
      "признается",
      "признаётся",
    ])
  ) {
    return "primary_basis";
  }

  if (
    hasKeyword(text, [
      "штраф",
      "наказывается",
      "влечет",
      "влечёт",
      "лишени",
      "санкц",
      "ответственност",
    ])
  ) {
    return "sanction";
  }

  if (hasKeyword(text, ["имеет право", "право на", "гарантируется", "обеспечивается"])) {
    return "right_or_guarantee";
  }

  if (hasKeyword(text, ["обжал", "жалоб", "вправе обратиться", "может быть оспорено"])) {
    return "remedy";
  }

  if (
    hasKeyword(text, [
      "порядок",
      "процедур",
      "оформля",
      "предъяв",
      "разъясня",
      "должен",
      "обязан",
      "при задержании",
      "идентификац",
    ])
  ) {
    return "procedure";
  }

  return "primary_basis";
}

function buildAnchorTerms(anchor: LegalAnchor) {
  return LEGAL_SEMANTIC_ANCHOR_MATCH_TERMS[anchor];
}

function matchesAnchor(anchor: LegalAnchor, candidate: LegalSelectionCandidate) {
  const text = buildCandidateSearchText(candidate);

  return hasKeyword(text, buildAnchorTerms(anchor));
}

function isOffTopicCandidate(input: {
  candidate: LegalSelectionCandidate;
  lawFamily: LawFamily;
  plan: LegalQueryPlan;
}) {
  if (input.plan.question_scope !== "general_question") {
    return false;
  }

  if (
    ["immunity_law", "department_specific", "public_assembly_law"].includes(input.lawFamily) &&
    input.plan.legal_anchors.length > 0
  ) {
    const matchingAnchor = input.plan.legal_anchors.some((anchor) =>
      matchesAnchor(anchor, input.candidate),
    );

    return !matchingAnchor;
  }

  return false;
}

function hasExplicitScopeMarkerForLawFamily(input: {
  normalizedQuestion: string;
  lawFamily: LawFamily;
  candidate: LegalSelectionCandidate;
}) {
  const question = normalizeText(input.normalizedQuestion);
  const candidateTitle = buildCandidateTitleSearchText(input.candidate);

  switch (input.lawFamily) {
    case "department_specific":
      return (
        hasKeyword(
          question,
          LEGAL_SEMANTIC_ELIGIBILITY_KEYWORDS.explicit_scope_markers.department_specific_question,
        ) ||
        hasKeyword(
          candidateTitle,
          LEGAL_SEMANTIC_ELIGIBILITY_KEYWORDS.explicit_scope_markers.department_specific_candidate_title,
        ) && hasKeyword(question, ["этот", "данный"])
      );
    case "government_code":
      return hasKeyword(
        question,
        LEGAL_SEMANTIC_ELIGIBILITY_KEYWORDS.explicit_scope_markers.government_code_question,
      );
    case "public_assembly_law":
      return hasKeyword(
        question,
        LEGAL_SEMANTIC_ELIGIBILITY_KEYWORDS.explicit_scope_markers.public_assembly_question,
      );
    case "immunity_law":
      return hasKeyword(
        question,
        LEGAL_SEMANTIC_ELIGIBILITY_KEYWORDS.explicit_scope_markers.immunity_question,
      );
    default:
      return false;
  }
}

function hasAdministrativeMaterialTerms(text: string) {
  return hasKeyword(text, LEGAL_SEMANTIC_ELIGIBILITY_KEYWORDS.administrative_material_terms);
}

function hasMaskMaterialTerms(text: string) {
  return hasKeyword(text, LEGAL_SEMANTIC_ELIGIBILITY_KEYWORDS.mask_material_terms);
}

function hasVideoRecordingTerms(text: string) {
  return hasKeyword(text, LEGAL_SEMANTIC_ELIGIBILITY_KEYWORDS.video_recording_terms);
}

function hasAttorneyRightsTerms(text: string) {
  return hasKeyword(text, LEGAL_SEMANTIC_ELIGIBILITY_KEYWORDS.attorney_rights_terms);
}

function hasAttorneyRequestTerms(text: string) {
  return hasKeyword(text, LEGAL_SEMANTIC_ELIGIBILITY_KEYWORDS.attorney_request_terms);
}

function hasAttorneyRequestPrimarySubjectTerms(text: string) {
  return hasKeyword(
    text,
    LEGAL_SEMANTIC_ELIGIBILITY_KEYWORDS.attorney_request_primary_subject_terms,
  );
}

function hasAttorneyRequestPrimaryDutyTerms(text: string) {
  return hasKeyword(text, LEGAL_SEMANTIC_ELIGIBILITY_KEYWORDS.attorney_request_primary_duty_terms);
}

function hasAttorneyRequestPrimaryDeadlineTerms(text: string) {
  return hasKeyword(
    text,
    LEGAL_SEMANTIC_ELIGIBILITY_KEYWORDS.attorney_request_primary_deadline_terms,
  );
}

function hasAttorneyRequestPrimaryResponseTerms(text: string) {
  return hasKeyword(
    text,
    LEGAL_SEMANTIC_ELIGIBILITY_KEYWORDS.attorney_request_primary_response_terms,
  );
}

function isStrongAttorneyRequestPrimaryRuleCandidate(input: {
  candidate: LegalSelectionCandidate;
  plan: LegalQueryPlan;
  lawFamily: LawFamily;
}) {
  if (!input.plan.legal_anchors.includes("attorney_request")) {
    return false;
  }

  if (input.lawFamily !== "advocacy_law" || !isArticleLike(input.candidate)) {
    return false;
  }

  const text = buildCandidateSearchText(input.candidate);

  if (!hasAttorneyRequestPrimarySubjectTerms(text)) {
    return false;
  }

  return (
    hasAttorneyRequestPrimaryDutyTerms(text) ||
    hasAttorneyRequestPrimaryDeadlineTerms(text) ||
    hasAttorneyRequestPrimaryResponseTerms(text)
  );
}

function includesString(values: readonly string[], value: string) {
  return values.includes(value);
}

type SourceSpecificityProfileKey = keyof typeof LEGAL_SOURCE_SPECIFICITY_PROFILES;

function getActiveSpecificityProfiles(plan: LegalQueryPlan) {
  const profiles: SourceSpecificityProfileKey[] = [];
  const rightIssue = plan.primaryLegalIssueType === "right_question";

  if (plan.legal_anchors.includes("administrative_offense")) {
    profiles.push("administrative_offense");
  }

  if (plan.legal_anchors.includes("attorney_request")) {
    profiles.push("attorney_request");
  }

  if (plan.legal_anchors.includes("video_recording") || plan.legal_anchors.includes("evidence")) {
    profiles.push("video_recording");
  }

  if (plan.legal_anchors.includes("attorney_rights") && rightIssue) {
    profiles.push("attorney_rights");
  }

  if (plan.legal_anchors.includes("detention_procedure") && !rightIssue) {
    profiles.push("detention_procedure");
  }

  if (plan.explicitLegalCitations.length > 0) {
    profiles.push("explicit_citation");
  }

  return profiles;
}

function hasAdvocateStatusQuestionSignal(normalizedQuestion: string) {
  return hasKeyword(normalizedQuestion, [
    "статус адвоката",
    "участник процесса",
    "полномочия адвоката",
    "ордер адвоката",
    "удостоверение адвоката",
    "подтверждение статуса адвоката",
    "как участник процесса",
  ]);
}

function isCitationIssueType(plan: LegalQueryPlan) {
  return (
    plan.primaryLegalIssueType === "citation_explanation" ||
    plan.primaryLegalIssueType === "citation_application"
  );
}

function isResolvedCitationTargetCandidate(candidate: LegalSelectionCandidate) {
  return (
    candidate.sourceChannel === "citation_target" &&
    (candidate.citationResolutionStatus === "resolved" ||
      candidate.citationResolutionStatus === "partially_supported")
  );
}

function normalizeNormRoleForSelection(input: {
  candidate: LegalSelectionCandidate;
  plan: LegalQueryPlan;
  lawFamily: LawFamily;
  baseRole: NormRole;
}) {
  if (isStrongAttorneyRequestPrimaryRuleCandidate(input)) {
    return "primary_basis" as const;
  }

  return input.baseRole;
}

function isProcedurePrimaryIssueAligned(input: {
  plan: LegalQueryPlan;
  lawFamily: LawFamily;
  matchedAnchors: LegalAnchor[];
  candidateText: string;
}) {
  if (input.lawFamily !== "procedural_code") {
    return false;
  }

  const hasProcedureSubjectAlignment =
    input.matchedAnchors.some((anchor) =>
      ["detention_procedure", "video_recording", "evidence"].includes(anchor),
    ) || hasVideoRecordingTerms(input.candidateText);

  if (
    ["procedure_question", "evidence_question"].includes(input.plan.primaryLegalIssueType) &&
    hasProcedureSubjectAlignment
  ) {
    return true;
  }

  if (input.plan.primaryLegalIssueType === "duty_question" && hasProcedureSubjectAlignment) {
    return true;
  }

  if (hasVideoRecordingTerms(input.candidateText) && input.matchedAnchors.includes("video_recording")) {
    return true;
  }

  return false;
}

function getPrimarySelectionRoles(plan: LegalQueryPlan): NormRole[] {
  const roles = new Set<NormRole>(["primary_basis", "right_or_guarantee"]);

  if (
    ["procedure_question", "evidence_question", "duty_question"].includes(
      plan.primaryLegalIssueType,
    ) ||
    plan.legal_anchors.some((anchor) =>
      ["detention_procedure", "video_recording", "evidence"].includes(anchor),
    )
  ) {
    roles.add("procedure");
  }

  if (isCitationIssueType(plan) && plan.explicitLegalCitations.length > 0) {
    roles.add("procedure");
    roles.add("sanction");
    roles.add("exception");
    roles.add("remedy");
  }

  return Array.from(roles);
}

function scoreSourceSpecificity<TCandidate extends LegalSelectionCandidate>(input: {
  candidate: TCandidate;
  plan: LegalQueryPlan;
  lawFamily: LawFamily;
  normRole: NormRole;
  matchedAnchors: LegalAnchor[];
}) {
  const text = buildCandidateSearchText(input.candidate);
  const normalizedQuestion = normalizeText(input.plan.normalized_input);
  const reasons: string[] = [];
  const penalties: string[] = [];
  let rank = 0;
  const hasExplicitScope = hasExplicitScopeMarkerForLawFamily({
    normalizedQuestion,
    lawFamily: input.lawFamily,
    candidate: input.candidate,
  });
  const resolvedCitationTarget =
    input.candidate.sourceChannel === "citation_target" &&
    (input.candidate.citationResolutionStatus === "resolved" ||
      input.candidate.citationResolutionStatus === "partially_supported");
  const procedureIssueAligned = ["procedure_question", "evidence_question", "duty_question"].includes(
    input.plan.primaryLegalIssueType,
  );
  const sanctionIssueAligned = ["sanction_question", "citation_explanation", "citation_application"].includes(
    input.plan.primaryLegalIssueType,
  );

  if (resolvedCitationTarget) {
    rank += 6;
    reasons.push("explicit_citation_target_preserved");
    reasons.push("citation_target_preserved");
  } else if (input.candidate.sourceChannel === "citation_companion") {
    rank += 2;
    reasons.push("same_law_companion_context");
  } else if (
    input.candidate.sourceChannel === "semantic" &&
    input.plan.explicitLegalCitations.length > 0
  ) {
    penalties.push("semantic_candidate_behind_explicit_citation");
    rank -= 1;
  }

  switch (input.plan.primaryLegalIssueType) {
    case "right_question":
      if (input.normRole === "right_or_guarantee") {
        rank += 2;
        reasons.push("issue_type:right_question_role_match");
      }
      break;
    case "deadline_question":
    case "refusal_question":
    case "duty_question":
      if (input.normRole === "primary_basis") {
        rank += 2;
        reasons.push(`issue_type:${input.plan.primaryLegalIssueType}_role_match`);
      }
      break;
    case "procedure_question":
    case "evidence_question":
      if (input.normRole === "procedure") {
        rank += 2;
        reasons.push(`issue_type:${input.plan.primaryLegalIssueType}_role_match`);
      }
      break;
    case "sanction_question":
      if (input.normRole === "sanction") {
        rank += 1;
        reasons.push("issue_type:sanction_question_role_match");
      }
      break;
    default:
      break;
  }

  for (const profileKey of getActiveSpecificityProfiles(input.plan)) {
    if (profileKey === "explicit_citation") {
      if (
        LEGAL_SOURCE_SPECIFICITY_PROFILES.explicit_citation.preserveCitationTarget &&
        resolvedCitationTarget
      ) {
        reasons.push("explicit_citation:no_generic_family_penalty");
      }

      continue;
    }

    const profile = LEGAL_SOURCE_SPECIFICITY_PROFILES[profileKey];
    const familyIsPrimaryPreferred = includesString(profile.primaryPreferredFamilies, input.lawFamily);
    const familyIsSupporting = includesString(profile.supportingFamilies, input.lawFamily);
    const familyRequiresScope = includesString(profile.scopeRequiredFamilies, input.lawFamily);
    const roleIsPrimaryForbidden = includesString(profile.primaryForbiddenRoles, input.normRole);
    const familyIsSanctionOnly =
      includesString(profile.sanctionOnlyFamilies, input.lawFamily) && input.normRole !== "sanction";

    if (familyIsPrimaryPreferred) {
      rank += 4;
      reasons.push(`${profileKey}:primary_preferred_family`);
    } else if (familyIsSupporting) {
      rank += 1;
      reasons.push(`${profileKey}:supporting_family`);
    } else if (!resolvedCitationTarget && profile.primaryPreferredFamilies.length > 0) {
      penalties.push(`${profileKey}:family_not_preferred_for_active_profile`);
      penalties.push("selected_family_not_preferred");
      rank -= 1;
    }

    if (roleIsPrimaryForbidden && !resolvedCitationTarget) {
      penalties.push(`${profileKey}:role_not_primary_for_profile`);
      penalties.push("selected_role_not_primary_suitable");
      if (input.normRole === "sanction") {
        penalties.push("sanction_without_primary_rule");
      }
      if (input.normRole === "exception") {
        penalties.push("exception_without_primary_rule");
      }
      rank -= 3;
    }

    if (familyRequiresScope && !hasExplicitScope && !resolvedCitationTarget) {
      penalties.push(`${profileKey}:missing_explicit_scope_marker`);
      penalties.push("scoped_family_without_explicit_scope");
      rank -= 3;
    }

    if (familyIsSanctionOnly) {
      penalties.push(`${profileKey}:family_limited_to_sanction_or_consequence`);
      rank -= 2;
    }

    switch (profileKey) {
      case "attorney_request":
        if (input.lawFamily === "advocacy_law" && hasAttorneyRequestTerms(text)) {
          rank += 2;
          reasons.push("attorney_request:special_subject_match");
        }
        break;
      case "video_recording":
        if (input.lawFamily === "procedural_code" && hasVideoRecordingTerms(text)) {
          rank += 2;
          reasons.push("video_recording:direct_recording_rule");
        }
        break;
      case "attorney_rights":
        if (
          (input.lawFamily === "procedural_code" || input.lawFamily === "constitution") &&
          hasAttorneyRightsTerms(text)
        ) {
          rank += 2;
          reasons.push("attorney_rights:direct_right_or_guarantee_rule");
        }

        if (
          input.lawFamily === "advocacy_law" &&
          hasAttorneyRightsTerms(text) &&
          !hasAdvocateStatusQuestionSignal(normalizedQuestion)
        ) {
          penalties.push("attorney_rights:advocacy_supporting_for_detainee_right");
          rank -= 1;
        }
        break;
      case "detention_procedure":
        if (input.lawFamily === "procedural_code" && input.matchedAnchors.includes("detention_procedure")) {
          rank += 2;
          reasons.push("detention_procedure:direct_process_rule");
        }
        break;
    }
  }

  if (!resolvedCitationTarget && input.normRole === "procedure" && !procedureIssueAligned) {
    penalties.push("procedure_without_issue_alignment");
    penalties.push("selected_role_not_primary_suitable");
    rank -= 2;
  }

  if (!resolvedCitationTarget && input.normRole === "exception") {
    penalties.push("exception_without_primary_rule");
  }

  if (!resolvedCitationTarget && input.normRole === "sanction" && !sanctionIssueAligned) {
    penalties.push("sanction_without_primary_rule");
    penalties.push("selected_role_not_primary_suitable");
    rank -= 1;
  }

  return {
    specificity_rank: rank,
    specificity_reasons: Array.from(new Set(reasons)),
    specificity_penalties: Array.from(new Set(penalties)),
  };
}

function evaluatePrimaryBasisEligibility<TCandidate extends LegalSelectionCandidate>(input: {
  candidate: TCandidate;
  plan: LegalQueryPlan;
  lawFamily: LawFamily;
  normRole: NormRole;
  matchedAnchors: LegalAnchor[];
  matchedRequiredLawFamily: boolean;
}) {
  const text = buildCandidateSearchText(input.candidate);
  const normalizedQuestion = normalizeText(input.plan.normalized_input);
  const planAnchors = input.plan.legal_anchors;
  const activeProfiles = getActiveSpecificityProfiles(input.plan);
  const activeFamilyProfiles = activeProfiles.filter(
    (profileKey): profileKey is Exclude<SourceSpecificityProfileKey, "explicit_citation"> =>
      profileKey !== "explicit_citation",
  );
  const ineligibleReasons: string[] = [];
  const weakReasons: string[] = [];
  const eligibleReasons: string[] = [];
  const resolvedCitationTarget = isResolvedCitationTargetCandidate(input.candidate);
  const citationIssue = isCitationIssueType(input.plan);
  const hasExplicitScope = hasExplicitScopeMarkerForLawFamily({
    normalizedQuestion,
    lawFamily: input.lawFamily,
    candidate: input.candidate,
  });
  const procedureIssueAligned = isProcedurePrimaryIssueAligned({
    plan: input.plan,
    lawFamily: input.lawFamily,
    matchedAnchors: input.matchedAnchors,
    candidateText: text,
  });
  const familyPreferredByAnyProfile = activeFamilyProfiles.some((profileKey) =>
    includesString(LEGAL_SOURCE_SPECIFICITY_PROFILES[profileKey].primaryPreferredFamilies, input.lawFamily),
  );
  const familySupportingByAnyProfile = activeFamilyProfiles.some((profileKey) =>
    includesString(LEGAL_SOURCE_SPECIFICITY_PROFILES[profileKey].supportingFamilies, input.lawFamily),
  );
  const familyRequiresScopeByAnyProfile = activeFamilyProfiles.some((profileKey) =>
    includesString(LEGAL_SOURCE_SPECIFICITY_PROFILES[profileKey].scopeRequiredFamilies, input.lawFamily),
  );
  const attorneyRequestProfileActive = activeProfiles.includes("attorney_request");
  const isAdvocacyStatusQuestion =
    input.lawFamily === "advocacy_law" &&
    hasAdvocateStatusQuestionSignal(normalizedQuestion) &&
    hasAttorneyRightsTerms(text);
  const strongAttorneyRequestPrimaryRuleCandidate = isStrongAttorneyRequestPrimaryRuleCandidate({
    candidate: input.candidate,
    plan: input.plan,
    lawFamily: input.lawFamily,
  });
  const missingAttorneyRequestSubjectMatch =
    attorneyRequestProfileActive &&
    input.lawFamily === "advocacy_law" &&
    !hasAttorneyRequestTerms(text);

  if (resolvedCitationTarget && citationIssue) {
    if (!isArticleLike(input.candidate)) {
      ineligibleReasons.push("background_only_block");
    }

    if (ineligibleReasons.length > 0) {
      return {
        primary_basis_eligibility: "ineligible" as const,
        primary_basis_eligibility_reason: ineligibleReasons[0] ?? null,
        ineligible_primary_basis_reasons: Array.from(new Set(ineligibleReasons)),
        weak_primary_basis_reasons: [],
      };
    }

    return {
      primary_basis_eligibility: "eligible" as const,
      primary_basis_eligibility_reason: "eligible_due_to_resolved_citation_target",
      ineligible_primary_basis_reasons: [],
      weak_primary_basis_reasons: [],
    };
  }

  if (citationIssue && input.plan.explicitLegalCitations.length > 0 && input.candidate.sourceChannel !== "citation_target") {
    ineligibleReasons.push("ineligible_due_to_wrong_source_family");
  }

  if (!isArticleLike(input.candidate)) {
    ineligibleReasons.push("background_only_block");
  }

  if (input.normRole === "background_only") {
    ineligibleReasons.push("background_only");
  }

  if (input.normRole === "right_or_guarantee") {
    if (
      input.matchedAnchors.some((anchor) => anchor === "attorney_rights" || anchor === "remedy") ||
      familyPreferredByAnyProfile
    ) {
      eligibleReasons.push("eligible_due_to_specific_primary_family");
    } else {
      weakReasons.push("right_or_guarantee_outside_anchor_scope");
    }
  }

  if (
    !input.matchedRequiredLawFamily &&
    input.plan.required_law_families.length > 0 &&
    !familyPreferredByAnyProfile &&
    !resolvedCitationTarget
  ) {
    weakReasons.push("law_family_not_direct");
  }

  if (input.plan.question_scope === "general_question") {
    if (
      (input.lawFamily === "department_specific" ||
        input.lawFamily === "public_assembly_law" ||
        input.lawFamily === "immunity_law") &&
      !hasExplicitScope
    ) {
      ineligibleReasons.push("ineligible_due_to_scoped_family_without_scope");
    }

    if ((input.lawFamily === "government_code" || familyRequiresScopeByAnyProfile) && !hasExplicitScope) {
      ineligibleReasons.push("ineligible_due_to_scoped_family_without_scope");
    }
  }

  if (input.normRole === "sanction") {
    ineligibleReasons.push("ineligible_due_to_sanction_only");
  }

  if (input.normRole === "exception") {
    ineligibleReasons.push("ineligible_due_to_exception_without_base");
  }

  if (input.normRole === "procedure" && !procedureIssueAligned) {
    ineligibleReasons.push("ineligible_due_to_procedure_without_issue_alignment");
  }

  if (planAnchors.includes("administrative_offense")) {
    if (!hasAdministrativeMaterialTerms(text)) {
      ineligibleReasons.push("missing_anchor_subject_match");
    }

    if (hasKeyword(normalizedQuestion, ["маск"]) && !hasMaskMaterialTerms(text)) {
      ineligibleReasons.push("missing_anchor_subject_match");
    }

    if (input.lawFamily !== "administrative_code") {
      weakReasons.push("law_family_not_direct");
    }
  }

  if (input.matchedAnchors.includes("video_recording")) {
    if (!hasVideoRecordingTerms(text)) {
      ineligibleReasons.push("video_recording_direct_rule_missing");
    }
  }

  if (input.matchedAnchors.includes("attorney_rights") && !attorneyRequestProfileActive) {
    if (!hasAttorneyRightsTerms(text)) {
      ineligibleReasons.push("missing_anchor_subject_match");
    }

    if (!["advocacy_law", "procedural_code", "constitution"].includes(input.lawFamily)) {
      ineligibleReasons.push("ineligible_due_to_wrong_source_family");
    }

    if (["procedural_code", "constitution"].includes(input.lawFamily)) {
      eligibleReasons.push("eligible_due_to_specific_primary_family");
    }

    if (input.lawFamily === "advocacy_law" && !isAdvocacyStatusQuestion) {
      weakReasons.push("weak_due_to_missing_preferred_family");
    }
  }

  if (input.matchedAnchors.includes("attorney_request")) {
    if (!hasAttorneyRequestTerms(text)) {
      ineligibleReasons.push("missing_anchor_subject_match");
    }

    if (input.lawFamily === "advocacy_law") {
      if (strongAttorneyRequestPrimaryRuleCandidate) {
        eligibleReasons.push("eligible_due_to_attorney_request_primary_rule");
      }

      eligibleReasons.push("eligible_due_to_specific_primary_family");
    } else if (["government_code", "ethics_code", "administrative_code"].includes(input.lawFamily)) {
      weakReasons.push("weak_due_to_missing_preferred_family");
    } else {
      ineligibleReasons.push("ineligible_due_to_wrong_source_family");
    }
  }

  if (missingAttorneyRequestSubjectMatch) {
    ineligibleReasons.push("missing_anchor_subject_match");
  }

  if (
    input.matchedAnchors.includes("detention_procedure") &&
    input.plan.primaryLegalIssueType !== "right_question"
  ) {
    if (input.lawFamily === "procedural_code") {
      if (input.normRole === "procedure" || input.normRole === "primary_basis") {
        eligibleReasons.push("eligible_due_to_specific_primary_family");
      }
    } else if (["administrative_code", "criminal_code"].includes(input.lawFamily)) {
      weakReasons.push("weak_due_to_missing_preferred_family");
    } else if (input.lawFamily === "government_code") {
      ineligibleReasons.push("ineligible_due_to_scoped_family_without_scope");
    } else if (!familyPreferredByAnyProfile) {
      ineligibleReasons.push("ineligible_due_to_wrong_source_family");
    }
  }

  if (input.matchedAnchors.includes("video_recording") || input.matchedAnchors.includes("evidence")) {
    if (input.lawFamily === "procedural_code") {
      if (hasVideoRecordingTerms(text)) {
        if (input.normRole === "procedure" || input.normRole === "primary_basis") {
          eligibleReasons.push("eligible_due_to_specific_primary_family");
        }
      } else {
        weakReasons.push("weak_due_to_missing_preferred_family");
      }
    } else if (["government_code", "department_specific"].includes(input.lawFamily)) {
      if (!hasExplicitScope) {
        ineligibleReasons.push("ineligible_due_to_scoped_family_without_scope");
      } else {
        weakReasons.push("weak_due_to_missing_preferred_family");
      }
    }
  }

  if (activeFamilyProfiles.length > 0 && !familyPreferredByAnyProfile) {
    if (familySupportingByAnyProfile) {
      weakReasons.push("weak_due_to_missing_preferred_family");
    } else if (!resolvedCitationTarget && !hasExplicitScope && familyRequiresScopeByAnyProfile) {
      ineligibleReasons.push("ineligible_due_to_scoped_family_without_scope");
    } else if (
      !resolvedCitationTarget &&
      ![
        "administrative_code",
        "procedural_code",
        "criminal_code",
        "advocacy_law",
        "ethics_code",
        "constitution",
        "government_code",
        "department_specific",
      ].includes(input.lawFamily)
    ) {
      ineligibleReasons.push("ineligible_due_to_wrong_source_family");
    }
  }

  if (familyPreferredByAnyProfile && !missingAttorneyRequestSubjectMatch) {
    eligibleReasons.push("eligible_due_to_specific_primary_family");
  }

  if (ineligibleReasons.length > 0) {
    return {
      primary_basis_eligibility: "ineligible" as const,
      primary_basis_eligibility_reason: ineligibleReasons[0] ?? null,
      ineligible_primary_basis_reasons: Array.from(new Set(ineligibleReasons)),
      weak_primary_basis_reasons: Array.from(new Set(weakReasons)),
    };
  }

  if (weakReasons.length > 0) {
    return {
      primary_basis_eligibility: "weak" as const,
      primary_basis_eligibility_reason: weakReasons[0] ?? null,
      ineligible_primary_basis_reasons: [],
      weak_primary_basis_reasons: Array.from(new Set(weakReasons)),
    };
  }

  return {
    primary_basis_eligibility: "eligible" as const,
    primary_basis_eligibility_reason: eligibleReasons[0] ?? null,
    ineligible_primary_basis_reasons: [],
    weak_primary_basis_reasons: [],
  };
}

export function scoreLegalCandidate<TCandidate extends LegalSelectionCandidate>(input: {
  candidate: TCandidate;
  plan: LegalQueryPlan;
}) {
  const lawFamily = classifyLawFamily(input.candidate);
  const baseNormRole = classifyNormRole(input.candidate);
  const normRole = normalizeNormRoleForSelection({
    candidate: input.candidate,
    plan: input.plan,
    lawFamily,
    baseRole: baseNormRole,
  });
  const matchedAnchors = input.plan.legal_anchors.filter((anchor) =>
    matchesAnchor(anchor, input.candidate),
  );
  const penalties: string[] = [];
  let score = calculateTokenOverlap(input.plan.normalized_input, buildCandidateSearchText(input.candidate));

  const matchedRequiredLawFamily =
    input.plan.required_law_families.length === 0 ||
    input.plan.required_law_families.includes(lawFamily);
  const matchedPreferredNormRole = input.plan.preferred_norm_roles.includes(normRole);

  if (matchedRequiredLawFamily) {
    score += input.plan.required_law_families.length > 0 ? 3 : 1;
  } else if (input.plan.required_law_families.length > 0) {
    score -= 2;
    penalties.push("law_family_mismatch");
  }

  if (matchedPreferredNormRole) {
    score += 2;
  }

  score += matchedAnchors.length * 2;

  if (isArticleLike(input.candidate)) {
    score += 1;
  } else {
    penalties.push("background_only_block");
  }

  if (normRole === "exception" && !input.plan.preferred_norm_roles.includes("exception")) {
    score -= 2;
    penalties.push("exception_without_primary_basis");
  }

  const offTopic = isOffTopicCandidate({
    candidate: input.candidate,
    lawFamily,
    plan: input.plan,
  });

  if (offTopic) {
    score -= 5;
    penalties.push("off_topic_scope");
  }

  if (
    input.plan.question_scope === "general_question" &&
    lawFamily === "department_specific" &&
    !matchedAnchors.some((anchor) => anchor === "video_recording" || anchor === "official_duty")
  ) {
    score -= 3;
    penalties.push("department_specific_for_general_question");
  }

  const primaryBasisEligibility = evaluatePrimaryBasisEligibility({
    candidate: input.candidate,
    plan: input.plan,
    lawFamily,
    normRole,
    matchedAnchors,
    matchedRequiredLawFamily,
  });
  const sourceSpecificity = scoreSourceSpecificity({
    candidate: input.candidate,
    plan: input.plan,
    lawFamily,
    normRole,
    matchedAnchors,
  });

  return {
    candidate: input.candidate,
    law_family: lawFamily,
    norm_role: normRole,
    applicability_score: score,
    primary_basis_eligibility: primaryBasisEligibility.primary_basis_eligibility,
    primary_basis_eligibility_reason: primaryBasisEligibility.primary_basis_eligibility_reason,
    ineligible_primary_basis_reasons:
      primaryBasisEligibility.ineligible_primary_basis_reasons,
    weak_primary_basis_reasons: primaryBasisEligibility.weak_primary_basis_reasons,
    matched_anchors: matchedAnchors,
    matched_required_law_family: matchedRequiredLawFamily,
    matched_preferred_norm_role: matchedPreferredNormRole,
    off_topic: offTopic,
    penalties,
    specificity_rank: sourceSpecificity.specificity_rank,
    specificity_reasons: sourceSpecificity.specificity_reasons,
    specificity_penalties: sourceSpecificity.specificity_penalties,
    source_channel: input.candidate.sourceChannel ?? null,
    citation_resolution_status: input.candidate.citationResolutionStatus ?? null,
  } satisfies ScoredLegalCandidate<TCandidate>;
}

function takeCandidatesByRole<TCandidate extends LegalSelectionCandidate>(
  scoredCandidates: Array<ScoredLegalCandidate<TCandidate>>,
  roles: NormRole[],
  limit: number,
  selectedIds: Set<string>,
  options?: {
    allowedEligibilities?: PrimaryBasisEligibility[];
  },
) {
  const selected: TCandidate[] = [];

  for (const scored of scoredCandidates) {
    if (
      selected.length >= limit ||
      !roles.includes(scored.norm_role) ||
      scored.applicability_score <= 0 ||
      scored.off_topic ||
      (options?.allowedEligibilities &&
        !options.allowedEligibilities.includes(scored.primary_basis_eligibility))
    ) {
      continue;
    }

    const candidateKey = scored.candidate.lawBlockId;

    if (selectedIds.has(candidateKey)) {
      continue;
    }

    selectedIds.add(candidateKey);
    selected.push(scored.candidate);
  }

  return selected;
}

function takeResolvedCitationPrimaryCandidates<TCandidate extends LegalSelectionCandidate>(
  scoredCandidates: Array<ScoredLegalCandidate<TCandidate>>,
  limit: number,
  selectedIds: Set<string>,
) {
  const selected: TCandidate[] = [];

  for (const scored of scoredCandidates) {
    if (selected.length >= limit) {
      break;
    }

    if (
      scored.primary_basis_eligibility !== "eligible" ||
      scored.source_channel !== "citation_target" ||
      (scored.citation_resolution_status !== "resolved" &&
        scored.citation_resolution_status !== "partially_supported")
    ) {
      continue;
    }

    const candidateKey = scored.candidate.lawBlockId;

    if (selectedIds.has(candidateKey)) {
      continue;
    }

    selectedIds.add(candidateKey);
    selected.push(scored.candidate);
  }

  return selected;
}

export function selectStructuredLegalContext<TCandidate extends LegalSelectionCandidate>(input: {
  candidates: TCandidate[];
  plan: LegalQueryPlan;
}) {
  const scoredCandidates = input.candidates
    .map((candidate) =>
      scoreLegalCandidate({
        candidate,
        plan: input.plan,
      }),
      )
      .sort((left, right) => {
        if (left.applicability_score !== right.applicability_score) {
          return right.applicability_score - left.applicability_score;
        }

        return right.specificity_rank - left.specificity_rank;
      });
  const selectedIds = new Set<string>();
  const primarySelectionRoles = getPrimarySelectionRoles(input.plan);
  const citationPrimaryNorms = isCitationIssueType(input.plan)
    ? takeResolvedCitationPrimaryCandidates(scoredCandidates, 2, selectedIds)
    : [];
  const primaryBasisNorms = [
    ...citationPrimaryNorms,
    ...takeCandidatesByRole(
    scoredCandidates,
    primarySelectionRoles,
    Math.max(0, 2 - citationPrimaryNorms.length),
    selectedIds,
    {
      allowedEligibilities: ["eligible"],
    },
    ),
  ];
  const procedureNorms = takeCandidatesByRole(
    scoredCandidates,
    ["procedure", "right_or_guarantee"],
    2,
    selectedIds,
  );
  const weakPrimaryBasisNorms = takeCandidatesByRole(
    scoredCandidates,
    ["primary_basis", "right_or_guarantee"],
    2,
    selectedIds,
    {
      allowedEligibilities: ["weak"],
    },
  );
  const exceptionNorms = takeCandidatesByRole(scoredCandidates, ["exception"], 1, selectedIds);
  const supportingNorms = takeCandidatesByRole(
    scoredCandidates,
    ["sanction", "remedy", "background_only"],
    2,
    selectedIds,
  );
  const selectedNorms = [
    ...primaryBasisNorms,
    ...procedureNorms,
    ...exceptionNorms,
    ...weakPrimaryBasisNorms,
    ...supportingNorms,
  ];
  const directBasisStatus: DirectBasisStatus =
    primaryBasisNorms.length > 0
      ? "direct_basis_present"
      : weakPrimaryBasisNorms.length > 0 || selectedNorms.length > 0
        ? "partial_basis_only"
        : "no_direct_basis";

  return {
    scored_candidates: scoredCandidates,
    primary_basis_norms: primaryBasisNorms,
    procedure_norms: procedureNorms,
    exception_norms: exceptionNorms,
    supporting_norms: supportingNorms,
    selected_norms: selectedNorms,
    selected_norm_roles: selectedNorms
      .map((candidate) => {
        const scoredCandidate = scoredCandidates.find(
          (entry) => entry.candidate.lawBlockId === candidate.lawBlockId,
        );

        if (!scoredCandidate) {
          return null;
        }

        return {
          server_id: candidate.serverId,
          law_id: candidate.lawId,
          law_version: candidate.lawVersionId,
          law_block_id: candidate.lawBlockId,
          law_family: scoredCandidate.law_family,
          norm_role: scoredCandidate.norm_role,
          applicability_score: scoredCandidate.applicability_score,
        } satisfies SelectedNormRole;
      })
      .filter((entry): entry is SelectedNormRole => Boolean(entry)),
    direct_basis_status: directBasisStatus,
  } satisfies StructuredSelectionResult<TCandidate>;
}
