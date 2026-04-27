import type { LegalQueryPlan } from "@/server/legal-core/legal-query-plan";
import {
  parseArticleSegments,
  type ArticleSegment,
  type ArticleSegmentRelationHint,
} from "@/server/legal-assistant/article-segments";
import type {
  LawFamily,
  LegalSelectionCandidate,
  NormRole,
  ScoredLegalCandidate,
  StructuredSelectionResult,
} from "@/server/legal-core/legal-selection";

export const normBundleRelationTypes = [
  "primary",
  "same_article_part",
  "article_note",
  "article_comment",
  "exception",
  "definition",
  "procedure_companion",
  "sanction_companion",
  "evidence_companion",
  "remedy_companion",
  "citation_companion",
  "nearby_context",
  "unresolved_reference",
] as const;

export type NormBundleRelationType = (typeof normBundleRelationTypes)[number];

export type NormBundleItem = {
  source_kind: "law" | "precedent";
  law_id: string | null;
  law_version: string | null;
  law_block_id: string | null;
  law_family: LawFamily | null;
  article_number: string | null;
  marker?: string | null;
  part_number?: string | null;
  relation_type: NormBundleRelationType;
  relation_reason: string;
  compact_excerpt: string | null;
  priority: number;
  should_include_in_generation_context: boolean;
};

export type NormBundleWarning = {
  warning_code: string;
  relation_type: Extract<NormBundleRelationType, "unresolved_reference"> | null;
  message: string;
  citation_raw: string | null;
  law_block_id: string | null;
};

export type NormBundleCompanionDecision = {
  law_id: string | null;
  law_version: string | null;
  law_block_id: string | null;
  marker?: string | null;
  part_number?: string | null;
  relation_type: Exclude<NormBundleRelationType, "primary" | "unresolved_reference">;
  reason_code: string;
  should_include_in_generation_context: boolean;
};

export type NormBundleArticleSegmentDecision = {
  law_id: string | null;
  law_version: string | null;
  law_block_id: string | null;
  marker: string | null;
  part_number: string | null;
  relation_type: Exclude<NormBundleRelationType, "primary" | "unresolved_reference">;
  reason_code: string;
};

export type NormBundleDiagnostics = {
  norm_bundle_present: boolean;
  bundle_primary_count: number;
  bundle_companion_count: number;
  missing_expected_companion: string[];
  companion_relation_types: Array<
    Exclude<NormBundleRelationType, "primary" | "unresolved_reference">
  >;
  included_companions: NormBundleCompanionDecision[];
  excluded_companions: NormBundleCompanionDecision[];
  bundle_budget_trimmed: boolean;
  bundle_generation_context_items: number;
  same_article_part_count: number;
  article_note_count: number;
  exception_count: number;
  sanction_companion_count: number;
  evidence_companion_count: number;
  segment_relation_types: Array<
    Exclude<NormBundleRelationType, "primary" | "unresolved_reference">
  >;
  included_article_segments: NormBundleArticleSegmentDecision[];
  excluded_article_segments: NormBundleArticleSegmentDecision[];
};

export type NormBundle = {
  primary_basis_norms: NormBundleItem[];
  same_article_parts: NormBundleItem[];
  article_notes: NormBundleItem[];
  article_comments: NormBundleItem[];
  exceptions: NormBundleItem[];
  definitions: NormBundleItem[];
  procedure_companions: NormBundleItem[];
  sanction_companions: NormBundleItem[];
  evidence_companions: NormBundleItem[];
  remedy_companions: NormBundleItem[];
  citation_companions: NormBundleItem[];
  unresolved_companion_warnings: NormBundleWarning[];
  bundle_diagnostics: NormBundleDiagnostics;
};

type CitationResolutionDebugEntry = {
  raw_citation?: string | null;
  resolution_status?: string | null;
  resolution_reason?: string | null;
  resolved_block_id?: string | null;
  matched_law_title?: string | null;
};

type CompanionLikeCandidate = LegalSelectionCandidate & {
  blockOrder?: number | null;
  sourceChannel?: "citation_target" | "citation_companion" | "semantic" | null;
  citationResolutionStatus?:
    | "not_attempted"
    | "resolved"
    | "ambiguous"
    | "unresolved"
    | "partially_supported"
    | null;
};

type BuildNormBundleInput<TCandidate extends CompanionLikeCandidate = CompanionLikeCandidate> = {
  plan: LegalQueryPlan;
  selection: StructuredSelectionResult<TCandidate>;
  retrievalResults?: TCandidate[];
  citationDiagnostics?: CitationResolutionDebugEntry[];
};

const EVIDENCE_LIKE_TERMS = [
  "доказ",
  "запис",
  "видеозапис",
  "видеофиксац",
  "bodycam",
  "body-cam",
  "бодикам",
] as const;

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function includesKeyword(source: string, keywords: readonly string[]) {
  return keywords.some((keyword) => source.includes(keyword));
}

function buildCandidateSearchText(candidate: CompanionLikeCandidate) {
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

function clampCompactExcerpt(value: string, limit = 180) {
  const normalized = value.trim().replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n");

  if (normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(1, limit - 1)).trimEnd()}…`;
}

function buildCandidateKey(input: {
  lawId: string | null;
  lawVersion: string | null;
  lawBlockId: string | null;
  relationType: string;
  marker?: string | null;
  partNumber?: string | null;
}) {
  return [
    input.lawId ?? "",
    input.lawVersion ?? "",
    input.lawBlockId ?? "",
    input.relationType,
    input.marker ?? "",
    input.partNumber ?? "",
  ].join(":");
}

function buildItem(input: {
  candidate: CompanionLikeCandidate;
  lawFamily: LawFamily | null;
  relationType: NormBundleRelationType;
  relationReason: string;
  priority: number;
  shouldIncludeInGenerationContext: boolean;
}): NormBundleItem {
  return {
    source_kind: "law",
    law_id: input.candidate.lawId,
    law_version: input.candidate.lawVersionId,
    law_block_id: input.candidate.lawBlockId,
    law_family: input.lawFamily,
    article_number: input.candidate.articleNumberNormalized ?? null,
    marker: null,
    part_number: null,
    relation_type: input.relationType,
    relation_reason: input.relationReason,
    compact_excerpt: clampCompactExcerpt(input.candidate.blockText),
    priority: input.priority,
    should_include_in_generation_context: input.shouldIncludeInGenerationContext,
  };
}

function buildSegmentItem(input: {
  primaryCandidate: CompanionLikeCandidate;
  lawFamily: LawFamily | null;
  segment: ArticleSegment;
  relationType: Exclude<NormBundleRelationType, "primary" | "unresolved_reference">;
  relationReason: string;
  priority: number;
  shouldIncludeInGenerationContext: boolean;
}): NormBundleItem {
  return {
    source_kind: "law",
    law_id: input.primaryCandidate.lawId,
    law_version: input.primaryCandidate.lawVersionId,
    law_block_id: input.primaryCandidate.lawBlockId,
    law_family: input.lawFamily,
    article_number: input.primaryCandidate.articleNumberNormalized ?? null,
    marker: input.segment.marker,
    part_number: input.segment.partNumber,
    relation_type: input.relationType,
    relation_reason: input.relationReason,
    compact_excerpt: clampCompactExcerpt(input.segment.text, 140),
    priority: input.priority,
    should_include_in_generation_context: input.shouldIncludeInGenerationContext,
  };
}

function addBundleItem(
  target: NormBundleItem[],
  item: NormBundleItem,
  seenKeys: Set<string>,
  excludedCompanions: NormBundleCompanionDecision[],
) {
  const key = buildCandidateKey({
    lawId: item.law_id,
    lawVersion: item.law_version,
    lawBlockId: item.law_block_id,
    relationType: item.relation_type,
    marker: item.marker,
    partNumber: item.part_number,
  });

  if (seenKeys.has(key)) {
    if (item.relation_type !== "primary" && item.relation_type !== "unresolved_reference") {
      excludedCompanions.push({
        law_id: item.law_id,
        law_version: item.law_version,
        law_block_id: item.law_block_id,
        marker: item.marker,
        part_number: item.part_number,
        relation_type: item.relation_type,
        reason_code: "duplicate_relation",
        should_include_in_generation_context: item.should_include_in_generation_context,
      });
    }
    return;
  }

  seenKeys.add(key);
  target.push(item);
}

function inferEvidenceLikeCompanion(input: {
  scoredCandidate: ScoredLegalCandidate<CompanionLikeCandidate> | null;
  candidate: CompanionLikeCandidate;
  lawFamily: LawFamily;
  normRole: NormRole;
  plan: LegalQueryPlan;
}) {
  const candidateText = buildCandidateSearchText(input.candidate);
  const evidenceAnchorMatched =
    input.scoredCandidate?.matched_anchors.includes("evidence") ||
    input.scoredCandidate?.matched_anchors.includes("video_recording") ||
    input.plan.legal_anchors.includes("evidence") ||
    input.plan.legal_anchors.includes("video_recording");

  if (includesKeyword(candidateText, EVIDENCE_LIKE_TERMS) && evidenceAnchorMatched) {
    return true;
  }

  return input.normRole === "procedure" && evidenceAnchorMatched && input.lawFamily === "procedural_code";
}

function inferSelectedCompanionRelation(input: {
  candidate: CompanionLikeCandidate;
  scoredCandidate: ScoredLegalCandidate<CompanionLikeCandidate> | null;
  selectedPrimaryBlockIds: Set<string>;
  plan: LegalQueryPlan;
}):
  | {
      relationType: Exclude<NormBundleRelationType, "primary" | "same_article_part" | "article_note" | "article_comment" | "definition" | "nearby_context" | "unresolved_reference">;
      relationReason: string;
      priority: number;
      shouldIncludeInGenerationContext: boolean;
    }
  | null {
  if (input.selectedPrimaryBlockIds.has(input.candidate.lawBlockId)) {
    return null;
  }

  const scored = input.scoredCandidate;
  const lawFamily = scored?.law_family ?? null;
  const normRole = scored?.norm_role ?? null;
  const sourceChannel = scored?.source_channel ?? input.candidate.sourceChannel ?? null;

  if (sourceChannel === "citation_companion") {
    return {
      relationType: "citation_companion",
      relationReason: "selected_citation_companion_channel",
      priority: 60,
      shouldIncludeInGenerationContext: true,
    };
  }

  if (normRole === "exception") {
    return {
      relationType: "exception",
      relationReason: "selected_exception_role",
      priority: 50,
      shouldIncludeInGenerationContext: true,
    };
  }

  if (normRole === "sanction") {
    return {
      relationType: "sanction_companion",
      relationReason: "selected_sanction_role",
      priority: 40,
      shouldIncludeInGenerationContext: true,
    };
  }

  if (normRole === "remedy") {
    return {
      relationType: "remedy_companion",
      relationReason: "selected_remedy_role",
      priority: 35,
      shouldIncludeInGenerationContext: true,
    };
  }

  if (lawFamily && normRole && inferEvidenceLikeCompanion({
    scoredCandidate: scored,
    candidate: input.candidate,
    lawFamily,
    normRole,
    plan: input.plan,
  })) {
    return {
      relationType: "evidence_companion",
      relationReason: "selected_evidence_like_context",
      priority: 30,
      shouldIncludeInGenerationContext: true,
    };
  }

  if (normRole === "procedure" || normRole === "right_or_guarantee") {
    return {
      relationType: "procedure_companion",
      relationReason: "selected_procedure_role",
      priority: 20,
      shouldIncludeInGenerationContext: true,
    };
  }

  return null;
}

function buildUnresolvedWarnings(input: {
  citationDiagnostics?: CitationResolutionDebugEntry[];
}) {
  return (input.citationDiagnostics ?? [])
    .filter((entry) =>
      typeof entry.resolution_status === "string" &&
      ["unresolved", "ambiguous", "partially_supported"].includes(entry.resolution_status),
    )
    .map((entry) => ({
      warning_code:
        entry.resolution_status === "partially_supported"
          ? "citation_partially_supported_reference"
          : "citation_unresolved_reference",
      relation_type: "unresolved_reference" as const,
      message:
        entry.resolution_status === "partially_supported"
          ? "Явная ссылка разрешена частично и требует осторожного companion usage."
          : "Явная ссылка не дала clean resolved target и не должна создавать fake primary bundle.",
      citation_raw: typeof entry.raw_citation === "string" ? entry.raw_citation : null,
      law_block_id:
        typeof entry.resolved_block_id === "string" ? entry.resolved_block_id : null,
    }));
}

function countCompanionItems(bundle: Omit<NormBundle, "bundle_diagnostics">) {
  return (
    bundle.same_article_parts.length +
    bundle.article_notes.length +
    bundle.article_comments.length +
    bundle.exceptions.length +
    bundle.definitions.length +
    bundle.procedure_companions.length +
    bundle.sanction_companions.length +
    bundle.evidence_companions.length +
    bundle.remedy_companions.length +
    bundle.citation_companions.length
  );
}

function hasNormalizedKeyword(source: string, keywords: readonly string[]) {
  return keywords.some((keyword) => source.includes(keyword));
}

function hasTimingSignal(plan: LegalQueryPlan) {
  const normalizedInput = normalizeText(plan.normalized_input);

  return (
    plan.primaryLegalIssueType === "deadline_question" ||
    hasNormalizedKeyword(normalizedInput, [
      "не ответ",
      "срок",
      "в течение",
      "когда ответ",
      "календарного дня",
    ])
  );
}

function hasViolationOrSanctionSignal(plan: LegalQueryPlan) {
  const normalizedInput = normalizeText(plan.normalized_input);

  return (
    plan.primaryLegalIssueType === "sanction_question" ||
    plan.secondaryLegalIssueTypes.includes("sanction_question") ||
    hasNormalizedKeyword(normalizedInput, [
      "не ответ",
      "наруш",
      "ответственност",
      "что грозит",
      "наказ",
      "уголовк",
      "неисполн",
      "неправомерн",
    ])
  );
}

function hasEvidenceSignal(plan: LegalQueryPlan) {
  const normalizedInput = normalizeText(plan.normalized_input);

  return (
    plan.primaryLegalIssueType === "evidence_question" ||
    plan.secondaryLegalIssueTypes.includes("evidence_question") ||
    plan.legal_anchors.includes("evidence") ||
    plan.legal_anchors.includes("video_recording") ||
    hasNormalizedKeyword(normalizedInput, [
      "доказ",
      "видеозап",
      "аудиозап",
      "запись",
      "видеофиксац",
    ])
  );
}

function hasDefinitionSignal(plan: LegalQueryPlan) {
  const normalizedInput = normalizeText(plan.normalized_input);

  return (
    plan.primaryLegalIssueType === "citation_explanation" ||
    hasNormalizedKeyword(normalizedInput, ["что такое", "что значит", "что считается", "понятие"])
  );
}

function hasProcedureSignal(plan: LegalQueryPlan) {
  const normalizedInput = normalizeText(plan.normalized_input);

  return (
    plan.primaryLegalIssueType === "procedure_question" ||
    plan.primaryLegalIssueType === "duty_question" ||
    hasNormalizedKeyword(normalizedInput, ["порядок", "процедур", "как направить", "необходимо"])
  );
}

function hasHint(segment: ArticleSegment, hint: ArticleSegmentRelationHint) {
  return segment.relationHints.includes(hint);
}

function hasAttorneyRequestPrimaryContext(input: { plan: LegalQueryPlan; lawFamily: LawFamily | null }) {
  return input.lawFamily === "advocacy_law" && input.plan.legal_anchors.includes("attorney_request");
}

function buildSegmentSearchText(segment: ArticleSegment) {
  return normalizeText(segment.text);
}

function hasDeadlineAnswerSignal(segment: ArticleSegment) {
  const text = buildSegmentSearchText(segment);

  return hasNormalizedKeyword(text, [
    "должны дать",
    "дать на него ответ",
    "ответ в течение",
    "срок ответа",
    "календарного дня",
    "в течение",
  ]);
}

function hasRefusalGroundSignal(segment: ArticleSegment) {
  const text = buildSegmentSearchText(segment);

  return hasNormalizedKeyword(text, [
    "может быть отказано",
    "не располагает",
    "тайна",
    "основания отказа",
    "отказано",
  ]);
}

function hasConsequenceSignal(segment: ArticleSegment) {
  const text = buildSegmentSearchText(segment);

  return hasNormalizedKeyword(text, [
    "влекут ответственность",
    "влечет ответственность",
    "нарушение сроков",
    "неправомерный отказ",
    "ответственность",
  ]);
}

function requiresMaterialRetentionContext(segment: ArticleSegment) {
  const text = buildSegmentSearchText(segment);

  return hasNormalizedKeyword(text, [
    "срок давности",
    "уничтож",
    "не вправе уничтожать",
    "видеозаписи",
    "аудиозаписи",
  ]);
}

function requiresSubordinateNotificationContext(segment: ArticleSegment) {
  const text = buildSegmentSearchText(segment);

  return hasNormalizedKeyword(text, ["руководител", "подчиненн", "уведом"]);
}

function requiresOgpCaseFileContext(segment: ArticleSegment) {
  const text = buildSegmentSearchText(segment);

  return hasNormalizedKeyword(text, [
    "делопроизводств",
    "офиса генерального прокурора",
    "судебное разбирательство",
    "ходатайств",
  ]);
}

function hasMaterialRetentionContext(plan: LegalQueryPlan) {
  const normalizedInput = normalizeText(plan.normalized_input);

  return hasEvidenceSignal(plan) || hasNormalizedKeyword(normalizedInput, [
    "срок давности",
    "уничтож",
    "хранен",
    "видеозап",
    "аудиозап",
    "материал",
  ]);
}

function hasSubordinateNotificationContext(plan: LegalQueryPlan) {
  const normalizedInput = normalizeText(plan.normalized_input);

  return hasNormalizedKeyword(normalizedInput, ["руководител", "подчиненн", "уведом"]);
}

function hasOgpCaseFileContext(plan: LegalQueryPlan) {
  const normalizedInput = normalizeText(plan.normalized_input);

  return hasNormalizedKeyword(normalizedInput, [
    "огп",
    "генерального прокурора",
    "делопроизводств",
    "материал дела",
    "ходатайств",
  ]);
}

function inferAttorneyRequestExclusionReason(input: {
  segment: ArticleSegment;
  plan: LegalQueryPlan;
}) {
  if (requiresMaterialRetentionContext(input.segment) && !hasMaterialRetentionContext(input.plan)) {
    return "article_segment_requires_material_retention_context";
  }

  if (
    requiresSubordinateNotificationContext(input.segment) &&
    !hasSubordinateNotificationContext(input.plan)
  ) {
    return "article_segment_requires_subordinate_notification_context";
  }

  if (requiresOgpCaseFileContext(input.segment) && !hasOgpCaseFileContext(input.plan)) {
    return "article_segment_requires_ogp_case_file_context";
  }

  if (
    input.plan.primaryLegalIssueType === "deadline_question" &&
    (hasHint(input.segment, "procedure") || hasHint(input.segment, "deadline")) &&
    !hasDeadlineAnswerSignal(input.segment)
  ) {
    return "article_segment_procedure_not_relevant_for_deadline";
  }

  return "article_segment_not_relevant_for_issue";
}

function inferAttorneyRequestSegmentRelation(input: {
  segment: ArticleSegment;
  plan: LegalQueryPlan;
}):
  | {
      relationType: Exclude<NormBundleRelationType, "primary" | "unresolved_reference">;
      relationReason: string;
      priority: number;
      shouldIncludeInGenerationContext: boolean;
    }
  | {
      exclusionReason: string;
    } {
  const isDeadlineQuestion = input.plan.primaryLegalIssueType === "deadline_question";
  const isRefusalQuestion =
    input.plan.primaryLegalIssueType === "refusal_question" ||
    input.plan.secondaryLegalIssueTypes.includes("refusal_question");
  const isSanctionQuestion =
    input.plan.primaryLegalIssueType === "sanction_question" ||
    input.plan.secondaryLegalIssueTypes.includes("sanction_question");
  const hasNoResponseContext =
    isRefusalQuestion &&
    hasNormalizedKeyword(normalizeText(input.plan.normalized_input), [
      "не ответ",
      "нарушение срока",
      "неисполн",
      "неправомерный отказ",
      "ответственност",
    ]);

  if (input.segment.segmentType === "note") {
    if (hasProcedureSignal(input.plan) || hasEvidenceSignal(input.plan)) {
      return {
        relationType: "article_note",
        relationReason: "article_segment_note_relevant",
        priority: 18,
        shouldIncludeInGenerationContext: false,
      };
    }

    return { exclusionReason: inferAttorneyRequestExclusionReason(input) };
  }

  if (hasConsequenceSignal(input.segment)) {
    if (isSanctionQuestion || hasNoResponseContext || hasViolationOrSanctionSignal(input.plan)) {
      return {
        relationType: "sanction_companion",
        relationReason: "article_segment_consequence_signal",
        priority: 45,
        shouldIncludeInGenerationContext: false,
      };
    }

    return { exclusionReason: inferAttorneyRequestExclusionReason(input) };
  }

  if (hasRefusalGroundSignal(input.segment)) {
    if (isRefusalQuestion || (isSanctionQuestion && hasNoResponseContext)) {
      return {
        relationType: "exception",
        relationReason: "article_segment_refusal_ground_signal",
        priority: 42,
        shouldIncludeInGenerationContext: false,
      };
    }

    return { exclusionReason: inferAttorneyRequestExclusionReason(input) };
  }

  if (hasDeadlineAnswerSignal(input.segment)) {
    if (isDeadlineQuestion) {
      return {
        relationType: "procedure_companion",
        relationReason: "article_segment_deadline_answer_signal",
        priority: 40,
        shouldIncludeInGenerationContext: false,
      };
    }

    if (isRefusalQuestion && (hasTimingSignal(input.plan) || hasNoResponseContext)) {
      return {
        relationType: "procedure_companion",
        relationReason: "article_segment_relevant_to_no_response",
        priority: 38,
        shouldIncludeInGenerationContext: false,
      };
    }

    if (isSanctionQuestion) {
      return {
        relationType: "procedure_companion",
        relationReason: "article_segment_deadline_answer_signal",
        priority: 34,
        shouldIncludeInGenerationContext: false,
      };
    }

    if (hasProcedureSignal(input.plan)) {
      return {
        relationType: "procedure_companion",
        relationReason: "article_segment_deadline_answer_signal",
        priority: 34,
        shouldIncludeInGenerationContext: false,
      };
    }
  }

  if (hasHint(input.segment, "evidence") && hasMaterialRetentionContext(input.plan)) {
    return {
      relationType: "evidence_companion",
      relationReason: "article_segment_evidence_signal",
      priority: 38,
      shouldIncludeInGenerationContext: false,
    };
  }

  return { exclusionReason: inferAttorneyRequestExclusionReason(input) };
}

function inferArticleSegmentRelation(input: {
  segment: ArticleSegment;
  plan: LegalQueryPlan;
  lawFamily: LawFamily | null;
}):
  | {
      relationType: Exclude<NormBundleRelationType, "primary" | "unresolved_reference">;
      relationReason: string;
      priority: number;
      shouldIncludeInGenerationContext: boolean;
    }
  | {
      exclusionReason: string;
    }
  | null {
  if (hasAttorneyRequestPrimaryContext({ plan: input.plan, lawFamily: input.lawFamily })) {
    return inferAttorneyRequestSegmentRelation({
      segment: input.segment,
      plan: input.plan,
    });
  }

  if (input.segment.segmentType === "note") {
    if (hasProcedureSignal(input.plan) || hasEvidenceSignal(input.plan)) {
      return {
        relationType: "article_note",
        relationReason: "article_segment_note_relevant",
        priority: 18,
        shouldIncludeInGenerationContext: false,
      };
    }

    return {
      exclusionReason: "article_segment_not_relevant_for_issue",
    };
  }

  if (
    hasHint(input.segment, "evidence") &&
    (hasEvidenceSignal(input.plan) || input.plan.primaryLegalIssueType === "procedure_question")
  ) {
    return {
      relationType: "evidence_companion",
      relationReason: "article_segment_evidence_signal",
      priority: 38,
      shouldIncludeInGenerationContext: false,
    };
  }

  if (hasHint(input.segment, "sanction")) {
    if (hasViolationOrSanctionSignal(input.plan)) {
      return {
        relationType: "sanction_companion",
        relationReason: "article_segment_sanction_signal",
        priority: 45,
        shouldIncludeInGenerationContext: false,
      };
    }

    return {
      exclusionReason: "article_segment_not_relevant_for_issue",
    };
  }

  if (hasHint(input.segment, "exception")) {
    if (
      input.plan.primaryLegalIssueType === "refusal_question" ||
      input.plan.secondaryLegalIssueTypes.includes("refusal_question") ||
      input.plan.legal_anchors.includes("exception")
    ) {
      return {
        relationType: "exception",
        relationReason: "article_segment_exception_signal",
        priority: 42,
        shouldIncludeInGenerationContext: false,
      };
    }

    return {
      exclusionReason: "article_segment_not_relevant_for_issue",
    };
  }

  if (
    (hasHint(input.segment, "deadline") || hasHint(input.segment, "procedure")) &&
    (input.plan.primaryLegalIssueType === "deadline_question" ||
      hasProcedureSignal(input.plan) ||
      (input.plan.primaryLegalIssueType === "refusal_question" && hasTimingSignal(input.plan)))
  ) {
    return {
      relationType: "procedure_companion",
      relationReason: "article_segment_deadline_or_procedure_signal",
      priority: 36,
      shouldIncludeInGenerationContext: false,
    };
  }

  if (hasHint(input.segment, "definition") && hasDefinitionSignal(input.plan)) {
    return {
      relationType: "definition",
      relationReason: "article_segment_definition_signal",
      priority: 16,
      shouldIncludeInGenerationContext: false,
    };
  }

  if (
    input.segment.segmentType === "part" &&
    (hasHint(input.segment, "definition") ||
      hasHint(input.segment, "procedure") ||
      hasHint(input.segment, "evidence")) &&
    input.lawFamily === "advocacy_law" &&
    input.plan.legal_anchors.includes("attorney_request") &&
    (hasDefinitionSignal(input.plan) || hasProcedureSignal(input.plan))
  ) {
    return {
      relationType: "same_article_part",
      relationReason: "article_segment_relevant_same_article_context",
      priority: 12,
      shouldIncludeInGenerationContext: false,
    };
  }

  return {
    exclusionReason: "article_segment_not_relevant_for_issue",
  };
}

export function buildNormBundle<TCandidate extends CompanionLikeCandidate>(
  input: BuildNormBundleInput<TCandidate>,
): NormBundle {
  const primaryKeys = new Set(
    input.selection.primary_basis_norms.map((candidate) => candidate.lawBlockId),
  );
  const selectedKeys = new Set(
    input.selection.selected_norms.map((candidate) => candidate.lawBlockId),
  );
  const scoredCandidateMap = new Map(
    input.selection.scored_candidates.map((entry) => [entry.candidate.lawBlockId, entry] as const),
  );
  const runtimeCandidates = input.retrievalResults ?? [];
  const runtimeCandidateMap = new Map(
    runtimeCandidates.map((candidate) => [candidate.lawBlockId, candidate] as const),
  );
  const seenKeys = new Set<string>();
  const excludedCompanions: NormBundleCompanionDecision[] = [];
  const includedArticleSegments: NormBundleArticleSegmentDecision[] = [];
  const excludedArticleSegments: NormBundleArticleSegmentDecision[] = [];
  const bundle: Omit<NormBundle, "bundle_diagnostics"> = {
    primary_basis_norms: [],
    same_article_parts: [],
    article_notes: [],
    article_comments: [],
    exceptions: [],
    definitions: [],
    procedure_companions: [],
    sanction_companions: [],
    evidence_companions: [],
    remedy_companions: [],
    citation_companions: [],
    unresolved_companion_warnings: buildUnresolvedWarnings({
      citationDiagnostics: input.citationDiagnostics,
    }),
  };

  for (const primaryCandidate of input.selection.primary_basis_norms) {
    const scoredCandidate = scoredCandidateMap.get(primaryCandidate.lawBlockId) ?? null;
    const item = buildItem({
      candidate: primaryCandidate,
      lawFamily: scoredCandidate?.law_family ?? null,
      relationType: "primary",
      relationReason:
        scoredCandidate?.primary_basis_eligibility_reason ?? "selected_primary_basis",
      priority: 100,
      shouldIncludeInGenerationContext: true,
    });

    addBundleItem(bundle.primary_basis_norms, item, seenKeys, excludedCompanions);

    if (primaryCandidate.blockType !== "article") {
      continue;
    }

    const articleSegments = parseArticleSegments(primaryCandidate.blockText);

    if (
      articleSegments.length === 1 &&
      articleSegments[0]?.segmentType === "unstructured"
    ) {
      continue;
    }

    for (const segment of articleSegments) {
      if (segment.segmentType === "article_heading") {
        continue;
      }

      const relation = inferArticleSegmentRelation({
        segment,
        plan: input.plan,
        lawFamily: scoredCandidate?.law_family ?? null,
      });

      if (!relation || "exclusionReason" in relation) {
        excludedArticleSegments.push({
          law_id: primaryCandidate.lawId,
          law_version: primaryCandidate.lawVersionId,
          law_block_id: primaryCandidate.lawBlockId,
          marker: segment.marker,
          part_number: segment.partNumber,
          relation_type: segment.segmentType === "note" ? "article_note" : "same_article_part",
          reason_code:
            relation && "exclusionReason" in relation
              ? relation.exclusionReason
              : "article_segment_not_relevant_for_issue",
        });
        continue;
      }

      const segmentItem = buildSegmentItem({
        primaryCandidate,
        lawFamily: scoredCandidate?.law_family ?? null,
        segment,
        relationType: relation.relationType,
        relationReason: relation.relationReason,
        priority: relation.priority,
        shouldIncludeInGenerationContext: relation.shouldIncludeInGenerationContext,
      });
      const beforeSize = seenKeys.size;

      switch (relation.relationType) {
        case "same_article_part":
          addBundleItem(bundle.same_article_parts, segmentItem, seenKeys, excludedCompanions);
          break;
        case "article_note":
          addBundleItem(bundle.article_notes, segmentItem, seenKeys, excludedCompanions);
          break;
        case "definition":
          addBundleItem(bundle.definitions, segmentItem, seenKeys, excludedCompanions);
          break;
        case "exception":
          addBundleItem(bundle.exceptions, segmentItem, seenKeys, excludedCompanions);
          break;
        case "procedure_companion":
          addBundleItem(bundle.procedure_companions, segmentItem, seenKeys, excludedCompanions);
          break;
        case "sanction_companion":
          addBundleItem(bundle.sanction_companions, segmentItem, seenKeys, excludedCompanions);
          break;
        case "evidence_companion":
          addBundleItem(bundle.evidence_companions, segmentItem, seenKeys, excludedCompanions);
          break;
        case "remedy_companion":
          addBundleItem(bundle.remedy_companions, segmentItem, seenKeys, excludedCompanions);
          break;
        case "citation_companion":
          addBundleItem(bundle.citation_companions, segmentItem, seenKeys, excludedCompanions);
          break;
      }

      if (seenKeys.size === beforeSize) {
        excludedArticleSegments.push({
          law_id: primaryCandidate.lawId,
          law_version: primaryCandidate.lawVersionId,
          law_block_id: primaryCandidate.lawBlockId,
          marker: segment.marker,
          part_number: segment.partNumber,
          relation_type: relation.relationType,
          reason_code: "duplicate_relation",
        });
        continue;
      }

      includedArticleSegments.push({
        law_id: primaryCandidate.lawId,
        law_version: primaryCandidate.lawVersionId,
        law_block_id: primaryCandidate.lawBlockId,
        marker: segment.marker,
        part_number: segment.partNumber,
        relation_type: relation.relationType,
        reason_code: relation.relationReason,
      });
    }
  }

  for (const selectedCandidate of input.selection.selected_norms) {
    const scoredCandidate = scoredCandidateMap.get(selectedCandidate.lawBlockId) ?? null;
    const relation = inferSelectedCompanionRelation({
      candidate: selectedCandidate,
      scoredCandidate,
      selectedPrimaryBlockIds: primaryKeys,
      plan: input.plan,
    });

    if (!relation) {
      continue;
    }

    const item = buildItem({
      candidate: selectedCandidate,
      lawFamily: scoredCandidate?.law_family ?? null,
      relationType: relation.relationType,
      relationReason: relation.relationReason,
      priority: relation.priority,
      shouldIncludeInGenerationContext: relation.shouldIncludeInGenerationContext,
    });

    switch (relation.relationType) {
      case "procedure_companion":
        addBundleItem(bundle.procedure_companions, item, seenKeys, excludedCompanions);
        break;
      case "sanction_companion":
        addBundleItem(bundle.sanction_companions, item, seenKeys, excludedCompanions);
        break;
      case "evidence_companion":
        addBundleItem(bundle.evidence_companions, item, seenKeys, excludedCompanions);
        break;
      case "remedy_companion":
        addBundleItem(bundle.remedy_companions, item, seenKeys, excludedCompanions);
        break;
      case "citation_companion":
        addBundleItem(bundle.citation_companions, item, seenKeys, excludedCompanions);
        break;
      case "exception":
        addBundleItem(bundle.exceptions, item, seenKeys, excludedCompanions);
        break;
    }
  }

  for (const primaryCandidate of input.selection.primary_basis_norms) {
    const primaryRuntimeCandidate =
      runtimeCandidateMap.get(primaryCandidate.lawBlockId) ?? primaryCandidate;
    const primaryScored = scoredCandidateMap.get(primaryCandidate.lawBlockId) ?? null;

    for (const runtimeCandidate of runtimeCandidates) {
      if (runtimeCandidate.lawBlockId === primaryRuntimeCandidate.lawBlockId) {
        continue;
      }

      if (selectedKeys.has(runtimeCandidate.lawBlockId)) {
        continue;
      }

      if (runtimeCandidate.lawId !== primaryRuntimeCandidate.lawId) {
        continue;
      }

      const runtimeScored = scoredCandidateMap.get(runtimeCandidate.lawBlockId) ?? null;
      const sourceChannel = runtimeScored?.source_channel ?? runtimeCandidate.sourceChannel ?? null;

      if (sourceChannel === "citation_companion") {
        addBundleItem(
          bundle.citation_companions,
          buildItem({
            candidate: runtimeCandidate,
            lawFamily: runtimeScored?.law_family ?? primaryScored?.law_family ?? null,
            relationType: "citation_companion",
            relationReason: "runtime_citation_companion_channel",
            priority: 55,
            shouldIncludeInGenerationContext: false,
          }),
          seenKeys,
          excludedCompanions,
        );
        continue;
      }

      if (
        primaryRuntimeCandidate.articleNumberNormalized &&
        runtimeCandidate.articleNumberNormalized === primaryRuntimeCandidate.articleNumberNormalized
      ) {
        addBundleItem(
          bundle.same_article_parts,
          buildItem({
            candidate: runtimeCandidate,
            lawFamily: runtimeScored?.law_family ?? primaryScored?.law_family ?? null,
            relationType: "same_article_part",
            relationReason: "runtime_same_law_same_article",
            priority: 15,
            shouldIncludeInGenerationContext: false,
          }),
          seenKeys,
          excludedCompanions,
        );
        continue;
      }

      if (
        typeof runtimeCandidate.blockOrder === "number" &&
        typeof primaryRuntimeCandidate.blockOrder === "number" &&
        Math.abs(runtimeCandidate.blockOrder - primaryRuntimeCandidate.blockOrder) <= 1
      ) {
        addBundleItem(
          bundle.same_article_parts,
          buildItem({
            candidate: runtimeCandidate,
            lawFamily: runtimeScored?.law_family ?? primaryScored?.law_family ?? null,
            relationType: "nearby_context",
            relationReason: "runtime_same_law_neighboring_block",
            priority: 10,
            shouldIncludeInGenerationContext: false,
          }),
          seenKeys,
          excludedCompanions,
        );
      }
    }
  }

  const companionRelationTypes = Array.from(
    new Set(
      [
        ...bundle.same_article_parts,
        ...bundle.article_notes,
        ...bundle.article_comments,
        ...bundle.exceptions,
        ...bundle.definitions,
        ...bundle.procedure_companions,
        ...bundle.sanction_companions,
        ...bundle.evidence_companions,
        ...bundle.remedy_companions,
        ...bundle.citation_companions,
      ].map((item) => item.relation_type as Exclude<NormBundleRelationType, "primary" | "unresolved_reference">),
    ),
  );
  const includedCompanions = [
    ...bundle.same_article_parts,
    ...bundle.article_notes,
    ...bundle.article_comments,
    ...bundle.exceptions,
    ...bundle.definitions,
    ...bundle.procedure_companions,
    ...bundle.sanction_companions,
    ...bundle.evidence_companions,
    ...bundle.remedy_companions,
    ...bundle.citation_companions,
  ]
    .map((item) => ({
      law_id: item.law_id,
      law_version: item.law_version,
      law_block_id: item.law_block_id,
      marker: item.marker ?? null,
      part_number: item.part_number ?? null,
      relation_type: item.relation_type as Exclude<
        NormBundleRelationType,
        "primary" | "unresolved_reference"
      >,
      reason_code: item.relation_reason,
      should_include_in_generation_context: item.should_include_in_generation_context,
    }))
    .sort((left, right) => {
      if (left.relation_type !== right.relation_type) {
        return left.relation_type.localeCompare(right.relation_type, "ru");
      }

      return (left.law_block_id ?? "").localeCompare(right.law_block_id ?? "", "ru");
    });

  const bundleDiagnostics: NormBundleDiagnostics = {
    norm_bundle_present:
      bundle.primary_basis_norms.length > 0 ||
      countCompanionItems(bundle) > 0 ||
      bundle.unresolved_companion_warnings.length > 0,
    bundle_primary_count: bundle.primary_basis_norms.length,
    bundle_companion_count: countCompanionItems(bundle),
    missing_expected_companion: [],
    companion_relation_types: companionRelationTypes,
    included_companions: includedCompanions,
    excluded_companions: excludedCompanions,
    bundle_budget_trimmed: false,
    bundle_generation_context_items: [
      ...bundle.primary_basis_norms,
      ...bundle.same_article_parts,
      ...bundle.article_notes,
      ...bundle.article_comments,
      ...bundle.exceptions,
      ...bundle.definitions,
      ...bundle.procedure_companions,
      ...bundle.sanction_companions,
      ...bundle.evidence_companions,
      ...bundle.remedy_companions,
      ...bundle.citation_companions,
    ].filter((item) => item.should_include_in_generation_context).length,
    same_article_part_count: bundle.same_article_parts.length,
    article_note_count: bundle.article_notes.length,
    exception_count: bundle.exceptions.length,
    sanction_companion_count: bundle.sanction_companions.length,
    evidence_companion_count: bundle.evidence_companions.length,
    segment_relation_types: Array.from(
      new Set(includedArticleSegments.map((entry) => entry.relation_type)),
    ),
    included_article_segments: includedArticleSegments,
    excluded_article_segments: excludedArticleSegments,
  };

  return {
    ...bundle,
    bundle_diagnostics: bundleDiagnostics,
  };
}
