import { createHash } from "node:crypto";

import { listCurrentLawBlocksByServer } from "@/db/repositories/law.repository";
import type {
  AssistantRetrievalQueryBreakdown,
  AssistantRetrievalRuntimeTag,
} from "@/server/legal-core/assistant-retrieval-query";
import type { LegalQueryPlan } from "@/server/legal-core/legal-query-plan";
import { LEGAL_SEMANTIC_RUNTIME_TAG_KEYWORDS } from "@/server/legal-core/legal-semantic-dictionaries";
import {
  classifyLawFamily,
  classifyNormRole,
  type LawFamily,
  type LegalSelectionCandidate,
  type NormRole,
} from "@/server/legal-core/legal-selection";
import {
  buildLegalCitationResolverEntriesFromLawBlocks,
  resolveExplicitLegalCitation,
  type LegalCitationResolutionReason,
  type LegalCitationResolutionReport,
  type LegalCitationResolutionStatus,
} from "@/server/law-corpus/legal-citation-resolver";
import { searchCurrentLawCorpusInputSchema } from "@/schemas/law-corpus";

type RetrievalDependencies = {
  listCurrentLawBlocksByServer: typeof listCurrentLawBlocksByServer;
  now: () => Date;
};

type CurrentLawBlock = Awaited<ReturnType<typeof listCurrentLawBlocksByServer>>[number];

type LawRetrievalContext = {
  legalQueryPlan: LegalQueryPlan;
  queryBreakdown: AssistantRetrievalQueryBreakdown;
};

type CitationSourceChannel = "citation_target" | "citation_companion" | "semantic";
type CitationMatchStrength =
  | "exact_article"
  | "exact_article_supported_subunit"
  | "article_with_gap"
  | "same_law_companion";

type LawSearchResultCitationMetadata = {
  source_channel: CitationSourceChannel;
  explicit_citation_raw: string | null;
  citation_resolution_status: LegalCitationResolutionStatus | null;
  citation_resolution_reason: LegalCitationResolutionReason | null;
  citation_match_strength: CitationMatchStrength | null;
};

type LawSearchResultItem = {
  score: number;
  serverId: string;
  lawId: string;
  lawKey: string;
  lawTitle: string;
  lawVersionId: string;
  lawVersionStatus: CurrentLawBlock["lawVersion"]["status"];
  lawBlockId: string;
  blockType: CurrentLawBlock["blockType"];
  blockOrder: number;
  articleNumberNormalized: string | null;
  snippet: string;
  blockText: string;
  sourceTopicUrl: string;
  sourcePosts: Array<{
    postExternalId: string;
    postUrl: string;
    postOrder: number;
  }>;
  metadata: {
    sourceSnapshotHash: string;
    normalizedTextHash: string;
    corpusSnapshotHash: string;
    citation?: LawSearchResultCitationMetadata;
  };
};

type BaseLawCorpusSearchResult = {
  query: string;
  serverId: string;
  resultCount: number;
  corpusSnapshot: {
    serverId: string;
    generatedAt: string;
    currentVersionIds: string[];
    corpusSnapshotHash: string;
  };
  results: LawSearchResultItem[];
};

type LawRetrievalCompactCandidate = {
  law_id: string;
  law_key: string;
  law_name: string;
  law_version: string;
  law_block_id: string;
  article_number: string | null;
  block_type: string;
  law_family_guess: LawFamily;
  runtime_tags: AssistantRetrievalRuntimeTag[];
  retrieval_score: number;
  filter_reasons: string[];
  source_channel: CitationSourceChannel;
  explicit_citation_raw: string | null;
  citation_resolution_status: LegalCitationResolutionStatus | null;
  citation_resolution_reason: LegalCitationResolutionReason | null;
  citation_match_strength: CitationMatchStrength | null;
};

type LawRetrievalDebug = {
  retrieval_query_base_terms: string[];
  retrieval_query_anchor_terms: string[];
  retrieval_query_family_terms: string[];
  retrieval_runtime_tags: AssistantRetrievalRuntimeTag[];
  candidate_pool_before_filters: LawRetrievalCompactCandidate[];
  candidate_pool_after_filters: LawRetrievalCompactCandidate[];
  applied_biases: string[];
  filter_reasons: Array<{
    law_block_id: string;
    reasons: string[];
  }>;
  citation_resolution: Array<{
    raw_citation: string;
    law_family: LawFamily | null;
    article_number: string;
    part_number: string | null;
    point_number: string | null;
    resolution_status: LegalCitationResolutionStatus;
    resolution_reason: LegalCitationResolutionReason | null;
    resolved_block_id: string | null;
    resolved_law_source_id: string | null;
    matched_law_title: string | null;
    matched_block_title: string | null;
    collision_candidates_count: number;
    same_law_companion_candidates_count: number;
    note_exception_comment_hits_count: number;
    cross_reference_hits_count: number;
  }>;
  citation_target_count: number;
  citation_companion_count: number;
  citation_unresolved_count: number;
  citation_partially_supported_count: number;
  semantic_retrieval_allowed_as_companion_only: boolean;
};

type LawRetrievalResult = BaseLawCorpusSearchResult & {
  retrievalDebug?: LawRetrievalDebug | null;
};

type ScoredLawCandidate = {
  block: CurrentLawBlock;
  result: LawSearchResultItem;
  law_family_guess: LawFamily;
  norm_role_guess: NormRole;
  runtime_tags: AssistantRetrievalRuntimeTag[];
  lexical_score: number;
  retrieval_score: number;
  filter_reasons: string[];
  source_channel: CitationSourceChannel;
  explicit_citation_raw: string | null;
  citation_resolution_status: LegalCitationResolutionStatus | null;
  citation_resolution_reason: LegalCitationResolutionReason | null;
  citation_match_strength: CitationMatchStrength | null;
};

const defaultDependencies: RetrievalDependencies = {
  listCurrentLawBlocksByServer,
  now: () => new Date(),
};

const MIN_OVERFETCH_LIMIT = 18;
const MAX_ASSISTANT_FINAL_POOL = 12;

const neighboringFamiliesByFamily = {
  administrative_code: ["procedural_code"],
  procedural_code: ["administrative_code", "advocacy_law", "government_code"],
  criminal_code: ["government_code", "advocacy_law"],
  advocacy_law: ["procedural_code", "government_code", "ethics_code", "criminal_code"],
  ethics_code: ["government_code", "advocacy_law"],
  constitution: ["procedural_code", "advocacy_law", "government_code"],
  department_specific: ["government_code", "procedural_code"],
  government_code: ["advocacy_law", "procedural_code", "ethics_code", "criminal_code"],
  immunity_law: ["procedural_code", "government_code"],
  public_assembly_law: ["administrative_code", "procedural_code"],
  other: [],
} as const satisfies Record<LawFamily, LawFamily[]>;

function normalizeSearchText(input: string) {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}

function tokenizeText(input: string) {
  return Array.from(new Set(normalizeSearchText(input).match(/[\p{L}\p{N}._-]+/gu) ?? [])).filter(
    (token) => token.length >= 2,
  );
}

function hasKeyword(source: string, keywords: readonly string[]) {
  return keywords.some((keyword) => source.includes(keyword));
}

function buildSnippet(blockText: string, queryTokens: string[]) {
  const normalizedBlockText = normalizeSearchText(blockText);
  const firstMatchToken = queryTokens.find((token) => normalizedBlockText.includes(token));

  if (!firstMatchToken) {
    return blockText.slice(0, 280).trim();
  }

  const startIndex = normalizedBlockText.indexOf(firstMatchToken);
  const snippetStart = Math.max(0, startIndex - 120);
  const snippetEnd = Math.min(blockText.length, startIndex + 220);
  const prefix = snippetStart > 0 ? "..." : "";
  const suffix = snippetEnd < blockText.length ? "..." : "";

  return `${prefix}${blockText.slice(snippetStart, snippetEnd).trim()}${suffix}`;
}

function buildCorpusSnapshotMetadata(
  blocks: Awaited<ReturnType<typeof listCurrentLawBlocksByServer>>,
  serverId: string,
  generatedAt: Date,
) {
  const currentVersionEntries = Array.from(
    new Map(
      blocks.map((block) => [
        block.lawVersion.id,
        {
          lawId: block.lawVersion.currentForLaw?.id ?? block.lawVersion.lawId,
          lawVersionId: block.lawVersion.id,
          normalizedTextHash: block.lawVersion.normalizedTextHash,
        },
      ]),
    ).values(),
  ).sort((left, right) => left.lawVersionId.localeCompare(right.lawVersionId));
  const snapshotInput = currentVersionEntries
    .map((entry) => `${entry.lawId}:${entry.lawVersionId}:${entry.normalizedTextHash}`)
    .join("|");

  return {
    serverId,
    generatedAt: generatedAt.toISOString(),
    currentVersionIds: currentVersionEntries.map((entry) => entry.lawVersionId),
    corpusSnapshotHash: createHash("sha256").update(snapshotInput).digest("hex"),
  };
}

function scoreLawBlock(
  input: {
    blockType: "section" | "chapter" | "article" | "appendix" | "unstructured";
    blockTitle: string | null;
    blockText: string;
    articleNumberNormalized: string | null;
    lawTitle: string;
  },
  query: string,
  queryTokens: string[],
) {
  const normalizedQuery = normalizeSearchText(query);
  const normalizedLawTitle = normalizeSearchText(input.lawTitle);
  const normalizedBlockTitle = normalizeSearchText(input.blockTitle ?? "");
  const normalizedBlockText = normalizeSearchText(input.blockText);
  const normalizedArticleNumber = normalizeSearchText(input.articleNumberNormalized ?? "");
  let score = 0;
  let hasDirectMatch = false;

  if (normalizedArticleNumber && normalizedQuery === normalizedArticleNumber) {
    score += 80;
    hasDirectMatch = true;
  }

  if (normalizedBlockTitle.includes(normalizedQuery) || normalizedLawTitle.includes(normalizedQuery)) {
    score += 28;
    hasDirectMatch = true;
  }

  if (normalizedBlockText.includes(normalizedQuery)) {
    score += 20;
    hasDirectMatch = true;
  }

  for (const token of queryTokens) {
    if (normalizedArticleNumber && normalizedArticleNumber === token) {
      score += 36;
      hasDirectMatch = true;
    }

    if (normalizedLawTitle.includes(token)) {
      score += 10;
      hasDirectMatch = true;
    }

    if (normalizedBlockTitle.includes(token)) {
      score += 12;
      hasDirectMatch = true;
    }

    if (normalizedBlockText.includes(token)) {
      score += 8;
      hasDirectMatch = true;
    }
  }

  if (hasDirectMatch && input.blockType === "article") {
    score += 12;
  }

  return score;
}

function getBlockTypePriority(blockType: "section" | "chapter" | "article" | "appendix" | "unstructured") {
  switch (blockType) {
    case "article":
      return 0;
    case "chapter":
      return 1;
    case "section":
      return 2;
    case "appendix":
      return 3;
    default:
      return 4;
  }
}

function buildSelectionCandidate(block: CurrentLawBlock, serverId: string): LegalSelectionCandidate | null {
  const law = block.lawVersion.currentForLaw;

  if (!law) {
    return null;
  }

  return {
    serverId,
    lawId: law.id,
    lawKey: law.lawKey,
    lawTitle: law.title,
    lawVersionId: block.lawVersion.id,
    lawBlockId: block.id,
    blockType: block.blockType,
    blockText: block.blockText,
    articleNumberNormalized: block.articleNumberNormalized,
    sourceTopicUrl: law.topicUrl,
  };
}

function buildRuntimeTags(candidate: LegalSelectionCandidate, lawFamily: LawFamily) {
  const normalizedSource = normalizeSearchText(
    [
      candidate.lawKey,
      candidate.lawTitle,
      candidate.blockType,
      candidate.blockText,
      candidate.articleNumberNormalized ?? "",
      candidate.sourceTopicUrl,
    ].join(" "),
  );
  const tags = new Set<AssistantRetrievalRuntimeTag>();

  if (
    lawFamily === "administrative_code" ||
    hasKeyword(normalizedSource, LEGAL_SEMANTIC_RUNTIME_TAG_KEYWORDS.candidate_material_offense) ||
    candidate.lawKey.includes("ak")
  ) {
    tags.add("material_offense");
  }

  if (hasKeyword(normalizedSource, LEGAL_SEMANTIC_RUNTIME_TAG_KEYWORDS.candidate_detention)) {
    tags.add("detention");
  }

  if (hasKeyword(normalizedSource, LEGAL_SEMANTIC_RUNTIME_TAG_KEYWORDS.candidate_ticket)) {
    tags.add("ticket");
  }

  if (hasKeyword(normalizedSource, LEGAL_SEMANTIC_RUNTIME_TAG_KEYWORDS.candidate_identity_check)) {
    tags.add("identity_check");
  }

  if (hasKeyword(normalizedSource, LEGAL_SEMANTIC_RUNTIME_TAG_KEYWORDS.candidate_attorney)) {
    tags.add("attorney");
  }

  if (hasKeyword(normalizedSource, LEGAL_SEMANTIC_RUNTIME_TAG_KEYWORDS.candidate_attorney_request)) {
    tags.add("attorney_request");
  }

  if (hasKeyword(normalizedSource, LEGAL_SEMANTIC_RUNTIME_TAG_KEYWORDS.candidate_bodycam)) {
    tags.add("bodycam");
  }

  if (hasKeyword(normalizedSource, LEGAL_SEMANTIC_RUNTIME_TAG_KEYWORDS.candidate_evidence)) {
    tags.add("evidence");
  }

  if (
    lawFamily === "government_code" ||
    hasKeyword(normalizedSource, LEGAL_SEMANTIC_RUNTIME_TAG_KEYWORDS.candidate_official_duty)
  ) {
    tags.add("official_duty");
  }

  if (
    lawFamily === "department_specific" ||
    hasKeyword(normalizedSource, LEGAL_SEMANTIC_RUNTIME_TAG_KEYWORDS.candidate_special_service_scope)
  ) {
    tags.add("special_service_scope");
  }

  if (
    lawFamily === "public_assembly_law" ||
    hasKeyword(normalizedSource, LEGAL_SEMANTIC_RUNTIME_TAG_KEYWORDS.candidate_public_assembly)
  ) {
    tags.add("public_assembly");
  }

  if (
    lawFamily === "immunity_law" ||
    hasKeyword(normalizedSource, LEGAL_SEMANTIC_RUNTIME_TAG_KEYWORDS.candidate_immunity)
  ) {
    tags.add("immunity");
  }

  return Array.from(tags);
}

function buildLexicalQueryText(input: { query: string; context?: LawRetrievalContext | null }) {
  if (!input.context) {
    return input.query;
  }

  return input.context.legalQueryPlan.normalized_input;
}

function buildContextSeedScore(input: {
  block: CurrentLawBlock;
  context?: LawRetrievalContext | null;
}) {
  if (!input.context) {
    return 0;
  }

  const law = input.block.lawVersion.currentForLaw;

  if (!law) {
    return 0;
  }

  const normalizedCandidateText = normalizeSearchText(
    [
      law.lawKey,
      law.title,
      input.block.blockTitle ?? "",
      input.block.blockText,
      input.block.articleNumberNormalized ?? "",
      law.topicUrl,
    ].join(" "),
  );
  const anchorMatches = input.context.queryBreakdown.anchor_terms.filter((term) =>
    normalizedCandidateText.includes(normalizeSearchText(term)),
  ).length;
  const familyMatches = input.context.queryBreakdown.family_terms.filter((term) =>
    normalizedCandidateText.includes(normalizeSearchText(term)),
  ).length;

  return anchorMatches * 6 + familyMatches * 4;
}

function getNeighboringFamilies(requiredFamilies: LawFamily[]) {
  return Array.from(
    new Set(
      requiredFamilies.flatMap(
        (family) => [...(neighboringFamiliesByFamily[family] ?? [])] as LawFamily[],
      ),
    ),
  );
}

function buildCompactCandidate(entry: ScoredLawCandidate): LawRetrievalCompactCandidate {
  return {
    law_id: entry.result.lawId,
    law_key: entry.result.lawKey,
    law_name: entry.result.lawTitle,
    law_version: entry.result.lawVersionId,
    law_block_id: entry.result.lawBlockId,
    article_number: entry.result.articleNumberNormalized ?? null,
    block_type: entry.result.blockType,
    law_family_guess: entry.law_family_guess,
    runtime_tags: entry.runtime_tags,
    retrieval_score: entry.retrieval_score,
    filter_reasons: entry.filter_reasons,
    source_channel: entry.source_channel,
    explicit_citation_raw: entry.explicit_citation_raw,
    citation_resolution_status: entry.citation_resolution_status,
    citation_resolution_reason: entry.citation_resolution_reason,
    citation_match_strength: entry.citation_match_strength,
  };
}

function buildScoredCandidate(input: {
  block: CurrentLawBlock;
  lexicalScore: number;
  context: LawRetrievalContext;
  corpusSnapshotHash: string;
  lexicalQueryTokens: string[];
  serverId: string;
  citationMetadata?: LawSearchResultCitationMetadata;
}) {
  const candidate = buildSelectionCandidate(input.block, input.serverId);

  if (!candidate) {
    return null;
  }

  const law = input.block.lawVersion.currentForLaw;

  if (!law) {
    return null;
  }

  const lawFamily = classifyLawFamily(candidate);
  const normRole = classifyNormRole(candidate);
  const runtimeTags = buildRuntimeTags(candidate, lawFamily);
  const normalizedCandidateText = normalizeSearchText(
    [
      candidate.lawKey,
      candidate.lawTitle,
      input.block.blockTitle ?? "",
      candidate.blockText,
      candidate.articleNumberNormalized ?? "",
      candidate.sourceTopicUrl,
    ].join(" "),
  );
  const anchorMatches = input.context.queryBreakdown.anchor_terms.filter((term) =>
    normalizedCandidateText.includes(normalizeSearchText(term)),
  );
  const familyMatches = input.context.queryBreakdown.family_terms.filter((term) =>
    normalizedCandidateText.includes(normalizeSearchText(term)),
  );
  const queryTagOverlap = input.context.queryBreakdown.runtime_tags.filter((tag) =>
    runtimeTags.includes(tag),
  );
  const penalties: string[] = [];
  const requiredFamilies = input.context.legalQueryPlan.required_law_families;
  const neighboringFamilies = getNeighboringFamilies(requiredFamilies);
  let retrievalScore = input.lexicalScore;

  retrievalScore += anchorMatches.length * 6;
  retrievalScore += familyMatches.length * 4;
  retrievalScore += queryTagOverlap.length * 5;

  if (requiredFamilies.includes(lawFamily)) {
    if (
      lawFamily === "department_specific" &&
      input.context.legalQueryPlan.question_scope === "general_question" &&
      !input.context.queryBreakdown.runtime_tags.includes("special_service_scope")
    ) {
      retrievalScore += 0;
    } else if (lawFamily === "administrative_code" || lawFamily === "advocacy_law") {
      retrievalScore += 9;
    } else if (lawFamily === "procedural_code") {
      retrievalScore += 5;
    } else {
      retrievalScore += 3;
    }
  } else if (neighboringFamilies.includes(lawFamily)) {
    retrievalScore += 2;
  } else if (requiredFamilies.length > 0) {
    retrievalScore -= 3;
    penalties.push("law_family_mismatch");
  }

  if (
    lawFamily === "administrative_code" &&
    input.context.queryBreakdown.runtime_tags.includes("material_offense")
  ) {
    retrievalScore += runtimeTags.includes("material_offense") ? 14 : 8;

    if (requiredFamilies.includes("procedural_code")) {
      retrievalScore += 10;
    }
  }

  if (lawFamily === "advocacy_law" && input.context.queryBreakdown.runtime_tags.includes("attorney")) {
    retrievalScore += 6;
  }

  if (
    lawFamily === "procedural_code" &&
    (requiredFamilies.includes("administrative_code") || requiredFamilies.includes("advocacy_law"))
  ) {
    retrievalScore -= input.context.queryBreakdown.runtime_tags.includes("material_offense") ? 4 : 2;

    if (
      input.context.queryBreakdown.runtime_tags.includes("material_offense") &&
      !runtimeTags.includes("material_offense")
    ) {
      retrievalScore -= 3;
    }
  }

  if (lawFamily === "government_code" || lawFamily === "ethics_code" || lawFamily === "criminal_code") {
    if (!queryTagOverlap.includes("official_duty") && !queryTagOverlap.includes("attorney_request")) {
      retrievalScore -= 1;
    }
  }

  if (
    input.context.legalQueryPlan.question_scope === "general_question" &&
    runtimeTags.includes("special_service_scope") &&
    !input.context.queryBreakdown.runtime_tags.includes("special_service_scope")
  ) {
    retrievalScore -= 12;
    penalties.push("department_specific_for_general_question");
  }

  if (
    runtimeTags.includes("public_assembly") &&
    !input.context.queryBreakdown.runtime_tags.includes("public_assembly")
  ) {
    retrievalScore -= 10;
    penalties.push("public_assembly_without_scope");
  }

  if (runtimeTags.includes("immunity") && !input.context.queryBreakdown.runtime_tags.includes("immunity")) {
    retrievalScore -= 10;
    penalties.push("immunity_without_scope");
  }

  const forbiddenMarkerMatches = input.context.legalQueryPlan.forbidden_scope_markers.filter((marker) =>
    normalizedCandidateText.includes(normalizeSearchText(marker)),
  );

  if (forbiddenMarkerMatches.length > 0 && anchorMatches.length === 0) {
    retrievalScore -= forbiddenMarkerMatches.length * 4;
    penalties.push("off_topic_scope");
  }

  if (normRole === "exception") {
    retrievalScore -= 3;
    penalties.push("exception_only_without_primary_basis_signal");
  }

  return {
    block: input.block,
    law_family_guess: lawFamily,
    norm_role_guess: normRole,
    runtime_tags: runtimeTags,
    lexical_score: input.lexicalScore,
    retrieval_score: retrievalScore,
    filter_reasons: penalties,
    source_channel: input.citationMetadata?.source_channel ?? "semantic",
    explicit_citation_raw: input.citationMetadata?.explicit_citation_raw ?? null,
    citation_resolution_status: input.citationMetadata?.citation_resolution_status ?? null,
    citation_resolution_reason: input.citationMetadata?.citation_resolution_reason ?? null,
    citation_match_strength: input.citationMetadata?.citation_match_strength ?? null,
    result: {
      score: retrievalScore,
      serverId: candidate.serverId,
      lawId: candidate.lawId,
      lawKey: candidate.lawKey,
      lawTitle: candidate.lawTitle,
      lawVersionId: candidate.lawVersionId,
      lawVersionStatus: input.block.lawVersion.status,
      lawBlockId: candidate.lawBlockId,
      blockType: input.block.blockType,
      blockOrder: input.block.blockOrder,
      articleNumberNormalized: candidate.articleNumberNormalized ?? null,
      snippet: buildSnippet(candidate.blockText, input.lexicalQueryTokens),
      blockText: candidate.blockText,
      sourceTopicUrl: candidate.sourceTopicUrl,
      sourcePosts: input.block.lawVersion.sourcePosts.map((sourcePost) => ({
        postExternalId: sourcePost.postExternalId,
        postUrl: sourcePost.postUrl,
        postOrder: sourcePost.postOrder,
      })),
      metadata: {
        sourceSnapshotHash: input.block.lawVersion.sourceSnapshotHash,
        normalizedTextHash: input.block.lawVersion.normalizedTextHash,
        corpusSnapshotHash: input.corpusSnapshotHash,
        ...(input.citationMetadata ? { citation: input.citationMetadata } : {}),
      },
    },
  } satisfies ScoredLawCandidate;
}

function buildCitationResolutionDebugEntry(
  citation: LegalQueryPlan["explicitLegalCitations"][number],
  report: LegalCitationResolutionReport,
) {
  return {
    raw_citation: citation.raw,
    law_family: report.lawFamily,
    article_number: citation.articleNumber,
    part_number: citation.partNumber,
    point_number: citation.pointNumber,
    resolution_status: report.resolutionStatus,
    resolution_reason: report.resolutionReason,
    resolved_block_id: report.resolvedBlockId,
    resolved_law_source_id: report.resolvedLawSourceId,
    matched_law_title: report.matchedLawTitle,
    matched_block_title: report.matchedBlockTitle,
    collision_candidates_count: report.collisionCandidates.length,
    same_law_companion_candidates_count: report.sameLawCompanionCandidates.length,
    note_exception_comment_hits_count: report.noteExceptionCommentHits.length,
    cross_reference_hits_count: report.crossReferenceHits.length,
  };
}

function buildCitationMatchStrength(input: {
  report: LegalCitationResolutionReport;
  sourceChannel: CitationSourceChannel;
}): CitationMatchStrength {
  if (input.sourceChannel === "citation_companion") {
    return "same_law_companion";
  }

  if (input.report.resolutionStatus === "partially_supported") {
    return "article_with_gap";
  }

  if (input.report.partSupport.requestedPart || input.report.pointSupport.requestedPoint) {
    return "exact_article_supported_subunit";
  }

  return "exact_article";
}

function buildCitationMetadata(input: {
  sourceChannel: CitationSourceChannel;
  citationRaw: string;
  report: LegalCitationResolutionReport;
}): LawSearchResultCitationMetadata {
  return {
    source_channel: input.sourceChannel,
    explicit_citation_raw: input.citationRaw,
    citation_resolution_status: input.report.resolutionStatus,
    citation_resolution_reason: input.report.resolutionReason,
    citation_match_strength: buildCitationMatchStrength({
      report: input.report,
      sourceChannel: input.sourceChannel,
    }),
  };
}

function dedupeScoredCandidatesByBlockId(candidates: ScoredLawCandidate[]) {
  const seen = new Set<string>();

  return candidates.filter((candidate) => {
    if (seen.has(candidate.result.lawBlockId)) {
      return false;
    }

    seen.add(candidate.result.lawBlockId);
    return true;
  });
}

function buildCitationDrivenCandidates(input: {
  reports: Array<{
    citation: LegalQueryPlan["explicitLegalCitations"][number];
    report: LegalCitationResolutionReport;
  }>;
  candidateBlocks: CurrentLawBlock[];
  lexicalScoreByBlockId: Map<string, number>;
  context: LawRetrievalContext;
  corpusSnapshotHash: string;
  lexicalQueryTokens: string[];
  serverId: string;
}) {
  const blockById = new Map(input.candidateBlocks.map((block) => [block.id, block]));
  const citationTargets: ScoredLawCandidate[] = [];
  const citationCompanions: ScoredLawCandidate[] = [];

  const buildCandidateFromBlock = (params: {
    block: CurrentLawBlock;
    citationRaw: string;
    report: LegalCitationResolutionReport;
    sourceChannel: CitationSourceChannel;
  }): ScoredLawCandidate | null =>
    buildScoredCandidate({
      block: params.block,
      lexicalScore: input.lexicalScoreByBlockId.get(params.block.id) ?? 1,
      context: input.context,
      corpusSnapshotHash: input.corpusSnapshotHash,
      lexicalQueryTokens: input.lexicalQueryTokens,
      serverId: input.serverId,
      citationMetadata: buildCitationMetadata({
        sourceChannel: params.sourceChannel,
        citationRaw: params.citationRaw,
        report: params.report,
      }),
    });

  for (const entry of input.reports) {
    if (
      entry.report.resolutionStatus !== "resolved" &&
      entry.report.resolutionStatus !== "partially_supported"
    ) {
      continue;
    }

    if (entry.report.resolvedBlockId) {
      const targetBlock = blockById.get(entry.report.resolvedBlockId);
      const targetCandidate =
        targetBlock &&
        buildCandidateFromBlock({
          block: targetBlock,
          citationRaw: entry.citation.raw,
          report: entry.report,
          sourceChannel: "citation_target",
        });

      if (targetCandidate) {
        citationTargets.push(targetCandidate);
      }
    }

    for (const companion of entry.report.sameLawCompanionCandidates) {
      const companionBlock = blockById.get(companion.lawBlockId);
      const companionCandidate =
        companionBlock &&
        buildCandidateFromBlock({
          block: companionBlock,
          citationRaw: entry.citation.raw,
          report: entry.report,
          sourceChannel: "citation_companion",
        });

      if (companionCandidate) {
        citationCompanions.push(companionCandidate);
      }
    }
  }

  return {
    citationTargets: dedupeScoredCandidatesByBlockId(citationTargets),
    citationCompanions: dedupeScoredCandidatesByBlockId(citationCompanions),
  };
}

function sortScoredCandidates(candidates: ScoredLawCandidate[]) {
  return [...candidates].sort((left, right) => {
    if (right.retrieval_score !== left.retrieval_score) {
      return right.retrieval_score - left.retrieval_score;
    }

    const blockTypeDelta = getBlockTypePriority(left.result.blockType) - getBlockTypePriority(right.result.blockType);

    if (blockTypeDelta !== 0) {
      return blockTypeDelta;
    }

    return left.result.blockOrder - right.result.blockOrder;
  });
}

function applyArticlePreference(candidates: ScoredLawCandidate[]) {
  const articleResults = candidates.filter((candidate) => candidate.result.blockType === "article");

  return articleResults.length > 0 ? articleResults : candidates;
}

function applyArticlePreferenceToLexicalResults(
  candidates: Array<{ block: CurrentLawBlock; lexicalScore: number }>,
) {
  const articleResults = candidates.filter((candidate) => candidate.block.blockType === "article");

  return articleResults.length > 0 ? articleResults : candidates;
}

function filterStrictCandidates(input: {
  candidates: ScoredLawCandidate[];
  context: LawRetrievalContext;
}) {
  const requiredFamilies = input.context.legalQueryPlan.required_law_families;
  const hasRequiredFamilyCandidate =
    requiredFamilies.length > 0 &&
    input.candidates.some((candidate) => requiredFamilies.includes(candidate.law_family_guess));

  return input.candidates.filter((candidate) => {
    if (candidate.filter_reasons.includes("off_topic_scope")) {
      return false;
    }

    if (candidate.filter_reasons.includes("public_assembly_without_scope")) {
      return false;
    }

    if (candidate.filter_reasons.includes("immunity_without_scope")) {
      return false;
    }

    if (
      hasRequiredFamilyCandidate &&
      candidate.filter_reasons.includes("law_family_mismatch") &&
      !candidate.filter_reasons.includes("department_specific_for_general_question")
    ) {
      return false;
    }

    if (
      candidate.filter_reasons.includes("department_specific_for_general_question") &&
      !input.context.queryBreakdown.runtime_tags.includes("special_service_scope")
    ) {
      return false;
    }

    return true;
  });
}

function filterRelaxedCandidates(input: {
  candidates: ScoredLawCandidate[];
  context: LawRetrievalContext;
}) {
  return input.candidates.filter((candidate) => {
    if (candidate.filter_reasons.includes("off_topic_scope")) {
      return false;
    }

    if (
      candidate.filter_reasons.includes("public_assembly_without_scope") &&
      !input.context.queryBreakdown.runtime_tags.includes("public_assembly")
    ) {
      return false;
    }

    if (
      candidate.filter_reasons.includes("immunity_without_scope") &&
      !input.context.queryBreakdown.runtime_tags.includes("immunity")
    ) {
      return false;
    }

    return true;
  });
}

async function runCurrentLawCorpusSearch(
  input: {
    serverId: string;
    query: string;
    limit?: number;
    includeSupplements?: boolean;
    retrievalContext?: LawRetrievalContext | null;
  },
  dependencies: RetrievalDependencies,
): Promise<LawRetrievalResult> {
  const parsed = searchCurrentLawCorpusInputSchema.parse(input);
  const lexicalQuery = buildLexicalQueryText({
    query: parsed.query,
    context: input.retrievalContext,
  });
  const lexicalQueryTokens = tokenizeText(lexicalQuery);
  const candidateBlocks = await dependencies.listCurrentLawBlocksByServer({
    serverId: parsed.serverId,
    includeSupplements: parsed.includeSupplements,
  });
  const generatedAt = dependencies.now();
  const corpusSnapshot = buildCorpusSnapshotMetadata(candidateBlocks, parsed.serverId, generatedAt);
  const lexicalResults = candidateBlocks
    .map((block) => {
      const law = block.lawVersion.currentForLaw;

      if (!law) {
        return null;
      }

      const lexicalScore = scoreLawBlock(
        {
          blockType: block.blockType,
          blockTitle: block.blockTitle,
          blockText: block.blockText,
          articleNumberNormalized: block.articleNumberNormalized,
          lawTitle: law.title,
        },
        lexicalQuery,
        lexicalQueryTokens,
      );
      const contextSeedScore = buildContextSeedScore({
        block,
        context: input.retrievalContext,
      });
      const seededLexicalScore = lexicalScore + contextSeedScore;

      if (seededLexicalScore <= 0) {
        return null;
      }

      return {
        block,
        lexicalScore: seededLexicalScore,
      };
    })
    .filter((entry): entry is { block: CurrentLawBlock; lexicalScore: number } => Boolean(entry))
    .sort((left, right) => {
      if (right.lexicalScore !== left.lexicalScore) {
        return right.lexicalScore - left.lexicalScore;
      }

      const blockTypeDelta =
        getBlockTypePriority(left.block.blockType) - getBlockTypePriority(right.block.blockType);

      if (blockTypeDelta !== 0) {
        return blockTypeDelta;
      }

      return left.block.blockOrder - right.block.blockOrder;
    });
  const articlePreferredLexicalResults = applyArticlePreferenceToLexicalResults(lexicalResults);
  const lexicalScoreByBlockId = new Map(
    lexicalResults.map((entry) => [entry.block.id, entry.lexicalScore] as const),
  );
  const overfetchLimit = Math.max(parsed.limit * 3, MIN_OVERFETCH_LIMIT);
  const lexicalPool = articlePreferredLexicalResults.slice(0, overfetchLimit);

  if (!input.retrievalContext) {
    const selectedResults = lexicalPool.slice(0, parsed.limit).map((entry) => {
      const law = entry.block.lawVersion.currentForLaw!;

      return {
        score: entry.lexicalScore,
        serverId: parsed.serverId,
        lawId: law.id,
        lawKey: law.lawKey,
        lawTitle: law.title,
        lawVersionId: entry.block.lawVersion.id,
        lawVersionStatus: entry.block.lawVersion.status,
        lawBlockId: entry.block.id,
        blockType: entry.block.blockType,
        blockOrder: entry.block.blockOrder,
        articleNumberNormalized: entry.block.articleNumberNormalized,
        snippet: buildSnippet(entry.block.blockText, lexicalQueryTokens),
        blockText: entry.block.blockText,
        sourceTopicUrl: law.topicUrl,
        sourcePosts: entry.block.lawVersion.sourcePosts.map((sourcePost) => ({
          postExternalId: sourcePost.postExternalId,
          postUrl: sourcePost.postUrl,
          postOrder: sourcePost.postOrder,
        })),
        metadata: {
          sourceSnapshotHash: entry.block.lawVersion.sourceSnapshotHash,
          normalizedTextHash: entry.block.lawVersion.normalizedTextHash,
          corpusSnapshotHash: corpusSnapshot.corpusSnapshotHash,
        },
      };
    });

    return {
      query: parsed.query,
      serverId: parsed.serverId,
      resultCount: selectedResults.length,
      corpusSnapshot,
      results: selectedResults,
      retrievalDebug: null,
    };
  }

  const scoredCandidates = sortScoredCandidates(
    lexicalPool
      .map((entry) =>
        buildScoredCandidate({
          block: entry.block,
          lexicalScore: entry.lexicalScore,
          context: input.retrievalContext!,
          corpusSnapshotHash: corpusSnapshot.corpusSnapshotHash,
          lexicalQueryTokens,
          serverId: parsed.serverId,
        }),
      )
      .filter((entry): entry is ScoredLawCandidate => Boolean(entry)),
  );
  const explicitCitations = input.retrievalContext.legalQueryPlan.explicitLegalCitations;
  const resolverEntries =
    explicitCitations.length > 0
      ? buildLegalCitationResolverEntriesFromLawBlocks(candidateBlocks)
      : [];
  const citationResolutionReports =
    explicitCitations.length > 0
      ? explicitCitations.map((citation) => ({
          citation,
          report: resolveExplicitLegalCitation({
            citation,
            corpusEntries: resolverEntries,
          }),
        }))
      : [];
  const { citationTargets, citationCompanions } = buildCitationDrivenCandidates({
    reports: citationResolutionReports,
    candidateBlocks,
    lexicalScoreByBlockId,
    context: input.retrievalContext,
    corpusSnapshotHash: corpusSnapshot.corpusSnapshotHash,
    lexicalQueryTokens,
    serverId: parsed.serverId,
  });
  const candidatePoolBeforeFilters = dedupeScoredCandidatesByBlockId([
    ...citationTargets,
    ...citationCompanions,
    ...scoredCandidates,
  ]).map(buildCompactCandidate);
  const strictCandidates = sortScoredCandidates(
    applyArticlePreference(
      filterStrictCandidates({
        candidates: scoredCandidates,
        context: input.retrievalContext,
      }),
    ),
  );
  const relaxedCandidates = sortScoredCandidates(
    applyArticlePreference(
      filterRelaxedCandidates({
        candidates: scoredCandidates,
        context: input.retrievalContext,
      }),
    ),
  );
  const fallbackCandidates = sortScoredCandidates(applyArticlePreference(scoredCandidates));
  const finalLimit = Math.min(parsed.limit, MAX_ASSISTANT_FINAL_POOL);
  const strictHasRequiredFamily =
    input.retrievalContext.legalQueryPlan.required_law_families.length === 0 ||
    strictCandidates.some((candidate) =>
      input.retrievalContext!.legalQueryPlan.required_law_families.includes(
        candidate.law_family_guess,
      ),
    );
  const stageCandidates =
    strictCandidates.length > 0 && strictHasRequiredFamily
      ? strictCandidates
      : relaxedCandidates.length > 0
        ? relaxedCandidates
        : fallbackCandidates;
  const selectedCandidates = dedupeScoredCandidatesByBlockId([
    ...citationTargets,
    ...citationCompanions,
    ...stageCandidates,
  ]).slice(0, finalLimit);
  const selectedResults = selectedCandidates.map((candidate) => candidate.result);
  const citationResolution = citationResolutionReports.map(({ citation, report }) =>
    buildCitationResolutionDebugEntry(citation, report),
  );
  const citationUnresolvedCount = citationResolutionReports.filter(
    ({ report }) => report.resolutionStatus === "unresolved",
  ).length;
  const citationPartiallySupportedCount = citationResolutionReports.filter(
    ({ report }) => report.resolutionStatus === "partially_supported",
  ).length;

  return {
    query: parsed.query,
    serverId: parsed.serverId,
    resultCount: selectedResults.length,
    corpusSnapshot,
    results: selectedResults,
    retrievalDebug: {
      retrieval_query_base_terms: input.retrievalContext.queryBreakdown.base_terms,
      retrieval_query_anchor_terms: input.retrievalContext.queryBreakdown.anchor_terms,
      retrieval_query_family_terms: input.retrievalContext.queryBreakdown.family_terms,
      retrieval_runtime_tags: input.retrievalContext.queryBreakdown.runtime_tags,
      candidate_pool_before_filters: candidatePoolBeforeFilters,
      candidate_pool_after_filters: selectedCandidates.map(buildCompactCandidate),
      applied_biases: input.retrievalContext.queryBreakdown.applied_biases,
      filter_reasons: scoredCandidates
        .filter((candidate) => candidate.filter_reasons.length > 0)
        .map((candidate) => ({
          law_block_id: candidate.result.lawBlockId,
          reasons: candidate.filter_reasons,
        })),
      citation_resolution: citationResolution,
      citation_target_count: citationTargets.length,
      citation_companion_count: citationCompanions.length,
      citation_unresolved_count: citationUnresolvedCount,
      citation_partially_supported_count: citationPartiallySupportedCount,
      semantic_retrieval_allowed_as_companion_only: explicitCitations.length > 0,
    },
  };
}

export async function searchCurrentLawCorpus(
  input: {
    serverId: string;
    query: string;
    limit?: number;
    includeSupplements?: boolean;
  },
  dependencies: RetrievalDependencies = defaultDependencies,
): Promise<BaseLawCorpusSearchResult> {
  const result = await runCurrentLawCorpusSearch(
    {
      ...input,
      retrievalContext: null,
    },
    dependencies,
  );

  return {
    query: result.query,
    serverId: result.serverId,
    resultCount: result.resultCount,
    corpusSnapshot: result.corpusSnapshot,
    results: result.results,
  };
}

export async function searchCurrentLawCorpusWithContext(
  input: {
    serverId: string;
    query: string;
    limit?: number;
    includeSupplements?: boolean;
    retrievalContext: LawRetrievalContext;
  },
  dependencies: RetrievalDependencies = defaultDependencies,
): Promise<LawRetrievalResult> {
  return runCurrentLawCorpusSearch(input, dependencies);
}

export type {
  BaseLawCorpusSearchResult,
  LawRetrievalContext,
  LawRetrievalDebug,
  LawRetrievalResult,
  LawSearchResultItem,
};
