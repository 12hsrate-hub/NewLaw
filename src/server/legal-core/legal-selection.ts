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

function hasKeyword(source: string, keywords: string[]) {
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
    hasKeyword(titleText, [
      "адвокатур",
      "адвокатск запрос",
      "адвокатская деятельность",
    ]) ||
    hasKeyword(keyText, ["advocacy", "attorney_request"])
  ) {
    return "advocacy_law";
  }

  if (
    hasKeyword(titleText, ["административ", "адм код", " ак ", "(ак)", "административный кодекс"]) ||
    hasKeyword(keyText, ["administrative", "admin_code", "ak"])
  ) {
    return "administrative_code";
  }

  if (
    hasKeyword(titleText, ["процессуал", "процессуальный кодекс", " пк ", "(пк)"]) ||
    hasKeyword(keyText, ["procedural", "procedure", "pk"])
  ) {
    return "procedural_code";
  }

  if (
    hasKeyword(titleText, ["уголов", "уголовный кодекс", " ук ", "(ук)"]) ||
    hasKeyword(keyText, ["criminal", "uk"])
  ) {
    return "criminal_code";
  }

  if (hasKeyword(titleText, ["этик"]) || hasKeyword(keyText, ["ethic"])) {
    return "ethics_code";
  }

  if (hasKeyword(titleText, ["конституц"]) || hasKeyword(keyText, ["constitution"])) {
    return "constitution";
  }

  if (
    hasKeyword(titleText, ["митинг", "публичн мероприяти", "собрани", "демонстрац"]) ||
    hasKeyword(keyText, ["assembly", "public_event", "meeting", "demonstration"])
  ) {
    return "public_assembly_law";
  }

  if (hasKeyword(titleText, ["неприкоснов", "иммунитет"]) || hasKeyword(keyText, ["immunity"])) {
    return "immunity_law";
  }

  if (
    hasKeyword(titleText, ["fbi", "fib", "lspd", "lssd", "департамент", "ведомствен", "регламент"]) ||
    (hasKeyword(titleText, ["национальн"]) && hasKeyword(titleText, ["гвард"])) ||
    (hasKeyword(titleText, ["управлен"]) && hasKeyword(titleText, ["тюрем"])) ||
    hasKeyword(keyText, ["national_guard", "prison", "lspd", "lssd", "fib", "department"])
  ) {
    return "department_specific";
  }

  if (
    hasKeyword(titleText, [
      "огп",
      "офис генерального прокурора",
      "офиса генерального прокурора",
      "деятельности офиса генерального прокурора",
      "генерального прокурора",
      "правительств",
      "государственн служб",
    ]) ||
    hasKeyword(keyText, ["ogp", "prosecutor", "government"])
  ) {
    return "government_code";
  }

  if (hasKeyword(text, ["административ", "адм код", " ак ", "(ак)", "административный кодекс"])) {
    return "administrative_code";
  }

  if (hasKeyword(text, ["процессуал", "процессуальный кодекс", " пк ", "(пк)"])) {
    return "procedural_code";
  }

  if (hasKeyword(text, ["уголов", "уголовный кодекс", " ук ", "(ук)"])) {
    return "criminal_code";
  }

  if (
    hasKeyword(text, [
      "адвокатур",
      "адвокатская деятельность",
      "адвокатский запрос",
      "официальный адвокатский запрос",
    ]) &&
    !hasKeyword(titleText, ["генеральн прокурор", "офис генерального прокурора", "огп", "прокуратур"])
  ) {
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

  if (
    hasKeyword(text, [
      "генеральн прокурор",
      "офис генерального прокурора",
      "огп",
      "прокуратур",
      "правительств",
      "госслуж",
      "служебн обязан",
      "руководств",
    ])
  ) {
    return "government_code";
  }

  if (
    hasKeyword(text, [
      "департамент",
      "ведомств",
      "национальн гвард",
      "управлени тюрем",
      "fbi",
      "fib",
      "lspd",
      "lssd",
      "body-cam",
      "bodycam",
      "регламент",
    ])
  ) {
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
      return [
        "административ",
        "правонаруш",
        "маск",
        "маскиров",
        "неприемлем",
        "идентификац",
        "личност",
        "штраф",
      ];
    case "detention_procedure":
      return ["задерж", "арест", "основания задержания", "процессуал"];
    case "attorney_rights":
      return [
        "адвокат",
        "защитник",
        "право на защиту",
        "допуск адвоката",
        "право задержанного",
        "реализация прав задержанного",
        "звонок",
      ];
    case "attorney_request":
      return [
        "адвокатский запрос",
        "официальный адвокатский запрос",
        "срок ответа",
        "обязанность ответить",
        "получение запроса",
        "неисполнение адвокатского запроса",
      ];
    case "video_recording":
      return [
        "видеозапис",
        "видеофиксац",
        "bodycam",
        "body-cam",
        "бодикам",
        "запись задержания",
        "предоставить запись",
        "обязанность вести запись",
        "аудиодорожк",
        "видеоряд",
      ];
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
        hasKeyword(question, [
          "нацгвард",
          "национальн гвард",
          "управлен",
          "тюрьм",
          "fib",
          "fbi",
          "lspd",
          "lssd",
          "огп",
          "офис генерального прокурора",
          "генеральн прокурор",
          "департамент",
          "ведомств",
        ]) ||
        hasKeyword(candidateTitle, [
          "национальн гвард",
          "управлени тюрем",
          "fib",
          "fbi",
          "lspd",
          "lssd",
          "департамент",
          "ведомств",
        ]) && hasKeyword(question, ["этот", "данный"])
      );
    case "government_code":
      return hasKeyword(question, [
        "огп",
        "офис генерального прокурора",
        "генеральн прокурор",
        "правительств",
        "госслужащ",
      ]);
    case "public_assembly_law":
      return hasKeyword(question, ["митинг", "акци", "публичн меропр", "собрани", "демонстрац"]);
    case "immunity_law":
      return hasKeyword(question, ["иммунитет", "неприкоснов", "госслужащ"]);
    default:
      return false;
  }
}

function hasAdministrativeMaterialTerms(text: string) {
  return hasKeyword(text, [
    "состав",
    "запрещ",
    "ответственност",
    "санкц",
    "штраф",
    "ограничени свободы",
    "ограничение свободы",
    "административн правонаруш",
  ]);
}

function hasMaskMaterialTerms(text: string) {
  return hasKeyword(text, [
    "маск",
    "маскиров",
    "неприемлем",
    "затрудн",
    "установлени личности",
    "идентификац личности",
    "лицо",
  ]);
}

function hasVideoRecordingTerms(text: string) {
  return hasKeyword(text, [
    "bodycam",
    "body-cam",
    "бодикам",
    "видеофиксац",
    "видеозапис",
    "запись задержания",
    "процессуальн запись",
    "аудиодорожк",
    "видеоряд",
    "предоставить запись",
    "обязанность вести запись",
    "обязан вести запись",
  ]);
}

function hasAttorneyRightsTerms(text: string) {
  return hasKeyword(text, [
    "адвокат",
    "защитник",
    "право на защит",
    "реализац прав задержан",
    "звонок",
    "допуск адвокат",
    "право задержан",
    "права задержан",
  ]);
}

function hasAttorneyRequestTerms(text: string) {
  return hasKeyword(text, [
    "адвокатский запрос",
    "официальный адвокатский запрос",
    "обязанность ответить",
    "обязан ответить",
    "срок ответа",
    "получени запроса",
    "неисполнение адвокатского запроса",
  ]);
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
