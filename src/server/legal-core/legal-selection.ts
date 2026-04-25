import type { LegalAnchor, LegalQueryPlan } from "@/server/legal-core/legal-query-plan";
import {
  LEGAL_SEMANTIC_ANCHOR_MATCH_TERMS,
  LEGAL_SEMANTIC_ELIGIBILITY_KEYWORDS,
  LEGAL_SEMANTIC_FAMILY_HINTS,
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
  const ineligibleReasons: string[] = [];
  const weakReasons: string[] = [];

  if (!isArticleLike(input.candidate)) {
    ineligibleReasons.push("background_only_block");
  }

  if (input.normRole === "procedure") {
    ineligibleReasons.push("procedure_without_material_basis");
  }

  if (input.normRole === "sanction") {
    ineligibleReasons.push("sanction_without_material_basis");
  }

  if (input.normRole === "exception") {
    ineligibleReasons.push("exception_without_material_basis");
  }

  if (input.normRole === "background_only") {
    ineligibleReasons.push("background_only");
  }

  if (
    input.normRole === "right_or_guarantee" &&
    !planAnchors.some((anchor) => anchor === "attorney_rights" || anchor === "remedy")
  ) {
    weakReasons.push("right_or_guarantee_outside_anchor_scope");
  }

  if (!input.matchedRequiredLawFamily && input.plan.required_law_families.length > 0) {
    weakReasons.push("law_family_not_direct");
  }

  if (input.plan.question_scope === "general_question") {
    const hasExplicitScope = hasExplicitScopeMarkerForLawFamily({
      normalizedQuestion,
      lawFamily: input.lawFamily,
      candidate: input.candidate,
    });

    if (
      (input.lawFamily === "department_specific" ||
        input.lawFamily === "public_assembly_law" ||
        input.lawFamily === "immunity_law") &&
      !hasExplicitScope
    ) {
      ineligibleReasons.push("special_scope_without_marker");
    }

    if (input.lawFamily === "government_code" && !hasExplicitScope) {
      weakReasons.push("government_code_general_scope");
    }
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

  if (planAnchors.includes("video_recording")) {
    if (!hasVideoRecordingTerms(text)) {
      ineligibleReasons.push("video_recording_direct_rule_missing");
    }
  }

  if (planAnchors.includes("attorney_rights")) {
    if (!hasAttorneyRightsTerms(text)) {
      ineligibleReasons.push("missing_anchor_subject_match");
    }

    if (!["advocacy_law", "procedural_code"].includes(input.lawFamily)) {
      weakReasons.push("advocacy_scope_mismatch");
    }
  }

  if (planAnchors.includes("attorney_request")) {
    if (!hasAttorneyRequestTerms(text)) {
      ineligibleReasons.push("missing_anchor_subject_match");
    }

    if (input.lawFamily !== "advocacy_law") {
      weakReasons.push("advocacy_scope_mismatch");
    }
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
    primary_basis_eligibility_reason: null,
    ineligible_primary_basis_reasons: [],
    weak_primary_basis_reasons: [],
  };
}

export function scoreLegalCandidate<TCandidate extends LegalSelectionCandidate>(input: {
  candidate: TCandidate;
  plan: LegalQueryPlan;
}) {
  const lawFamily = classifyLawFamily(input.candidate);
  const normRole = classifyNormRole(input.candidate);
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
    .sort((left, right) => right.applicability_score - left.applicability_score);
  const selectedIds = new Set<string>();
  const primaryBasisNorms = takeCandidatesByRole(
    scoredCandidates,
    ["primary_basis", "right_or_guarantee"],
    2,
    selectedIds,
    {
      allowedEligibilities: ["eligible"],
    },
  );
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
