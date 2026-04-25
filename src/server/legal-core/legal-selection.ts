import type { LegalAnchor, LegalQueryPlan } from "@/server/legal-core/legal-query-plan";

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

export type LawFamily = (typeof lawFamilies)[number];
export type NormRole = (typeof normRoles)[number];
export type DirectBasisStatus = (typeof directBasisStatuses)[number];

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

function hasKeyword(source: string, keywords: string[]) {
  return keywords.some((keyword) => source.includes(keyword));
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
  const text = buildCandidateSearchText(candidate);

  if (hasKeyword(text, ["административ", "адм код", " ак ", "(ак)", "административный кодекс"])) {
    return "administrative_code";
  }

  if (hasKeyword(text, ["процессуал", "процессуальный кодекс", " пк ", "(пк)"])) {
    return "procedural_code";
  }

  if (hasKeyword(text, ["уголов", "уголовный кодекс", " ук ", "(ук)"])) {
    return "criminal_code";
  }

  if (hasKeyword(text, ["адвокат", "адвокатур"])) {
    return "advocacy_law";
  }

  if (hasKeyword(text, ["этик"])) {
    return "ethics_code";
  }

  if (hasKeyword(text, ["конституц"])) {
    return "constitution";
  }

  if (hasKeyword(text, ["митинг", "публичн мероприят", "собрани", "демонстрац"])) {
    return "public_assembly_law";
  }

  if (hasKeyword(text, ["неприкоснов", "иммунитет"])) {
    return "immunity_law";
  }

  if (hasKeyword(text, ["правительств", "госслуж", "служебн обязан", "руководств"])) {
    return "government_code";
  }

  if (hasKeyword(text, ["департамент", "ведомств", "национальн гвард", "body-cam", "bodycam"])) {
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
  switch (anchor) {
    case "administrative_offense":
      return ["административ", "правонаруш", "маск", "штраф"];
    case "detention_procedure":
      return ["задерж", "арест", "основания задержания", "процессуал"];
    case "attorney_rights":
      return ["адвокат", "защитник", "право на защиту"];
    case "attorney_request":
      return ["адвокатский запрос", "адвокат", "запрос"];
    case "video_recording":
      return ["видеозапис", "видеофиксац", "bodycam", "body-cam", "бодикам"];
    case "official_duty":
      return ["обязан", "служебн", "руководств"];
    case "sanction":
      return ["штраф", "наказывается", "ответственност"];
    case "exception":
      return ["за исключением", "кроме случаев", "исключен"];
    case "remedy":
      return ["жалоб", "обжал", "обратиться"];
    case "evidence":
      return ["доказ", "видеозапис", "запись"];
  }
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

  return {
    candidate: input.candidate,
    law_family: lawFamily,
    norm_role: normRole,
    applicability_score: score,
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
) {
  const selected: TCandidate[] = [];

  for (const scored of scoredCandidates) {
    if (
      selected.length >= limit ||
      !roles.includes(scored.norm_role) ||
      scored.applicability_score <= 0 ||
      scored.off_topic
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
    ["primary_basis"],
    2,
    selectedIds,
  );
  const procedureNorms = takeCandidatesByRole(
    scoredCandidates,
    ["procedure", "right_or_guarantee"],
    2,
    selectedIds,
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
    ...supportingNorms,
  ];
  const directBasisStatus: DirectBasisStatus =
    primaryBasisNorms.length > 0
      ? "direct_basis_present"
      : selectedNorms.length > 0
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
