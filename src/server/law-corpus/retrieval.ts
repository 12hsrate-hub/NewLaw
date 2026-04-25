import { createHash } from "node:crypto";

import { listCurrentLawBlocksByServer } from "@/db/repositories/law.repository";
import type {
  AssistantRetrievalQueryBreakdown,
  AssistantRetrievalRuntimeTag,
} from "@/server/legal-core/assistant-retrieval-query";
import type { LegalQueryPlan } from "@/server/legal-core/legal-query-plan";
import {
  classifyLawFamily,
  classifyNormRole,
  type LawFamily,
  type LegalSelectionCandidate,
  type NormRole,
} from "@/server/legal-core/legal-selection";
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

function hasKeyword(source: string, keywords: string[]) {
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
    hasKeyword(normalizedSource, ["правонаруш", "запрещ", "штраф", "влеч"]) ||
    candidate.lawKey.includes("ak")
  ) {
    tags.add("material_offense");
  }

  if (hasKeyword(normalizedSource, ["задерж", "арест", "достав"])) {
    tags.add("detention");
  }

  if (hasKeyword(normalizedSource, ["тикет", "штраф", "квитанц"])) {
    tags.add("ticket");
  }

  if (hasKeyword(normalizedSource, ["идентификац", "личност"])) {
    tags.add("identity_check");
  }

  if (hasKeyword(normalizedSource, ["адвокат", "защитник", "адвокатур"])) {
    tags.add("attorney");
  }

  if (hasKeyword(normalizedSource, ["адвокатский запрос", "официальный адвокатский запрос"])) {
    tags.add("attorney_request");
  }

  if (hasKeyword(normalizedSource, ["bodycam", "body-cam", "бодикам", "видеофиксац", "видеозапис"])) {
    tags.add("bodycam");
  }

  if (hasKeyword(normalizedSource, ["доказ", "видео", "запис", "подтвержд"])) {
    tags.add("evidence");
  }

  if (
    lawFamily === "government_code" ||
    hasKeyword(normalizedSource, ["служебн обязан", "должностн лиц", "руководств", "обязан"])
  ) {
    tags.add("official_duty");
  }

  if (
    lawFamily === "department_specific" ||
    hasKeyword(normalizedSource, [
      "национальн гвард",
      "управлени тюрем",
      "департамент",
      "ведомств",
      "военнослужащ",
    ])
  ) {
    tags.add("special_service_scope");
  }

  if (lawFamily === "public_assembly_law" || hasKeyword(normalizedSource, ["митинг", "публичн меропр", "собрани"])) {
    tags.add("public_assembly");
  }

  if (lawFamily === "immunity_law" || hasKeyword(normalizedSource, ["иммунитет", "неприкоснов"])) {
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
  };
}

function buildScoredCandidate(input: {
  block: CurrentLawBlock;
  lexicalScore: number;
  context: LawRetrievalContext;
  corpusSnapshotHash: string;
  lexicalQueryTokens: string[];
  serverId: string;
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
      },
    },
  } satisfies ScoredLawCandidate;
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
  const candidatePoolBeforeFilters = scoredCandidates.map(buildCompactCandidate);
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
  const selectedCandidates = stageCandidates.slice(0, finalLimit);
  const selectedResults = selectedCandidates.map((candidate) => candidate.result);

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
