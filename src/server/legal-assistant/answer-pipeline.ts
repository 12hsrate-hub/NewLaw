import { createAIRequest } from "@/db/repositories/ai-request.repository";
import {
  type AssistantTypedRetrievalReference,
  searchAssistantCorpus,
} from "@/server/legal-assistant/retrieval";
import {
  type ProxyAttemptTrace,
  requestAssistantProxyCompletion,
} from "@/server/legal-assistant/ai-proxy";
import { buildAssistantRetrievalQuery } from "@/server/legal-core/assistant-retrieval-query";
import { buildLegalGroundingDiagnostics } from "@/server/legal-core/legal-diagnostics";
import { normalizeLegalInputText } from "@/server/legal-core/input-normalization";
import { buildLegalQueryPlan } from "@/server/legal-core/legal-query-plan";
import {
  selectStructuredLegalContext,
  type SelectedNormRole,
  type StructuredSelectionResult,
} from "@/server/legal-core/legal-selection";
import {
  type LegalCoreActorContext,
  type LegalCoreResponseMode,
  buildAssistantSelfAssessment,
  classifyAssistantIntent,
  detectQuestionResponseMode,
} from "@/server/legal-core/metadata";
import {
  buildAIStageUsageEntry,
  extractAIReviewerStageUsage,
  extractProxyUsageMetrics,
  LEGAL_ASSISTANT_PROMPT_VERSION,
  mergeAIStageUsageEntries,
} from "@/server/legal-core/observability";
import { attachDeterministicAIQualityReview } from "@/server/legal-core/quality-review";
import { buildAssistantFutureReviewMarker } from "@/server/legal-core/review-routing";

type RetrievalResult = Awaited<ReturnType<typeof searchAssistantCorpus>>;
type AssistantLawSelection = StructuredSelectionResult<RetrievalResult["lawRetrieval"]["results"][number]>;

type AnswerPipelineDependencies = {
  searchAssistantCorpus: typeof searchAssistantCorpus;
  requestAssistantProxyCompletion: typeof requestAssistantProxyCompletion;
  normalizeInputText?: typeof normalizeLegalInputText;
  createAIRequest: typeof createAIRequest;
  now: () => Date;
};

const defaultDependencies: AnswerPipelineDependencies = {
  searchAssistantCorpus,
  requestAssistantProxyCompletion,
  createAIRequest,
  now: () => new Date(),
};

export type AssistantAnswerSections = {
  summary: string;
  normativeAnalysis: string;
  precedentAnalysis: string;
  interpretation: string;
  sources?: string;
};

type AssistantUsedSourceManifest = {
  laws?: Array<{
    law_id: string;
    law_version: string;
    law_block_id?: string;
  }>;
  precedents?: Array<{
    precedent_id: string;
    precedent_version: string;
    precedent_block_id?: string;
  }>;
};

type AssistantTestRunContext = {
  run_kind: "internal_ai_legal_core_test";
  server_id: string;
  server_code: string;
  test_run_id: string;
  test_scenario_id: string;
  test_scenario_group: string;
  test_scenario_title: string;
  law_version_selection: "current_snapshot_only";
};

type AssistantInternalExecutionMode = "full_generation" | "core_only" | "compact_generation";
type AssistantAIPayloadProfile = "runtime_compact" | "internal_full";

const USED_SOURCES_MANIFEST_PATTERN = /<!--\s*used_sources_json:\s*([\s\S]*?)\s*-->/i;

function normalizeSectionText(input: string) {
  return input.trim().replace(/\n{3,}/g, "\n\n");
}

export function composeAssistantAnswerMarkdown(sections: AssistantAnswerSections) {
  return [
    "## Краткий вывод",
    normalizeSectionText(sections.summary),
    "",
    "## Что прямо следует из норм закона",
    normalizeSectionText(sections.normativeAnalysis),
    "",
    "## Что подтверждается судебными прецедентами",
    normalizeSectionText(sections.precedentAnalysis),
    "",
    "## Вывод / интерпретация",
    normalizeSectionText(sections.interpretation),
    "",
    "## Использованные нормы / источники",
    normalizeSectionText(
      sections.sources ??
        "Подтверждённые нормы, прецеденты и источники перечислены в grounded metadata ответа.",
    ),
  ].join("\n");
}

export function parseAssistantAnswerSections(content: string): AssistantAnswerSections {
  const normalizedContent = stripAssistantUsedSourcesManifest(content).trim();
  const sectionPattern =
    /##\s*(Краткий вывод|Что прямо следует из норм закона|Что прямо следует из норм|Что подтверждается судебными прецедентами|Вывод \/ интерпретация|Использованные нормы \/ источники)\s*([\s\S]*?)(?=##\s*(?:Краткий вывод|Что прямо следует из норм закона|Что прямо следует из норм|Что подтверждается судебными прецедентами|Вывод \/ интерпретация|Использованные нормы \/ источники)|$)/g;
  const sectionMap = new Map<string, string>();

  for (const match of normalizedContent.matchAll(sectionPattern)) {
    const title = match[1] === "Что прямо следует из норм" ? "Что прямо следует из норм закона" : match[1];
    sectionMap.set(title, match[2].trim());
  }

  if (sectionMap.size === 0) {
    return {
      summary: normalizedContent,
      normativeAnalysis:
        "Модель не вернула отдельную секцию по тому, что прямо следует из норм закона.",
      precedentAnalysis:
        "Модель не выделила отдельную секцию по судебным прецедентам. Нужна ручная перепроверка grounded references.",
      interpretation:
        "Модель не выделила интерпретацию отдельно. Нужна ручная перепроверка по использованным источникам.",
      sources: "Использованные нормы и источники нужно брать только из grounded metadata ответа.",
    };
  }

  return {
    summary: sectionMap.get("Краткий вывод") ?? "Краткий вывод модель не вернула отдельно.",
    normativeAnalysis:
      sectionMap.get("Что прямо следует из норм закона") ??
      "Модель не вернула отдельную секцию по нормам закона.",
    precedentAnalysis:
      sectionMap.get("Что подтверждается судебными прецедентами") ??
      "Релевантные подтверждённые судебные прецеденты не были выделены отдельной секцией.",
    interpretation:
      sectionMap.get("Вывод / интерпретация") ??
      "Модель не вернула отдельную секцию интерпретации.",
    sources:
      sectionMap.get("Использованные нормы / источники") ??
      "Использованные нормы и источники нужно брать только из grounded metadata ответа.",
  };
}

function stripAssistantUsedSourcesManifest(content: string) {
  return content.replace(USED_SOURCES_MANIFEST_PATTERN, "").trim();
}

const MAX_REFERENCE_SNIPPET_LENGTH = 280;
const MAX_ANSWER_PREVIEW_LENGTH = 280;
const MAX_QUESTION_PREVIEW_LENGTH = 220;

type AssistantGenerationBudget = {
  max_total_sources: number;
  max_excerpt_chars_per_source: number;
  max_total_context_chars: number;
  max_output_tokens: number | null;
};

type AssistantGenerationBudgetTrace = AssistantGenerationBudget & {
  response_mode: LegalCoreResponseMode;
  execution_mode: AssistantInternalExecutionMode;
};

type AssistantPromptLawContextEntry = RetrievalResult["lawRetrieval"]["results"][number] & {
  selected_role: SelectedNormRole | null;
  primary_basis_eligibility: string;
  primary_basis_eligibility_reason: string | null;
};

type AssistantPromptPrecedentContextEntry =
  RetrievalResult["precedentRetrieval"]["results"][number];

type AssistantGenerationContext = {
  law_sources: AssistantPromptLawContextEntry[];
  precedent_sources: AssistantPromptPrecedentContextEntry[];
  law_context_text: string;
  precedent_context_text: string;
  generation_source_budget: number;
  generation_sources_count: number;
  generation_excerpt_budget: number;
  generation_context_chars: number;
  generation_context_trimmed: boolean;
  answer_mode_effective_budget: AssistantGenerationBudgetTrace;
};

type GroundedLawReference = {
  sourceKind: "law";
  serverId: string;
  lawId: string;
  lawKey: string;
  lawTitle: string;
  lawVersionId: string;
  lawVersionStatus: string;
  lawBlockId: string;
  blockType: string;
  blockOrder: number;
  articleNumberNormalized?: string | null;
  snippet: string;
  sourceTopicUrl: string;
  sourcePosts: Array<{
    postExternalId: string;
    postUrl: string;
    postOrder: number;
  }>;
};

type GroundedPrecedentReference = {
  sourceKind: "precedent";
  serverId: string;
  precedentId: string;
  precedentKey: string;
  precedentTitle: string;
  precedentVersionId: string;
  precedentVersionStatus: string;
  precedentBlockId: string;
  blockType: string;
  blockOrder: number;
  validityStatus: string;
  snippet: string;
  sourceTopicUrl: string;
  sourceTopicTitle: string;
  sourcePosts: Array<{
    postExternalId: string;
    postUrl: string;
    postOrder: number;
  }>;
};

type AssistantSourceLedgerEntry = {
  server_id: string;
  law_id: string;
  law_name: string;
  article_number: string | null;
  part_number: string | null;
  law_version: string;
  source_topic_url: string;
};

type AssistantSourceLedger = {
  server_id: string;
  law_version_ids: string[];
  found_norms: AssistantSourceLedgerEntry[];
  context_norms: AssistantSourceLedgerEntry[];
  used_norms: AssistantSourceLedgerEntry[];
};

type AssistantLawVersionContract = {
  server_id: string;
  law_corpus_snapshot_hash: string;
  law_version_ids: string[];
  contract_mode: "current_snapshot_only";
  found_norms_outside_current_snapshot: string[];
  context_norms_outside_current_snapshot: string[];
  used_norms_outside_current_snapshot: string[];
  is_current_snapshot_consistent: boolean;
};

type AssistantUsedSource =
  | {
      source_kind: "law";
      server_id: string;
      law_id: string;
      law_name: string;
      law_version: string;
      article_number: string | null;
      source_topic_url: string;
    }
  | {
      source_kind: "precedent";
      server_id: string;
      precedent_id: string;
      precedent_name: string;
      precedent_version: string;
      validity_status: string;
      source_topic_url: string;
    };

type AssistantRunObservability = {
  latency_ms: number;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  cost_usd: number | null;
};

type AssistantReviewStatus = {
  queue_for_future_ai_quality_review: boolean;
  future_review_priority: "low" | "medium" | "high";
  future_review_flags: string[];
  future_review_reason_codes: string[];
};

type AssistantStageUsage = {
  normalization: ReturnType<typeof buildAIStageUsageEntry>;
  generation?: ReturnType<typeof buildAIStageUsageEntry>;
  review?: ReturnType<typeof buildAIStageUsageEntry>;
  retry?: ReturnType<typeof buildAIStageUsageEntry>;
};

type AssistantCompactCandidatePoolEntry = {
  law_title: string;
  article_number: string | null;
  law_family: string;
  norm_role: string | null;
  primary_basis_eligibility: string | null;
  retrieval_score: number | null;
  status: "preview";
  label: string;
};

type AssistantCompactSelectedCandidateDiagnostic = {
  law_id: string;
  law_title: string;
  law_version: string;
  law_block_id: string;
  article_number: string | null;
  law_family: string;
  norm_role: string;
  applicability_score: number;
  primary_basis_eligibility: string;
  primary_basis_eligibility_reason: string | null;
  ineligible_primary_basis_reasons: string[];
  weak_primary_basis_reasons: string[];
};

function parseAssistantUsedSourcesManifest(content: string): AssistantUsedSourceManifest | null {
  const match = content.match(USED_SOURCES_MANIFEST_PATTERN);

  if (!match?.[1]) {
    return null;
  }

  try {
    const parsed = JSON.parse(match[1]) as AssistantUsedSourceManifest;

    return {
      laws: Array.isArray(parsed.laws) ? parsed.laws : [],
      precedents: Array.isArray(parsed.precedents) ? parsed.precedents : [],
    };
  } catch {
    return null;
  }
}

function buildSourceLedgerEntry(
  result:
    | RetrievalResult["lawRetrieval"]["results"][number]
    | Extract<AssistantTypedRetrievalReference, { sourceKind: "law" }>,
): AssistantSourceLedgerEntry {
  return {
    server_id: result.serverId,
    law_id: result.lawId,
    law_name: result.lawTitle,
    article_number: result.articleNumberNormalized ?? null,
    part_number: null,
    law_version: result.lawVersionId,
    source_topic_url: result.sourceTopicUrl,
  };
}

function buildAssistantContextUsedSources(input: {
  lawContext: RetrievalResult["lawRetrieval"]["results"];
  precedentContext: RetrievalResult["precedentRetrieval"]["results"];
}): AssistantUsedSource[] {
  const lawSources = input.lawContext.map((result) => ({
      source_kind: "law" as const,
      server_id: result.serverId,
      law_id: result.lawId,
      law_name: result.lawTitle,
      law_version: result.lawVersionId,
      article_number: result.articleNumberNormalized ?? null,
      source_topic_url: result.sourceTopicUrl,
    }));
  const precedentSources = input.precedentContext.map((result) => ({
    source_kind: "precedent" as const,
    server_id: result.serverId,
    precedent_id: result.precedentId,
    precedent_name: result.precedentTitle,
    precedent_version: result.precedentVersionId,
    validity_status: result.validityStatus,
    source_topic_url: result.sourceTopicUrl,
  }));

  return [...lawSources, ...precedentSources];
}

function buildAssistantSourceLedger(
  retrieval: RetrievalResult,
  lawContext: RetrievalResult["lawRetrieval"]["results"],
) {
  const foundNorms = retrieval.lawRetrieval.results.map(buildSourceLedgerEntry);
  const contextNorms = lawContext.map(buildSourceLedgerEntry);
  const lawVersionIds = Array.from(new Set(foundNorms.map((entry) => entry.law_version)));

  return {
    server_id: retrieval.serverId,
    law_version_ids: lawVersionIds,
    found_norms: foundNorms,
    context_norms: contextNorms,
    used_norms: [],
  } satisfies AssistantSourceLedger;
}

function buildAssistantSourceLedgerWithUsedNorms(
  sourceLedger: AssistantSourceLedger,
  usedNorms: AssistantSourceLedgerEntry[],
) {
  return {
    ...sourceLedger,
    used_norms: usedNorms,
  } satisfies AssistantSourceLedger;
}

function normalizeAssistantMatchText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isNormMentionedInAssistantSourcesSection(
  entry: AssistantSourceLedgerEntry,
  sourcesSection: string,
) {
  const normalizedSources = normalizeAssistantMatchText(sourcesSection);
  const normalizedLawName = normalizeAssistantMatchText(entry.law_name);

  if (normalizedLawName.length > 0 && normalizedSources.includes(normalizedLawName)) {
    return true;
  }

  if (!entry.article_number) {
    return false;
  }

  const escapedArticleNumber = escapeRegExp(entry.article_number);
  const articlePatterns = [
    new RegExp(`статья\\s+${escapedArticleNumber}`, "i"),
    new RegExp(`ст\\.\\s*${escapedArticleNumber}`, "i"),
    new RegExp(`статьи\\s+${escapedArticleNumber}`, "i"),
  ];

  return articlePatterns.some((pattern) => pattern.test(sourcesSection));
}

function inferAssistantUsedNorms(input: {
  sourceLedger: AssistantSourceLedger;
  sections: AssistantAnswerSections;
  manifest?: AssistantUsedSourceManifest | null;
}) {
  const manifestLaws = new Set(
    (input.manifest?.laws ?? []).map((entry) => `${entry.law_id}:${entry.law_version}`),
  );

  return input.sourceLedger.context_norms.filter((entry) =>
    manifestLaws.has(`${entry.law_id}:${entry.law_version}`) ||
    isNormMentionedInAssistantSourcesSection(entry, input.sections.sources ?? ""),
  );
}

function normalizeAssistantComparableText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isAssistantLawUsedInSections(
  result: RetrievalResult["lawRetrieval"]["results"][number],
  sections: AssistantAnswerSections,
) {
  const searchableText = normalizeAssistantComparableText(
    [sections.normativeAnalysis, sections.interpretation, sections.sources ?? ""].join("\n"),
  );

  if (searchableText.length === 0) {
    return false;
  }

  const titleMatch =
    normalizeAssistantComparableText(result.lawTitle).length > 0 &&
    searchableText.includes(normalizeAssistantComparableText(result.lawTitle));
  const articleMatch =
    typeof result.articleNumberNormalized === "string" &&
    result.articleNumberNormalized.trim().length > 0 &&
    new RegExp(`(?:статья|статьи|ст)\\s*\\.?\\s*${escapeRegExp(result.articleNumberNormalized)}`, "i").test(
      [sections.normativeAnalysis, sections.interpretation, sections.sources ?? ""].join("\n"),
    );

  return titleMatch || articleMatch;
}

function isAssistantPrecedentUsedInSections(
  result: RetrievalResult["precedentRetrieval"]["results"][number],
  sections: AssistantAnswerSections,
) {
  const searchableText = normalizeAssistantComparableText(
    [sections.precedentAnalysis, sections.interpretation, sections.sources ?? ""].join("\n"),
  );

  if (searchableText.length === 0) {
    return false;
  }

  const title = normalizeAssistantComparableText(result.precedentTitle);

  if (title.length > 0 && searchableText.includes(title)) {
    return true;
  }

  const snippetWords = normalizeAssistantComparableText(result.snippet)
    .split(" ")
    .filter((word) => word.length >= 6)
    .slice(0, 4);

  return snippetWords.some((word) => searchableText.includes(word));
}

function inferAssistantUsedSources(input: {
  retrieval: RetrievalResult;
  lawContext: RetrievalResult["lawRetrieval"]["results"];
  precedentContext: RetrievalResult["precedentRetrieval"]["results"];
  sections: AssistantAnswerSections;
  manifest?: AssistantUsedSourceManifest | null;
}) {
  const manifestLawIds = new Set(
    (input.manifest?.laws ?? []).map((entry) => `${entry.law_id}:${entry.law_version}`),
  );
  const manifestPrecedentIds = new Set(
    (input.manifest?.precedents ?? []).map(
      (entry) => `${entry.precedent_id}:${entry.precedent_version}`,
    ),
  );
  const contextSources = buildAssistantContextUsedSources({
    lawContext: input.lawContext,
    precedentContext: input.precedentContext,
  });

  return contextSources.filter((source) => {
    if (source.source_kind === "law") {
      if (manifestLawIds.has(`${source.law_id}:${source.law_version}`)) {
        return true;
      }

      const retrievalResult = input.retrieval.lawRetrieval.results.find(
        (result) =>
          result.lawId === source.law_id && result.lawVersionId === source.law_version,
      );

      return retrievalResult ? isAssistantLawUsedInSections(retrievalResult, input.sections) : false;
    }

    if (manifestPrecedentIds.has(`${source.precedent_id}:${source.precedent_version}`)) {
      return true;
    }

    const retrievalResult = input.retrieval.precedentRetrieval.results.find(
      (result) =>
        result.precedentId === source.precedent_id &&
        result.precedentVersionId === source.precedent_version,
    );

    return retrievalResult
      ? isAssistantPrecedentUsedInSections(retrievalResult, input.sections)
      : false;
  });
}

function collectOutsideSnapshotLawVersionIds(input: {
  entries: AssistantSourceLedgerEntry[];
  currentLawVersionIds: string[];
}) {
  const currentLawVersionIdSet = new Set(input.currentLawVersionIds);

  return Array.from(
    new Set(
      input.entries
        .map((entry) => entry.law_version)
        .filter((lawVersion) => !currentLawVersionIdSet.has(lawVersion)),
    ),
  );
}

function buildAssistantLawVersionContract(input: {
  retrieval: RetrievalResult;
  sourceLedger: AssistantSourceLedger;
}) {
  const foundOutside = collectOutsideSnapshotLawVersionIds({
    entries: input.sourceLedger.found_norms,
    currentLawVersionIds: input.retrieval.combinedRetrievalRevision.lawCurrentVersionIds,
  });
  const contextOutside = collectOutsideSnapshotLawVersionIds({
    entries: input.sourceLedger.context_norms,
    currentLawVersionIds: input.retrieval.combinedRetrievalRevision.lawCurrentVersionIds,
  });
  const usedOutside = collectOutsideSnapshotLawVersionIds({
    entries: input.sourceLedger.used_norms,
    currentLawVersionIds: input.retrieval.combinedRetrievalRevision.lawCurrentVersionIds,
  });

  return {
    server_id: input.retrieval.serverId,
    law_corpus_snapshot_hash: input.retrieval.lawCorpusSnapshot.corpusSnapshotHash,
    law_version_ids: input.retrieval.combinedRetrievalRevision.lawCurrentVersionIds,
    contract_mode: "current_snapshot_only" as const,
    found_norms_outside_current_snapshot: foundOutside,
    context_norms_outside_current_snapshot: contextOutside,
    used_norms_outside_current_snapshot: usedOutside,
    is_current_snapshot_consistent:
      foundOutside.length === 0 && contextOutside.length === 0 && usedOutside.length === 0,
  } satisfies AssistantLawVersionContract;
}

function buildGroundedReferences(retrieval: RetrievalResult) {
  return retrieval.results.map((result) => {
    if (result.sourceKind === "law") {
      return {
        sourceKind: "law",
        serverId: result.serverId,
        lawId: result.lawId,
        lawKey: result.lawKey,
        lawTitle: result.lawTitle,
        lawVersionId: result.lawVersionId,
        lawVersionStatus: result.lawVersionStatus,
        lawBlockId: result.lawBlockId,
        blockType: result.blockType,
        blockOrder: result.blockOrder,
        articleNumberNormalized: result.articleNumberNormalized,
        snippet: result.snippet.slice(0, MAX_REFERENCE_SNIPPET_LENGTH),
        sourceTopicUrl: result.sourceTopicUrl,
        sourcePosts: result.sourcePosts,
      } satisfies GroundedLawReference;
    }

    return {
      sourceKind: "precedent",
      serverId: result.serverId,
      precedentId: result.precedentId,
      precedentKey: result.precedentKey,
      precedentTitle: result.precedentTitle,
      precedentVersionId: result.precedentVersionId,
      precedentVersionStatus: result.precedentVersionStatus,
      precedentBlockId: result.precedentBlockId,
      blockType: result.blockType,
      blockOrder: result.blockOrder,
      validityStatus: result.validityStatus,
      snippet: result.snippet.slice(0, MAX_REFERENCE_SNIPPET_LENGTH),
      sourceTopicUrl: result.sourceTopicUrl,
      sourceTopicTitle: result.sourceTopicTitle,
      sourcePosts: result.sourcePosts,
    } satisfies GroundedPrecedentReference;
  });
}

function buildLawsUsed(
  retrieval: RetrievalResult,
  lawContext: RetrievalResult["lawRetrieval"]["results"] = retrieval.lawRetrieval.results,
) {
  return Array.from(
    new Map(
      lawContext.map((result) => [
        `${result.lawId}:${result.lawVersionId}`,
        {
          lawId: result.lawId,
          lawKey: result.lawKey,
          lawTitle: result.lawTitle,
          lawVersionId: result.lawVersionId,
          lawBlockIds: [] as string[],
          articleNumbers: [] as string[],
          sourceTopicUrl: result.sourceTopicUrl,
        },
      ]),
    ).values(),
  ).map((entry) => {
    const matchingResults = lawContext.filter(
      (result) => result.lawId === entry.lawId && result.lawVersionId === entry.lawVersionId,
    );

    return {
      ...entry,
      lawBlockIds: matchingResults.map((result) => result.lawBlockId),
      articleNumbers: matchingResults
        .map((result) => result.articleNumberNormalized)
        .filter((value): value is string => Boolean(value)),
    };
  });
}

function buildPrecedentsUsed(retrieval: RetrievalResult) {
  return Array.from(
    new Map(
      retrieval.precedentRetrieval.results.map((result) => [
        `${result.precedentId}:${result.precedentVersionId}`,
        {
          precedentId: result.precedentId,
          precedentKey: result.precedentKey,
          precedentTitle: result.precedentTitle,
          precedentVersionId: result.precedentVersionId,
          precedentBlockIds: [] as string[],
          validityStatus: result.validityStatus,
          sourceTopicUrl: result.sourceTopicUrl,
          sourcePostIds: [] as string[],
        },
      ]),
    ).values(),
  ).map((entry) => {
    const matchingResults = retrieval.precedentRetrieval.results.filter(
      (result) =>
        result.precedentId === entry.precedentId &&
        result.precedentVersionId === entry.precedentVersionId,
    );

    return {
      ...entry,
      precedentBlockIds: matchingResults.map((result) => result.precedentBlockId),
      sourcePostIds: Array.from(
        new Set(
          matchingResults.flatMap((result) => result.sourcePosts.map((sourcePost) => sourcePost.postExternalId)),
        ),
      ),
    };
  });
}

function selectPromptContextResults(
  results: AssistantTypedRetrievalReference[],
  sourceKind: "law" | "precedent",
  limit: number,
) {
  const filteredResults = results.filter((result) => result.sourceKind === sourceKind);

  return [...filteredResults]
    .sort((left, right) => {
      return left.blockOrder - right.blockOrder;
    })
    .slice(0, limit);
}

function getAssistantGenerationBudget(input: {
  responseMode: LegalCoreResponseMode;
  internalExecutionMode: AssistantInternalExecutionMode;
}): AssistantGenerationBudgetTrace {
  if (input.internalExecutionMode === "compact_generation") {
    return {
      response_mode: input.responseMode,
      execution_mode: input.internalExecutionMode,
      max_total_sources: 3,
      max_excerpt_chars_per_source: 420,
      max_total_context_chars: 1400,
      max_output_tokens: 320,
    };
  }

  switch (input.responseMode) {
    case "short":
      return {
        response_mode: input.responseMode,
        execution_mode: input.internalExecutionMode,
        max_total_sources: 2,
        max_excerpt_chars_per_source: 450,
        max_total_context_chars: 1200,
        max_output_tokens: 320,
      };
    case "detailed":
      return {
        response_mode: input.responseMode,
        execution_mode: input.internalExecutionMode,
        max_total_sources: 6,
        max_excerpt_chars_per_source: 900,
        max_total_context_chars: 4200,
        max_output_tokens: 900,
      };
    case "document_ready":
      return {
        response_mode: input.responseMode,
        execution_mode: input.internalExecutionMode,
        max_total_sources: 4,
        max_excerpt_chars_per_source: 700,
        max_total_context_chars: 2600,
        max_output_tokens: 420,
      };
    default:
      return {
        response_mode: input.responseMode,
        execution_mode: input.internalExecutionMode,
        max_total_sources: 4,
        max_excerpt_chars_per_source: 650,
        max_total_context_chars: 2400,
        max_output_tokens: 520,
      };
  }
}

function clampAssistantPromptExcerpt(value: string, limit: number) {
  const normalized = normalizeSectionText(value);

  if (normalized.length <= limit) {
    return {
      text: normalized,
      trimmed: false,
    };
  }

  const safeLimit = Math.max(1, limit - 1);

  return {
    text: `${normalized.slice(0, safeLimit).trimEnd()}…`,
    trimmed: true,
  };
}

function shouldIncludePrecedentsInGenerationContext(input: {
  responseMode: LegalCoreResponseMode;
  retrieval: RetrievalResult;
  lawSelection: AssistantLawSelection;
}) {
  if (input.retrieval.precedentRetrieval.results.length === 0) {
    return false;
  }

  if (input.lawSelection.selected_norms.length === 0) {
    return true;
  }

  if (input.responseMode === "detailed") {
    return true;
  }

  return input.lawSelection.direct_basis_status !== "direct_basis_present";
}

function buildAssistantGenerationContext(input: {
  retrieval: RetrievalResult;
  lawSelection: AssistantLawSelection;
  responseMode: LegalCoreResponseMode;
  internalExecutionMode: AssistantInternalExecutionMode;
}) {
  const budget = getAssistantGenerationBudget({
    responseMode: input.responseMode,
    internalExecutionMode: input.internalExecutionMode,
  });
  const selectedRoleMap = new Map(
    input.lawSelection.selected_norm_roles.map((entry) => [entry.law_block_id, entry]),
  );
  const scoredCandidateMap = new Map(
    input.lawSelection.scored_candidates.map((entry) => [entry.candidate.lawBlockId, entry]),
  );
  const availableLawSources = input.lawSelection.selected_norms.map((candidate) => {
    const selectedRole = selectedRoleMap.get(candidate.lawBlockId) ?? null;
    const scoredCandidate = scoredCandidateMap.get(candidate.lawBlockId);

    return {
      ...candidate,
      selected_role: selectedRole,
      primary_basis_eligibility:
        scoredCandidate?.primary_basis_eligibility ?? "ineligible",
      primary_basis_eligibility_reason:
        scoredCandidate?.primary_basis_eligibility_reason ?? null,
    } satisfies AssistantPromptLawContextEntry;
  });
  const lawSources = availableLawSources.slice(0, budget.max_total_sources);
  const remainingSourceBudget = Math.max(0, budget.max_total_sources - lawSources.length);
  const availablePrecedentSources = shouldIncludePrecedentsInGenerationContext({
    responseMode: input.responseMode,
    retrieval: input.retrieval,
    lawSelection: input.lawSelection,
  })
    ? selectPromptContextResults(
        input.retrieval.results,
        "precedent",
        remainingSourceBudget,
      ).filter(
        (
          result,
        ): result is Extract<AssistantTypedRetrievalReference, { sourceKind: "precedent" }> =>
          result.sourceKind === "precedent",
      )
    : [];
  let remainingContextChars = budget.max_total_context_chars;
  let generationContextChars = 0;
  let generationContextTrimmed = availableLawSources.length > lawSources.length;
  const lawContextParts: string[] = [];
  const includedLawSources: AssistantPromptLawContextEntry[] = [];

  for (const [index, result] of lawSources.entries()) {
    if (remainingContextChars <= 0) {
      generationContextTrimmed = true;
      break;
    }

    const excerptBudget = Math.min(
      budget.max_excerpt_chars_per_source,
      remainingContextChars,
    );
    const excerpt = clampAssistantPromptExcerpt(result.blockText, excerptBudget);
    remainingContextChars -= excerpt.text.length;
    generationContextChars += excerpt.text.length;
    generationContextTrimmed = generationContextTrimmed || excerpt.trimmed;
    includedLawSources.push(result);
    lawContextParts.push(
      [
        `Law source ${index + 1}`,
        `- title: ${result.lawTitle}`,
        `- article_number: ${result.articleNumberNormalized ?? "n/a"}`,
        `- part_number: n/a`,
        `- law_family: ${result.selected_role?.law_family ?? "other"}`,
        `- norm_role: ${result.selected_role?.norm_role ?? "background_only"}`,
        `- primary_basis_eligibility: ${result.primary_basis_eligibility}`,
        `- text: ${excerpt.text}`,
      ].join("\n"),
    );
  }

  const precedentContextParts: string[] = [];
  const includedPrecedentSources: AssistantPromptPrecedentContextEntry[] = [];

  for (const [index, result] of availablePrecedentSources.entries()) {
    if (remainingContextChars <= 0) {
      generationContextTrimmed = true;
      break;
    }

    const excerptBudget = Math.min(
      budget.max_excerpt_chars_per_source,
      remainingContextChars,
    );
    const excerpt = clampAssistantPromptExcerpt(result.blockText, excerptBudget);
    remainingContextChars -= excerpt.text.length;
    generationContextChars += excerpt.text.length;
    generationContextTrimmed = generationContextTrimmed || excerpt.trimmed;
    includedPrecedentSources.push(result);
    precedentContextParts.push(
      [
        `Precedent source ${index + 1}`,
        `- title: ${result.precedentTitle}`,
        `- validity_status: ${result.validityStatus}`,
        `- text: ${excerpt.text}`,
      ].join("\n"),
    );
  }

  return {
    law_sources: includedLawSources,
    precedent_sources: includedPrecedentSources,
    law_context_text: lawContextParts.join("\n\n"),
    precedent_context_text: precedentContextParts.join("\n\n"),
    generation_source_budget: budget.max_total_sources,
    generation_sources_count:
      includedLawSources.length + includedPrecedentSources.length,
    generation_excerpt_budget: budget.max_excerpt_chars_per_source,
    generation_context_chars: generationContextChars,
    generation_context_trimmed:
      generationContextTrimmed ||
      availablePrecedentSources.length > includedPrecedentSources.length,
    answer_mode_effective_budget: budget,
  } satisfies AssistantGenerationContext;
}

function buildSourcesSectionText(retrieval: RetrievalResult) {
  const lawsUsed = buildLawsUsed(retrieval);
  const precedentsUsed = buildPrecedentsUsed(retrieval);

  const parts: string[] = [];

  if (lawsUsed.length > 0) {
    parts.push(
      [
        "Законы:",
        ...lawsUsed.map((law, index) => {
          const articleLabel =
            law.articleNumbers.length > 0
              ? `статьи: ${law.articleNumbers.join(", ")}`
              : "без номера статьи";

          return `${index + 1}. ${law.lawTitle} (${law.lawKey}) — ${articleLabel}; тема: ${law.sourceTopicUrl}`;
        }),
      ].join("\n"),
    );
  }

  if (precedentsUsed.length > 0) {
    parts.push(
      [
        "Судебные прецеденты:",
        ...precedentsUsed.map((precedent, index) => {
          return `${index + 1}. ${precedent.precedentTitle} (${precedent.precedentKey}) — validity: ${precedent.validityStatus}; тема: ${precedent.sourceTopicUrl}`;
        }),
      ].join("\n"),
    );
  }

  if (parts.length === 0) {
    return "Подтверждённые нормы и прямые ссылки на источники в этом ответе не использовались.";
  }

  return parts.join("\n\n");
}

function buildAssistantSystemPrompt() {
  return [
    "Ты — server legal assistant Lawyer5RP.",
    "Отвечай только по переданному confirmed corpus выбранного сервера.",
    "Используй только current primary laws и только confirmed judicial precedents со status=current и validity in (applicable, limited).",
    "Не используй supplements, obsolete precedents, draft/superseded versions, общие знания, догадки или ответы вне корпуса.",
    "Законы и судебные прецеденты — разные типы источников. Не выдавай precedent как будто это норма закона.",
    "Если законы есть, law-grounded часть ответа должна идти раньше precedent-grounded части.",
    "Если закон не найден, но найден подтверждённый precedent, прямо напиши, что ответ опирается на precedent-corpus, а не на норму закона.",
    "Если надёжной нормы или подходящего подтверждённого precedent мало, не выдумывай ответ и не делай категоричных выводов.",
    "Если что-то следует не прямо из источника, вынеси это только в секцию интерпретации.",
    "Не используй для пользователя формулировки: 'недостаточно данных', 'невозможно определить', 'я не нашёл норму', 'нельзя сделать вывод'.",
    "Если опоры недостаточно, используй аккуратные условные формулировки: 'оценка зависит от...', 'при наличии оснований...', 'при соблюдении порядка...', 'может свидетельствовать...', 'допустимо при условии...'.",
    "В секции 'Использованные нормы / источники' перечисли только те нормы и прецеденты, на которые ты реально опирался в ответе.",
    "Перечисляй источники компактно: название закона или прецедента и статью либо статус, без ссылок, без служебных ID и без длинных пояснений.",
    "Не цитируй длинные фрагменты нормы и не повторяй один и тот же источник в нескольких секциях без необходимости.",
    "Верни ответ строго на русском языке и строго с markdown-секциями второго уровня:",
    "## Краткий вывод",
    "## Что прямо следует из норм закона",
    "## Что подтверждается судебными прецедентами",
    "## Вывод / интерпретация",
    "## Использованные нормы / источники",
  ].join("\n");
}

function buildAssistantUserPrompt(input: {
  serverName: string;
  question: string;
  actorContext: LegalCoreActorContext;
  responseMode: LegalCoreResponseMode;
  internalExecutionMode: AssistantInternalExecutionMode;
  generationContext: AssistantGenerationContext;
  lawSelection: AssistantLawSelection;
}) {
  return [
    `Сервер: ${input.serverName}`,
    `Вопрос пользователя: ${input.question}`,
    `Actor context: ${input.actorContext}`,
    `Response mode: ${input.responseMode}`,
    `Execution mode: ${input.internalExecutionMode}`,
    `Direct basis status: ${input.lawSelection.direct_basis_status}`,
    buildAssistantResponseModeInstruction({
      responseMode: input.responseMode,
      internalExecutionMode: input.internalExecutionMode,
    }),
    buildDirectBasisInstruction(input.lawSelection.direct_basis_status),
    "Законы (используй только этот grounded layer, если он есть):",
    input.generationContext.law_context_text || "Подходящие current primary laws по запросу не найдены.",
    "Судебные прецеденты (используй только этот grounded layer, если он есть):",
    input.generationContext.precedent_context_text ||
      "Подходящие confirmed precedents по запросу не найдены.",
    "Если law layer пустой, но precedent layer есть, прямо обозначь это в выводе.",
    "Если ни один layer не даёт надёжной опоры, признай ограничение и не выдумывай ответ.",
  ].join("\n\n");
}

function buildDirectBasisInstruction(directBasisStatus: AssistantLawSelection["direct_basis_status"]) {
  switch (directBasisStatus) {
    case "direct_basis_present":
      return "Если direct basis присутствует, допускается более уверенный вывод, но только в пределах выбранных норм.";
    case "partial_basis_only":
      return "Если direct basis частичный, делай вывод только через условия и явно отделяй прямую норму от интерпретации.";
    default:
      return "Если direct basis отсутствует, ответ должен быть строго условным, без категоричных формулировок и без подмены прямой нормы интерпретацией.";
  }
}

function buildAssistantResponseModeInstruction(input: {
  responseMode: LegalCoreResponseMode;
  internalExecutionMode: AssistantInternalExecutionMode;
}) {
  if (input.internalExecutionMode === "compact_generation") {
    return "Режим ответа: compact_generation. Дай краткий вывод, затем 2–3 коротких grounded пункта по нормам и в конце одну короткую строку 'что делать'. Не раздувай ответ, не повторяй одни и те же тезисы и не превращай его в длинное заключение.";
  }

  switch (input.responseMode) {
    case "short":
      return "Режим ответа: short. Дай очень короткий ответ: максимум 2–3 коротких пункта по сути, без длинного разбора и без повторов, сохраняя все обязательные секции.";
    case "detailed":
      return "Режим ответа: detailed. Дай более развёрнутый анализ по нормам, прецедентам и практическому выводу, но без избыточного цитирования и без повторения одних и тех же тезисов в разных секциях.";
    case "document_ready":
      return "Режим ответа: document_ready. Делай акцент на формулировках, пригодных для документа, но не делай ответ длиннее обычного normal-режима, не добавляй новые факты и не выходи за пределы grounded sources.";
    default:
      return "Режим ответа: normal. Дай обычный по глубине юридический ответ: 1 короткий абзац в кратком выводе, 2–4 компактных grounded points по нормам, короткую интерпретацию, без повторов и без превращения ответа в длинное заключение.";
  }
}

function buildNoNormsAnswer(retrieval: RetrievalResult) {
  const hasCurrentLaws = retrieval.hasCurrentLawCorpus;
  const hasUsablePrecedents = retrieval.hasUsablePrecedentCorpus;
  const sections = {
    summary:
      "Оценка по этому вопросу зависит от наличия в подтверждённом корпусе выбранного сервера прямой нормы или подтверждённого прецедента.",
    normativeAnalysis: hasCurrentLaws
      ? "В current primary laws выбранного сервера сейчас не сформировалась достаточная прямая нормативная опора по заданной формулировке вопроса."
      : "Для этого сервера прямая нормативная опора по заданной формулировке вопроса пока не сформирована в current primary laws.",
    precedentAnalysis: hasUsablePrecedents
      ? "Среди подтверждённых current precedents со статусом validity applicable или limited сейчас нет достаточной опоры для уверенного самостоятельного вывода."
      : "Подходящая precedent-опора по этому вопросу для выбранного сервера пока не сформирована.",
    interpretation:
      "При наличии более точной формулировки вопроса или дополнительной confirmed corpus-опоры вывод может быть уточнён без выхода за пределы законодательства выбранного сервера.",
  } satisfies AssistantAnswerSections;

  return {
    sections,
    answerMarkdown: composeAssistantAnswerMarkdown(sections),
  };
}

function buildUnavailableMessage() {
  return "Сервис юридического помощника сейчас недоступен. Попробуй задать вопрос позже.";
}

function buildAnswerPreview(value: string) {
  return normalizeSectionText(value).slice(0, MAX_ANSWER_PREVIEW_LENGTH);
}

function buildAssistantRunObservability(input: {
  latencyMs: number;
  usageMetrics: ReturnType<typeof extractProxyUsageMetrics>;
}): AssistantRunObservability {
  return {
    latency_ms: input.latencyMs,
    prompt_tokens: input.usageMetrics.prompt_tokens,
    completion_tokens: input.usageMetrics.completion_tokens,
    total_tokens: input.usageMetrics.total_tokens,
    cost_usd: input.usageMetrics.cost_usd,
  };
}

function buildProxyRetryStageUsage(
  proxyResponse: { attempts?: ProxyAttemptTrace[] } | null | undefined,
) {
  const attempts = proxyResponse?.attempts ?? [];

  if (attempts.length <= 1) {
    return null;
  }

  return mergeAIStageUsageEntries(
    attempts.slice(0, -1).map((attempt) =>
      buildAIStageUsageEntry({
        model: attempt.model,
        prompt_tokens: attempt.prompt_tokens,
        completion_tokens: attempt.completion_tokens,
        total_tokens: attempt.total_tokens,
        cost_usd: attempt.cost_usd,
        latency_ms: attempt.latency_ms,
      }),
    ),
  );
}

function buildAssistantStageUsage(input: {
  normalizationStageUsage: ReturnType<typeof buildAIStageUsageEntry>;
  normalizationRetryStageUsage?: ReturnType<typeof mergeAIStageUsageEntries>;
  generationStageUsage?: ReturnType<typeof buildAIStageUsageEntry> | null;
  generationRetryStageUsage?: ReturnType<typeof mergeAIStageUsageEntries>;
  responsePayloadJson?: Record<string, unknown> | null;
}) {
  const retryStageUsage = mergeAIStageUsageEntries([
    input.normalizationRetryStageUsage ?? null,
    input.generationRetryStageUsage ?? null,
  ]);
  const reviewStageUsage = extractAIReviewerStageUsage(input.responsePayloadJson ?? null);
  const stageUsage: AssistantStageUsage = {
    normalization: input.normalizationStageUsage,
  };

  if (input.generationStageUsage) {
    stageUsage.generation = input.generationStageUsage;
  }

  if (reviewStageUsage) {
    stageUsage.review = reviewStageUsage;
  }

  if (retryStageUsage) {
    stageUsage.retry = retryStageUsage;
  }

  return stageUsage;
}

function buildAssistantReviewStatus(
  futureReviewMarker: ReturnType<typeof buildAssistantFutureReviewMarker>,
): AssistantReviewStatus {
  return {
    queue_for_future_ai_quality_review: futureReviewMarker.queue_for_future_ai_quality_review,
    future_review_priority: futureReviewMarker.future_review_priority,
    future_review_flags: futureReviewMarker.future_review_flags,
    future_review_reason_codes: futureReviewMarker.future_review_reason_codes,
  };
}

function buildAssistantInputTrace(question: string) {
  return {
    input_kind: "assistant_question",
    question_preview: normalizeSectionText(question).slice(0, MAX_QUESTION_PREVIEW_LENGTH),
    question_length: question.trim().length,
  };
}

function buildAssistantOutputTrace(input: {
  answerMarkdown: string;
  sections: AssistantAnswerSections;
}) {
  return {
    output_kind: "assistant_markdown",
    output_preview: buildAnswerPreview(input.answerMarkdown),
    output_length: input.answerMarkdown.length,
    section_keys: Object.keys(input.sections).filter((key) => {
      const value = input.sections[key as keyof AssistantAnswerSections];

      return typeof value === "string" && value.trim().length > 0;
    }),
  };
}

function getAssistantAIPayloadProfile(input: {
  testRunContext?: AssistantTestRunContext;
  internalExecutionMode: AssistantInternalExecutionMode;
}): AssistantAIPayloadProfile {
  if (input.testRunContext || input.internalExecutionMode !== "full_generation") {
    return "internal_full";
  }

  return "runtime_compact";
}

function buildCompactCandidateLabel(input: {
  lawTitle: string;
  articleNumber: string | null;
  lawFamily: string;
}) {
  const articleLabel = input.articleNumber ? `ст. ${input.articleNumber}` : "без статьи";

  return `${input.lawTitle} (${articleLabel}, ${input.lawFamily})`;
}

function buildAssistantCompactCandidatePoolPreview(
  entries: Array<{
    law_name: string;
    article_number: string | null;
    law_family_guess: string;
    retrieval_score?: number | null;
  }>,
  selectedDiagnostics: AssistantCompactSelectedCandidateDiagnostic[],
) {
  const selectedDiagnosticMap = new Map(
    selectedDiagnostics.map((entry) => [entry.law_block_id, entry]),
  );

  return entries.slice(0, 3).map((entry) => {
    const selectedDiagnostic =
      "law_block_id" in entry && typeof entry.law_block_id === "string"
        ? selectedDiagnosticMap.get(entry.law_block_id)
        : null;

    return {
      law_title: entry.law_name,
      article_number: entry.article_number ?? null,
      law_family: entry.law_family_guess,
      norm_role: selectedDiagnostic?.norm_role ?? null,
      primary_basis_eligibility: selectedDiagnostic?.primary_basis_eligibility ?? null,
      retrieval_score:
        typeof entry.retrieval_score === "number" ? Math.round(entry.retrieval_score * 1000) / 1000 : null,
      status: "preview",
      label: buildCompactCandidateLabel({
        lawTitle: entry.law_name,
        articleNumber: entry.article_number ?? null,
        lawFamily: entry.law_family_guess,
      }),
    } satisfies AssistantCompactCandidatePoolEntry;
  });
}

function buildCountMap(values: string[]) {
  return Object.fromEntries(
    Array.from(
      values.reduce((map, value) => {
        map.set(value, (map.get(value) ?? 0) + 1);
        return map;
      }, new Map<string, number>()),
    ).sort(([leftKey, leftCount], [rightKey, rightCount]) => {
      if (rightCount !== leftCount) {
        return rightCount - leftCount;
      }

      return leftKey.localeCompare(rightKey, "ru");
    }),
  );
}

function buildAssistantSelectedCandidateDiagnostics(input: {
  applicabilityDiagnostics: Array<Record<string, unknown>>;
  selectedNormRoles: Array<Record<string, unknown>>;
}) {
  const selectedIds = new Set(
    input.selectedNormRoles.map((entry) => {
      const lawId = typeof entry.law_id === "string" ? entry.law_id : "";
      const lawVersion = typeof entry.law_version === "string" ? entry.law_version : "";
      const lawBlockId = typeof entry.law_block_id === "string" ? entry.law_block_id : "";

      return `${lawId}:${lawVersion}:${lawBlockId}`;
    }),
  );

  return input.applicabilityDiagnostics
    .filter((entry) => {
      const lawId = typeof entry.law_id === "string" ? entry.law_id : "";
      const lawVersion = typeof entry.law_version === "string" ? entry.law_version : "";
      const lawBlockId = typeof entry.law_block_id === "string" ? entry.law_block_id : "";

      return selectedIds.has(`${lawId}:${lawVersion}:${lawBlockId}`);
    })
    .map((entry) => ({
      law_id: typeof entry.law_id === "string" ? entry.law_id : "",
      law_title: typeof entry.law_name === "string" ? entry.law_name : "",
      law_version: typeof entry.law_version === "string" ? entry.law_version : "",
      law_block_id: typeof entry.law_block_id === "string" ? entry.law_block_id : "",
      article_number:
        typeof entry.article_number === "string" || entry.article_number === null
          ? entry.article_number
          : null,
      law_family: typeof entry.law_family === "string" ? entry.law_family : "other",
      norm_role: typeof entry.norm_role === "string" ? entry.norm_role : "background_only",
      applicability_score:
        typeof entry.applicability_score === "number" ? entry.applicability_score : 0,
      primary_basis_eligibility:
        typeof entry.primary_basis_eligibility === "string"
          ? entry.primary_basis_eligibility
          : "ineligible",
      primary_basis_eligibility_reason:
        typeof entry.primary_basis_eligibility_reason === "string"
          ? entry.primary_basis_eligibility_reason
          : null,
      ineligible_primary_basis_reasons: Array.isArray(entry.ineligible_primary_basis_reasons)
        ? entry.ineligible_primary_basis_reasons.filter((value): value is string => typeof value === "string")
        : [],
      weak_primary_basis_reasons: Array.isArray(entry.weak_primary_basis_reasons)
        ? entry.weak_primary_basis_reasons.filter((value): value is string => typeof value === "string")
        : [],
    })) satisfies AssistantCompactSelectedCandidateDiagnostic[];
}

function buildAssistantCompactDiagnostics(input: {
  applicabilityDiagnostics: Array<Record<string, unknown>>;
  groundingDiagnostics: Record<string, unknown> | null;
  selectedNormRoles: Array<Record<string, unknown>>;
}) {
  const selectedCandidateDiagnostics = buildAssistantSelectedCandidateDiagnostics({
    applicabilityDiagnostics: input.applicabilityDiagnostics,
    selectedNormRoles: input.selectedNormRoles,
  });
  const eligibilityCounts = buildCountMap(
    input.applicabilityDiagnostics
      .map((entry) =>
        typeof entry.primary_basis_eligibility === "string"
          ? entry.primary_basis_eligibility
          : "ineligible",
      )
      .filter((value) => value.length > 0),
  );
  const selectedEligibilityCounts = buildCountMap(
    selectedCandidateDiagnostics.map((entry) => entry.primary_basis_eligibility),
  );
  const flags =
    input.groundingDiagnostics && Array.isArray(input.groundingDiagnostics.flags)
      ? input.groundingDiagnostics.flags.filter((value): value is string => typeof value === "string")
      : [];

  return {
    selected_candidate_diagnostics: selectedCandidateDiagnostics,
    diagnostics_summary: {
      missing_primary_basis_norm: flags.includes("missing_primary_basis_norm"),
      law_family_mismatch: flags.includes("law_family_mismatch"),
      weak_direct_basis: flags.includes("weak_direct_basis"),
      off_topic_context_norm: flags.includes("off_topic_context_norm"),
      counts_by_primary_basis_eligibility: eligibilityCounts,
    },
    grounding_diagnostics: {
      direct_basis_status:
        input.groundingDiagnostics && typeof input.groundingDiagnostics.direct_basis_status === "string"
          ? input.groundingDiagnostics.direct_basis_status
          : "no_direct_basis",
      selected_norm_count:
        input.groundingDiagnostics && typeof input.groundingDiagnostics.selected_norm_count === "number"
          ? input.groundingDiagnostics.selected_norm_count
          : 0,
      primary_basis_norm_count:
        input.groundingDiagnostics &&
        typeof input.groundingDiagnostics.primary_basis_norm_count === "number"
          ? input.groundingDiagnostics.primary_basis_norm_count
          : 0,
      selected_law_families:
        input.groundingDiagnostics && Array.isArray(input.groundingDiagnostics.selected_law_families)
          ? input.groundingDiagnostics.selected_law_families.filter(
              (value): value is string => typeof value === "string",
            )
          : [],
      legal_issue_type:
        input.groundingDiagnostics && typeof input.groundingDiagnostics.legal_issue_type === "string"
          ? input.groundingDiagnostics.legal_issue_type
          : "unclear",
      legal_issue_secondary_types:
        input.groundingDiagnostics && Array.isArray(input.groundingDiagnostics.legal_issue_secondary_types)
          ? input.groundingDiagnostics.legal_issue_secondary_types.filter(
              (value): value is string => typeof value === "string",
            )
          : [],
      legal_issue_confidence:
        input.groundingDiagnostics &&
        typeof input.groundingDiagnostics.legal_issue_confidence === "string"
          ? input.groundingDiagnostics.legal_issue_confidence
          : "low",
      selected_primary_basis_eligibility_summary: selectedEligibilityCounts,
    },
  };
}

function buildAssistantCompactFilterReasons(
  filterReasons: Array<{ law_block_id?: string; reasons?: string[] }>,
) {
  const reasonCounts = buildCountMap(
    filterReasons.flatMap((entry) =>
      Array.isArray(entry.reasons) ? entry.reasons.filter((value): value is string => typeof value === "string") : [],
    ),
  );
  const topFilterReasons = Object.entries(reasonCounts)
    .slice(0, 5)
    .map(([reason, count]) => ({ reason, count }));

  return {
    filter_reason_counts: reasonCounts,
    top_filter_reasons: topFilterReasons,
  };
}

function buildAssistantCompactSourceLedger(input: {
  sourceLedger: AssistantSourceLedger;
  usedSources: AssistantUsedSource[];
  strategy: string;
}) {
  return {
    server_id: input.sourceLedger.server_id,
    law_version_ids: input.sourceLedger.law_version_ids,
    strategy: input.strategy,
    found_norms_count: input.sourceLedger.found_norms.length,
    context_norms_count: input.sourceLedger.context_norms.length,
    used_norms_count: input.sourceLedger.used_norms.length,
    used_sources_projection: input.usedSources.slice(0, 5).map((source) => {
      if (source.source_kind === "law") {
        return {
          source_kind: source.source_kind,
          law_name: source.law_name,
          article_number: source.article_number,
          law_version: source.law_version,
        };
      }

      return {
        source_kind: source.source_kind,
        precedent_name: source.precedent_name,
        precedent_version: source.precedent_version,
        validity_status: source.validity_status,
      };
    }),
  };
}

function buildAssistantCompactOutputTrace(input: {
  outputTrace: Record<string, unknown> | null;
  answerSections?: AssistantAnswerSections;
}) {
  if (!input.outputTrace) {
    return null;
  }

  return {
    output_preview:
      typeof input.outputTrace.output_preview === "string" ? input.outputTrace.output_preview : null,
    finish_reason:
      typeof input.outputTrace.finish_reason === "string" ? input.outputTrace.finish_reason : null,
    answer_length:
      typeof input.outputTrace.output_length === "number" ? input.outputTrace.output_length : null,
    answer_section_count: input.answerSections
      ? Object.values(input.answerSections).filter(
          (value) => typeof value === "string" && value.trim().length > 0,
        ).length
      : typeof input.outputTrace.answer_section_count === "number"
        ? input.outputTrace.answer_section_count
        : null,
    answer_section_titles: input.answerSections
      ? Object.entries(input.answerSections)
          .filter(([, value]) => typeof value === "string" && value.trim().length > 0)
          .map(([key]) => key)
      : Array.isArray(input.outputTrace.answer_section_titles)
        ? input.outputTrace.answer_section_titles.filter((value): value is string => typeof value === "string")
        : [],
  };
}

function buildAssistantCompactRequestPayload(input: {
  payload: Record<string, unknown>;
  usedSources: AssistantUsedSource[];
}) {
  const applicabilityDiagnostics = Array.isArray(input.payload.applicability_diagnostics)
    ? input.payload.applicability_diagnostics.filter(
        (entry): entry is Record<string, unknown> =>
          Boolean(entry) && typeof entry === "object" && !Array.isArray(entry),
      )
    : [];
  const selectedNormRoles = Array.isArray(input.payload.selected_norm_roles)
    ? input.payload.selected_norm_roles.filter(
        (entry): entry is Record<string, unknown> =>
          Boolean(entry) && typeof entry === "object" && !Array.isArray(entry),
      )
    : [];
  const compactDiagnostics = buildAssistantCompactDiagnostics({
    applicabilityDiagnostics,
    groundingDiagnostics:
      input.payload.grounding_diagnostics &&
      typeof input.payload.grounding_diagnostics === "object" &&
      !Array.isArray(input.payload.grounding_diagnostics)
        ? (input.payload.grounding_diagnostics as Record<string, unknown>)
        : null,
    selectedNormRoles,
  });
  const candidatePoolBeforeFilters = Array.isArray(input.payload.candidate_pool_before_filters)
    ? input.payload.candidate_pool_before_filters.filter(
        (entry): entry is {
          law_block_id?: string;
          law_name: string;
          article_number: string | null;
          law_family_guess: string;
          retrieval_score?: number | null;
        } =>
          Boolean(entry) &&
          typeof entry === "object" &&
          !Array.isArray(entry) &&
          typeof (entry as { law_name?: unknown }).law_name === "string" &&
          typeof (entry as { law_family_guess?: unknown }).law_family_guess === "string",
      )
    : [];
  const candidatePoolAfterFilters = Array.isArray(input.payload.candidate_pool_after_filters)
    ? input.payload.candidate_pool_after_filters.filter(
        (entry): entry is {
          law_block_id?: string;
          law_name: string;
          article_number: string | null;
          law_family_guess: string;
          retrieval_score?: number | null;
        } =>
          Boolean(entry) &&
          typeof entry === "object" &&
          !Array.isArray(entry) &&
          typeof (entry as { law_name?: unknown }).law_name === "string" &&
          typeof (entry as { law_family_guess?: unknown }).law_family_guess === "string",
      )
    : [];
  const familyCountsSource =
    candidatePoolAfterFilters.length > 0 ? candidatePoolAfterFilters : candidatePoolBeforeFilters;
  const filterReasons = Array.isArray(input.payload.filter_reasons)
    ? input.payload.filter_reasons.filter(
        (entry): entry is { law_block_id?: string; reasons?: string[] } =>
          Boolean(entry) && typeof entry === "object" && !Array.isArray(entry),
      )
    : [];
  const sourceLedger =
    input.payload.source_ledger &&
    typeof input.payload.source_ledger === "object" &&
    !Array.isArray(input.payload.source_ledger)
      ? (input.payload.source_ledger as AssistantSourceLedger)
      : null;

  const rest = { ...input.payload };
  delete rest.candidate_pool_before_filters;
  delete rest.candidate_pool_after_filters;
  delete rest.filter_reasons;
  delete rest.applicability_diagnostics;
  delete rest.grounding_diagnostics;
  delete rest.retrievalResults;
  delete rest.source_ledger;

  return {
    ...rest,
    payload_profile: "runtime_compact",
    candidate_pool_before_filters_count: candidatePoolBeforeFilters.length,
    candidate_pool_after_filters_count: candidatePoolAfterFilters.length,
    candidate_pool_before_filters_preview: buildAssistantCompactCandidatePoolPreview(
      candidatePoolBeforeFilters,
      compactDiagnostics.selected_candidate_diagnostics,
    ),
    candidate_pool_after_filters_preview: buildAssistantCompactCandidatePoolPreview(
      candidatePoolAfterFilters,
      compactDiagnostics.selected_candidate_diagnostics,
    ),
    candidate_pool_family_counts: buildCountMap(
      familyCountsSource.map((entry) => entry.law_family_guess).filter((value) => value.length > 0),
    ),
    candidate_pool_role_counts: buildCountMap(
      applicabilityDiagnostics
        .map((entry) => (typeof entry.norm_role === "string" ? entry.norm_role : "background_only"))
        .filter((value) => value.length > 0),
    ),
    ...buildAssistantCompactFilterReasons(filterReasons),
    ...compactDiagnostics,
    primary_basis_eligibility: compactDiagnostics.selected_candidate_diagnostics.map((entry) => ({
      law_id: entry.law_id,
      law_version: entry.law_version,
      law_block_id: entry.law_block_id,
      primary_basis_eligibility: entry.primary_basis_eligibility,
      primary_basis_eligibility_reason: entry.primary_basis_eligibility_reason,
      ineligible_primary_basis_reasons: entry.ineligible_primary_basis_reasons,
      weak_primary_basis_reasons: entry.weak_primary_basis_reasons,
    })),
    source_ledger: sourceLedger
      ? buildAssistantCompactSourceLedger({
          sourceLedger,
          usedSources: input.usedSources,
          strategy:
            typeof input.payload.branch === "string" && input.payload.branch === "answered"
              ? "assistant_inferred_used_sources"
              : "assistant_structured_context_default",
        })
      : null,
  };
}

function buildAssistantCompactResponsePayload(input: {
  payload: Record<string, unknown>;
  answerSections?: AssistantAnswerSections;
}) {
  const outputTrace =
    input.payload.output_trace &&
    typeof input.payload.output_trace === "object" &&
    !Array.isArray(input.payload.output_trace)
      ? (input.payload.output_trace as Record<string, unknown>)
      : null;
  const rest = { ...input.payload };
  delete rest.answer_sections;
  delete rest.output_trace;

  return {
    ...rest,
    payload_profile: "runtime_compact",
    output_trace: buildAssistantCompactOutputTrace({
      outputTrace,
      answerSections: input.answerSections,
    }),
  };
}

function buildAssistantStorageRequestPayload(input: {
  payloadProfile: AssistantAIPayloadProfile;
  payload: Record<string, unknown>;
  usedSources: AssistantUsedSource[];
}) {
  if (input.payloadProfile === "internal_full") {
    return {
      ...input.payload,
      payload_profile: "internal_full",
    };
  }

  return buildAssistantCompactRequestPayload({
    payload: input.payload,
    usedSources: input.usedSources,
  });
}

function buildAssistantStorageResponsePayload(input: {
  payloadProfile: AssistantAIPayloadProfile;
  payload: Record<string, unknown>;
  answerSections?: AssistantAnswerSections;
}) {
  if (input.payloadProfile === "internal_full") {
    return {
      ...input.payload,
      payload_profile: "internal_full",
    };
  }

  return buildAssistantCompactResponsePayload({
    payload: input.payload,
    answerSections: input.answerSections,
  });
}

export async function generateServerLegalAssistantAnswer(
  input: {
    serverId: string;
    serverCode: string;
    serverName: string;
    question: string;
    actorContext?: LegalCoreActorContext;
    responseModeOverride?: LegalCoreResponseMode;
    accountId?: string | null;
    guestSessionId?: string | null;
    testRunContext?: AssistantTestRunContext;
    internalExecutionMode?: AssistantInternalExecutionMode;
  },
  dependencies: AnswerPipelineDependencies = defaultDependencies,
) {
  const normalizeInputText = dependencies.normalizeInputText ?? normalizeLegalInputText;
  const normalizedInput = await normalizeInputText({
    rawInput: input.question,
    featureKey: "server_legal_assistant",
  });
  const normalizationStageUsage =
    "normalization_stage_usage" in normalizedInput &&
    normalizedInput.normalization_stage_usage
      ? normalizedInput.normalization_stage_usage
      : buildAIStageUsageEntry({
          model: normalizedInput.normalization_model,
          prompt_tokens: null,
          completion_tokens: null,
          total_tokens: null,
          cost_usd: null,
          latency_ms: 0,
        });
  const normalizationRetryStageUsage =
    "normalization_retry_stage_usage" in normalizedInput
      ? normalizedInput.normalization_retry_stage_usage
      : null;
  const intent = classifyAssistantIntent(normalizedInput.normalized_input);
  const responseMode =
    input.responseModeOverride ?? detectQuestionResponseMode(normalizedInput.normalized_input);
  const actorContext = input.actorContext ?? "general_question";
  const legalQueryPlan = buildLegalQueryPlan({
    normalizedInput: normalizedInput.normalized_input,
    intent,
    actorContext,
    responseMode,
    serverId: input.serverId,
  });
  const retrievalQueryBreakdown = buildAssistantRetrievalQuery({
    normalized_input: legalQueryPlan.normalized_input,
    intent: legalQueryPlan.intent,
    required_law_families: legalQueryPlan.required_law_families,
    preferred_norm_roles: legalQueryPlan.preferred_norm_roles,
    legal_anchors: [...legalQueryPlan.legal_anchors],
    question_scope: legalQueryPlan.question_scope,
    forbidden_scope_markers: legalQueryPlan.forbidden_scope_markers,
  });
  const retrievalQuery = retrievalQueryBreakdown.expanded_query;
  const retrieval = await dependencies.searchAssistantCorpus({
    serverId: input.serverId,
    query: retrievalQuery,
    lawLimit: 12,
    precedentLimit: 4,
    legalQueryPlan,
  });
  const lawSelection = selectStructuredLegalContext({
    candidates: retrieval.lawRetrieval.results,
    plan: legalQueryPlan,
  });
  const groundingDiagnostics = buildLegalGroundingDiagnostics({
    plan: legalQueryPlan,
    selection: lawSelection,
  });
  const sourceLedgerBase = buildAssistantSourceLedger(retrieval, lawSelection.selected_norms);
  const sourceLedger = buildAssistantSourceLedgerWithUsedNorms(sourceLedgerBase, []);
  const lawVersionContract = buildAssistantLawVersionContract({
    retrieval,
    sourceLedger,
  });
  const internalExecutionMode = input.internalExecutionMode ?? "full_generation";
  const generationContext = buildAssistantGenerationContext({
    retrieval,
    lawSelection,
    responseMode,
    internalExecutionMode,
  });
  const usedSources = buildAssistantContextUsedSources({
    lawContext: generationContext.law_sources,
    precedentContext: generationContext.precedent_sources,
  });
  const inputTrace = buildAssistantInputTrace(normalizedInput.normalized_input);
  const retrievalDebugPayload = {
    retrieval_query_base_terms:
      retrieval.retrievalDebug?.retrieval_query_base_terms ?? retrievalQueryBreakdown.base_terms,
    retrieval_query_anchor_terms:
      retrieval.retrievalDebug?.retrieval_query_anchor_terms ?? retrievalQueryBreakdown.anchor_terms,
    retrieval_query_family_terms:
      retrieval.retrievalDebug?.retrieval_query_family_terms ?? retrievalQueryBreakdown.family_terms,
    retrieval_runtime_tags:
      retrieval.retrievalDebug?.retrieval_runtime_tags ?? retrievalQueryBreakdown.runtime_tags,
    candidate_pool_before_filters: retrieval.retrievalDebug?.candidate_pool_before_filters ?? [],
    candidate_pool_after_filters: retrieval.retrievalDebug?.candidate_pool_after_filters ?? [],
    applied_biases: retrieval.retrievalDebug?.applied_biases ?? retrievalQueryBreakdown.applied_biases,
    filter_reasons: retrieval.retrievalDebug?.filter_reasons ?? [],
  };
  const payloadProfile = getAssistantAIPayloadProfile({
    testRunContext: input.testRunContext,
    internalExecutionMode,
  });
  const metadataBase = {
    serverId: input.serverId,
    serverCode: input.serverCode,
    serverName: input.serverName,
    lawCorpusSnapshot: retrieval.lawCorpusSnapshot,
    precedentCorpusSnapshot: retrieval.precedentCorpusSnapshot,
    combinedRetrievalRevision: retrieval.combinedRetrievalRevision,
    corpusSnapshot: retrieval.combinedRetrievalRevision,
    lawsUsed: buildLawsUsed(retrieval, lawSelection.selected_norms),
    precedentsUsed: buildPrecedentsUsed(retrieval),
    references: buildGroundedReferences(retrieval),
    intent,
    actor_context: actorContext,
    response_mode: responseMode,
    prompt_version: LEGAL_ASSISTANT_PROMPT_VERSION,
    law_version_ids: retrieval.combinedRetrievalRevision.lawCurrentVersionIds,
    law_version_contract: lawVersionContract,
    raw_input: normalizedInput.raw_input,
    normalized_input: normalizedInput.normalized_input,
    normalization_model: normalizedInput.normalization_model,
    normalization_prompt_version: normalizedInput.normalization_prompt_version,
    normalization_changed: normalizedInput.normalization_changed,
    legal_query_plan: legalQueryPlan,
    selected_norm_roles: lawSelection.selected_norm_roles,
    direct_basis_status: lawSelection.direct_basis_status,
    applicability_diagnostics: groundingDiagnostics.candidate_diagnostics,
    grounding_diagnostics: groundingDiagnostics.grounding_diagnostics,
    retrieval_query: retrievalQuery,
    used_sources: usedSources,
    source_ledger: sourceLedger,
    generation_source_budget: generationContext.generation_source_budget,
    generation_sources_count: generationContext.generation_sources_count,
    generation_excerpt_budget: generationContext.generation_excerpt_budget,
    generation_context_chars: generationContext.generation_context_chars,
    generation_context_trimmed: generationContext.generation_context_trimmed,
    answer_mode_effective_budget: generationContext.answer_mode_effective_budget,
    generation_max_output_tokens: generationContext.answer_mode_effective_budget.max_output_tokens,
    test_run_context: input.testRunContext ?? null,
  };

  if (!retrieval.hasAnyUsableCorpus) {
    const selfAssessment = buildAssistantSelfAssessment({
      status: "no_corpus",
      lawResultCount: retrieval.lawRetrieval.resultCount,
      precedentResultCount: retrieval.precedentRetrieval.resultCount,
      directBasisStatus: lawSelection.direct_basis_status,
    });
    const futureReviewMarker = buildAssistantFutureReviewMarker({
      selfAssessment,
      status: "no_corpus",
      lawResultCount: retrieval.lawRetrieval.resultCount,
      precedentResultCount: retrieval.precedentRetrieval.resultCount,
      lawVersionContractConsistent: lawVersionContract.is_current_snapshot_consistent,
    });
    const noCorpusRequestPayload = {
      branch: "no_corpus",
      serverId: input.serverId,
      serverCode: input.serverCode,
      question: normalizedInput.normalized_input,
      intent,
      actor_context: actorContext,
      response_mode: responseMode,
      prompt_version: LEGAL_ASSISTANT_PROMPT_VERSION,
      law_version_ids: retrieval.combinedRetrievalRevision.lawCurrentVersionIds,
      law_version_contract: lawVersionContract,
      raw_input: normalizedInput.raw_input,
      normalized_input: normalizedInput.normalized_input,
      normalization_model: normalizedInput.normalization_model,
      normalization_prompt_version: normalizedInput.normalization_prompt_version,
      normalization_changed: normalizedInput.normalization_changed,
      legal_query_plan: legalQueryPlan,
      selected_norm_roles: lawSelection.selected_norm_roles,
      direct_basis_status: lawSelection.direct_basis_status,
      applicability_diagnostics: groundingDiagnostics.candidate_diagnostics,
      grounding_diagnostics: groundingDiagnostics.grounding_diagnostics,
      retrieval_query: retrievalQuery,
      ...retrievalDebugPayload,
      input_trace: inputTrace,
      used_sources: usedSources,
      source_ledger: sourceLedger,
      generation_source_budget: generationContext.generation_source_budget,
      generation_sources_count: generationContext.generation_sources_count,
      generation_excerpt_budget: generationContext.generation_excerpt_budget,
      generation_context_chars: generationContext.generation_context_chars,
      generation_context_trimmed: generationContext.generation_context_trimmed,
      answer_mode_effective_budget: generationContext.answer_mode_effective_budget,
      generation_max_output_tokens: generationContext.answer_mode_effective_budget.max_output_tokens,
      test_run_context: input.testRunContext ?? null,
    };
    const noCorpusResponsePayload = {
      branch: "no_corpus",
      lawCorpusSnapshot: retrieval.lawCorpusSnapshot,
      precedentCorpusSnapshot: retrieval.precedentCorpusSnapshot,
      combinedRetrievalRevision: retrieval.combinedRetrievalRevision,
      latencyMs: 0,
      prompt_tokens: null,
      completion_tokens: null,
      total_tokens: null,
      cost_usd: null,
      confidence: selfAssessment.answer_confidence,
      output_trace: null,
      used_sources: usedSources,
      ...futureReviewMarker,
      self_assessment: selfAssessment,
    };
    const storedNoCorpusRequestPayload = buildAssistantStorageRequestPayload({
      payloadProfile,
      payload: noCorpusRequestPayload,
      usedSources,
    });
    const storedNoCorpusResponsePayload = buildAssistantStorageResponsePayload({
      payloadProfile,
      payload: noCorpusResponsePayload,
    });
    const reviewedNoCorpusResponsePayload = await attachDeterministicAIQualityReview({
      featureKey: "server_legal_assistant",
      requestPayloadJson: storedNoCorpusRequestPayload,
      responsePayloadJson: storedNoCorpusResponsePayload,
    });
    await dependencies.createAIRequest({
      accountId: input.accountId ?? null,
      guestSessionId: input.guestSessionId ?? null,
      serverId: input.serverId,
      featureKey: "server_legal_assistant",
      status: "unavailable",
      requestPayloadJson: storedNoCorpusRequestPayload,
      responsePayloadJson: {
        ...reviewedNoCorpusResponsePayload,
        stage_usage: buildAssistantStageUsage({
          normalizationStageUsage,
          normalizationRetryStageUsage,
          responsePayloadJson: reviewedNoCorpusResponsePayload,
        }),
      },
      errorMessage: "Для выбранного сервера нет confirmed current law или precedent corpus.",
    });

    return {
      status: "no_corpus" as const,
      message: "Для выбранного сервера пока нет подтверждённого usable corpus для юридического помощника.",
      metadata: {
        ...metadataBase,
        ...buildAssistantRunObservability({
          latencyMs: 0,
          usageMetrics: {
            prompt_tokens: null,
            completion_tokens: null,
            total_tokens: null,
            cost_usd: null,
          },
        }),
        review_status: buildAssistantReviewStatus(futureReviewMarker),
        self_assessment: selfAssessment,
      },
    };
  }

  if (retrieval.resultCount === 0) {
    const fallbackAnswer = buildNoNormsAnswer(retrieval);
    const fallbackSections = {
      ...fallbackAnswer.sections,
      sources: buildSourcesSectionText(retrieval),
    };
    const fallbackAnswerMarkdown = composeAssistantAnswerMarkdown(fallbackSections);
    const selfAssessment = buildAssistantSelfAssessment({
      status: "no_norms",
      lawResultCount: retrieval.lawRetrieval.resultCount,
      precedentResultCount: retrieval.precedentRetrieval.resultCount,
      directBasisStatus: lawSelection.direct_basis_status,
    });
    const futureReviewMarker = buildAssistantFutureReviewMarker({
      selfAssessment,
      status: "no_norms",
      lawResultCount: retrieval.lawRetrieval.resultCount,
      precedentResultCount: retrieval.precedentRetrieval.resultCount,
      lawVersionContractConsistent: lawVersionContract.is_current_snapshot_consistent,
    });
    const noNormsRequestPayload = {
      branch: "no_norms",
      serverId: input.serverId,
      serverCode: input.serverCode,
      question: normalizedInput.normalized_input,
      intent,
      actor_context: actorContext,
      response_mode: responseMode,
      prompt_version: LEGAL_ASSISTANT_PROMPT_VERSION,
      law_version_ids: retrieval.combinedRetrievalRevision.lawCurrentVersionIds,
      law_version_contract: lawVersionContract,
      raw_input: normalizedInput.raw_input,
      normalized_input: normalizedInput.normalized_input,
      normalization_model: normalizedInput.normalization_model,
      normalization_prompt_version: normalizedInput.normalization_prompt_version,
      normalization_changed: normalizedInput.normalization_changed,
      legal_query_plan: legalQueryPlan,
      selected_norm_roles: lawSelection.selected_norm_roles,
      direct_basis_status: lawSelection.direct_basis_status,
      applicability_diagnostics: groundingDiagnostics.candidate_diagnostics,
      grounding_diagnostics: groundingDiagnostics.grounding_diagnostics,
      retrieval_query: retrievalQuery,
      ...retrievalDebugPayload,
      input_trace: inputTrace,
      used_sources: usedSources,
      source_ledger: sourceLedger,
      generation_source_budget: generationContext.generation_source_budget,
      generation_sources_count: generationContext.generation_sources_count,
      generation_excerpt_budget: generationContext.generation_excerpt_budget,
      generation_context_chars: generationContext.generation_context_chars,
      generation_context_trimmed: generationContext.generation_context_trimmed,
      answer_mode_effective_budget: generationContext.answer_mode_effective_budget,
      generation_max_output_tokens: generationContext.answer_mode_effective_budget.max_output_tokens,
      test_run_context: input.testRunContext ?? null,
    };
    const noNormsResponsePayload = {
      branch: "no_norms",
      lawCorpusSnapshot: retrieval.lawCorpusSnapshot,
      precedentCorpusSnapshot: retrieval.precedentCorpusSnapshot,
      combinedRetrievalRevision: retrieval.combinedRetrievalRevision,
      resultCount: retrieval.resultCount,
      latencyMs: 0,
      prompt_tokens: null,
      completion_tokens: null,
      total_tokens: null,
      cost_usd: null,
      confidence: selfAssessment.answer_confidence,
      used_sources: usedSources,
      output_trace: buildAssistantOutputTrace({
        answerMarkdown: fallbackAnswerMarkdown,
        sections: fallbackSections,
      }),
      answer_markdown_preview: buildAnswerPreview(fallbackAnswerMarkdown),
      answer_sections: fallbackSections,
      ...futureReviewMarker,
      self_assessment: selfAssessment,
    };
    const storedNoNormsRequestPayload = buildAssistantStorageRequestPayload({
      payloadProfile,
      payload: noNormsRequestPayload,
      usedSources,
    });
    const storedNoNormsResponsePayload = buildAssistantStorageResponsePayload({
      payloadProfile,
      payload: noNormsResponsePayload,
      answerSections: fallbackSections,
    });
    const reviewedNoNormsResponsePayload = await attachDeterministicAIQualityReview({
      featureKey: "server_legal_assistant",
      requestPayloadJson: storedNoNormsRequestPayload,
      responsePayloadJson: storedNoNormsResponsePayload,
    });

    await dependencies.createAIRequest({
      accountId: input.accountId ?? null,
      guestSessionId: input.guestSessionId ?? null,
      serverId: input.serverId,
      featureKey: "server_legal_assistant",
      status: "success",
      requestPayloadJson: storedNoNormsRequestPayload,
      responsePayloadJson: {
        ...reviewedNoNormsResponsePayload,
        stage_usage: buildAssistantStageUsage({
          normalizationStageUsage,
          normalizationRetryStageUsage,
          responsePayloadJson: reviewedNoNormsResponsePayload,
        }),
      },
      errorMessage: null,
    });

    return {
      status: "no_norms" as const,
      answerMarkdown: fallbackAnswerMarkdown,
      sections: fallbackSections,
      metadata: {
        ...metadataBase,
        ...buildAssistantRunObservability({
          latencyMs: 0,
          usageMetrics: {
            prompt_tokens: null,
            completion_tokens: null,
            total_tokens: null,
            cost_usd: null,
          },
        }),
        review_status: buildAssistantReviewStatus(futureReviewMarker),
        self_assessment: selfAssessment,
      },
    };
  }

  const answeredSelfAssessment = buildAssistantSelfAssessment({
    status: "answered",
    lawResultCount: retrieval.lawRetrieval.resultCount,
    precedentResultCount: retrieval.precedentRetrieval.resultCount,
    directBasisStatus: lawSelection.direct_basis_status,
  });
  const answeredFutureReviewMarker = buildAssistantFutureReviewMarker({
    selfAssessment: answeredSelfAssessment,
    status: "answered",
    lawResultCount: retrieval.lawRetrieval.resultCount,
    precedentResultCount: retrieval.precedentRetrieval.resultCount,
    lawVersionContractConsistent: lawVersionContract.is_current_snapshot_consistent,
  });
  const proxyRequestPayload = {
    featureKey: "server_legal_assistant",
    serverId: input.serverId,
    serverCode: input.serverCode,
    question: normalizedInput.normalized_input,
    intent,
    actor_context: actorContext,
    response_mode: responseMode,
    prompt_version: LEGAL_ASSISTANT_PROMPT_VERSION,
    law_version_ids: retrieval.combinedRetrievalRevision.lawCurrentVersionIds,
    law_version_contract: lawVersionContract,
    raw_input: normalizedInput.raw_input,
    normalized_input: normalizedInput.normalized_input,
    normalization_model: normalizedInput.normalization_model,
    normalization_prompt_version: normalizedInput.normalization_prompt_version,
    normalization_changed: normalizedInput.normalization_changed,
    legal_query_plan: legalQueryPlan,
    selected_norm_roles: lawSelection.selected_norm_roles,
    direct_basis_status: lawSelection.direct_basis_status,
    applicability_diagnostics: groundingDiagnostics.candidate_diagnostics,
    grounding_diagnostics: groundingDiagnostics.grounding_diagnostics,
    retrieval_query: retrievalQuery,
    ...retrievalDebugPayload,
    input_trace: inputTrace,
    used_sources: usedSources,
    lawCorpusSnapshot: retrieval.lawCorpusSnapshot,
    precedentCorpusSnapshot: retrieval.precedentCorpusSnapshot,
    combinedRetrievalRevision: retrieval.combinedRetrievalRevision,
    source_ledger: sourceLedger,
    generation_source_budget: generationContext.generation_source_budget,
    generation_sources_count: generationContext.generation_sources_count,
    generation_excerpt_budget: generationContext.generation_excerpt_budget,
    generation_context_chars: generationContext.generation_context_chars,
    generation_context_trimmed: generationContext.generation_context_trimmed,
    answer_mode_effective_budget: generationContext.answer_mode_effective_budget,
    generation_max_output_tokens: generationContext.answer_mode_effective_budget.max_output_tokens,
    test_run_context: input.testRunContext ?? null,
    retrievalResults: retrieval.results.map((result) => {
      if (result.sourceKind === "law") {
        return {
          sourceKind: "law",
          lawKey: result.lawKey,
          lawVersionId: result.lawVersionId,
          lawBlockId: result.lawBlockId,
          blockType: result.blockType,
          articleNumberNormalized: result.articleNumberNormalized,
          sourceTopicUrl: result.sourceTopicUrl,
        };
      }

      return {
        sourceKind: "precedent",
        precedentKey: result.precedentKey,
        precedentVersionId: result.precedentVersionId,
        precedentBlockId: result.precedentBlockId,
        blockType: result.blockType,
        validityStatus: result.validityStatus,
        sourceTopicUrl: result.sourceTopicUrl,
      };
    }),
  };

  if (internalExecutionMode === "core_only") {
    const coreOnlyRequestPayload = {
      ...proxyRequestPayload,
      branch: "core_only",
    };
    const coreOnlyResponsePayload = {
      branch: "core_only",
      lawCorpusSnapshot: retrieval.lawCorpusSnapshot,
      precedentCorpusSnapshot: retrieval.precedentCorpusSnapshot,
      combinedRetrievalRevision: retrieval.combinedRetrievalRevision,
      latencyMs: 0,
      prompt_tokens: null,
      completion_tokens: null,
      total_tokens: null,
      cost_usd: null,
      confidence: answeredSelfAssessment.answer_confidence,
      output_trace: null,
      used_sources: usedSources,
      ...answeredFutureReviewMarker,
      self_assessment: answeredSelfAssessment,
    };
    const storedCoreOnlyRequestPayload = buildAssistantStorageRequestPayload({
      payloadProfile,
      payload: coreOnlyRequestPayload,
      usedSources,
    });
    const storedCoreOnlyResponsePayload = buildAssistantStorageResponsePayload({
      payloadProfile,
      payload: coreOnlyResponsePayload,
    });

    await dependencies.createAIRequest({
      accountId: input.accountId ?? null,
      guestSessionId: input.guestSessionId ?? null,
      serverId: input.serverId,
      featureKey: "server_legal_assistant",
      requestPayloadJson: storedCoreOnlyRequestPayload,
      responsePayloadJson: {
        ...storedCoreOnlyResponsePayload,
        stage_usage: buildAssistantStageUsage({
          normalizationStageUsage,
          normalizationRetryStageUsage,
          responsePayloadJson: storedCoreOnlyResponsePayload,
        }),
      },
      status: "success",
      errorMessage: null,
    });

    return {
      status: "core_only" as const,
      message: null,
      metadata: {
        ...metadataBase,
        ...buildAssistantRunObservability({
          latencyMs: 0,
          usageMetrics: {
            prompt_tokens: null,
            completion_tokens: null,
            total_tokens: null,
            cost_usd: null,
          },
        }),
        review_status: buildAssistantReviewStatus(answeredFutureReviewMarker),
        self_assessment: answeredSelfAssessment,
      },
    };
  }
  const startedAt = dependencies.now();
  const proxyResponse = await dependencies.requestAssistantProxyCompletion({
    systemPrompt: buildAssistantSystemPrompt(),
    userPrompt: buildAssistantUserPrompt({
      serverName: input.serverName,
      question: normalizedInput.normalized_input,
      actorContext,
      responseMode,
      internalExecutionMode,
      generationContext,
      lawSelection,
    }),
    maxOutputTokens: generationContext.answer_mode_effective_budget.max_output_tokens ?? undefined,
    requestMetadata: {
      ...proxyRequestPayload,
      retrievalResultsCount: proxyRequestPayload.retrievalResults.length,
      lawResultsCount: retrieval.lawRetrieval.resultCount,
      precedentResultsCount: retrieval.precedentRetrieval.resultCount,
    },
  });
  const finishedAt = dependencies.now();
  const latencyMs = Math.max(0, finishedAt.getTime() - startedAt.getTime());
  const usageMetrics = extractProxyUsageMetrics(
    "responsePayloadJson" in proxyResponse ? proxyResponse.responsePayloadJson ?? null : null,
  );
  const generationAttempts = proxyResponse.attempts ?? [];
  const generationFinalAttempt = generationAttempts.at(-1) ?? null;
  const generationStageUsage = buildAIStageUsageEntry({
    model: "model" in proxyResponse ? proxyResponse.model ?? null : null,
    prompt_tokens: generationFinalAttempt?.prompt_tokens ?? usageMetrics.prompt_tokens,
    completion_tokens: generationFinalAttempt?.completion_tokens ?? usageMetrics.completion_tokens,
    total_tokens: generationFinalAttempt?.total_tokens ?? usageMetrics.total_tokens,
    cost_usd: generationFinalAttempt?.cost_usd ?? usageMetrics.cost_usd,
    latency_ms: generationFinalAttempt?.latency_ms ?? latencyMs,
  });
  const generationRetryStageUsage = buildProxyRetryStageUsage({
    attempts: generationAttempts,
  });

  if (proxyResponse.status !== "success") {
    const unavailableResponsePayload =
      "responsePayloadJson" in proxyResponse
        ? {
            ...(proxyResponse.responsePayloadJson ?? {}),
            latencyMs,
            prompt_tokens: usageMetrics.prompt_tokens,
            completion_tokens: usageMetrics.completion_tokens,
            total_tokens: usageMetrics.total_tokens,
            cost_usd: usageMetrics.cost_usd,
            confidence: answeredSelfAssessment.answer_confidence,
            output_trace: null,
            used_sources: usedSources,
            ...answeredFutureReviewMarker,
            self_assessment: answeredSelfAssessment,
          }
        : {
            latencyMs,
            prompt_tokens: usageMetrics.prompt_tokens,
            completion_tokens: usageMetrics.completion_tokens,
            total_tokens: usageMetrics.total_tokens,
            cost_usd: usageMetrics.cost_usd,
            confidence: answeredSelfAssessment.answer_confidence,
            output_trace: null,
            used_sources: usedSources,
            ...answeredFutureReviewMarker,
            self_assessment: answeredSelfAssessment,
          };
    const storedProxyRequestPayload = buildAssistantStorageRequestPayload({
      payloadProfile,
      payload: proxyRequestPayload,
      usedSources,
    });
    const storedUnavailableResponsePayload = buildAssistantStorageResponsePayload({
      payloadProfile,
      payload: unavailableResponsePayload,
    });
    const reviewedUnavailableResponsePayload = await attachDeterministicAIQualityReview({
      featureKey: "server_legal_assistant",
      requestPayloadJson: storedProxyRequestPayload,
      responsePayloadJson: storedUnavailableResponsePayload,
    });
    await dependencies.createAIRequest({
      accountId: input.accountId ?? null,
      guestSessionId: input.guestSessionId ?? null,
      serverId: input.serverId,
      featureKey: "server_legal_assistant",
      providerKey: "providerKey" in proxyResponse ? proxyResponse.providerKey ?? null : null,
      proxyKey: "proxyKey" in proxyResponse ? proxyResponse.proxyKey ?? null : null,
      model: "model" in proxyResponse ? proxyResponse.model ?? null : null,
      requestPayloadJson: storedProxyRequestPayload,
      responsePayloadJson: {
        ...reviewedUnavailableResponsePayload,
        stage_usage: buildAssistantStageUsage({
          normalizationStageUsage,
          normalizationRetryStageUsage,
          generationStageUsage,
          generationRetryStageUsage,
          responsePayloadJson: reviewedUnavailableResponsePayload,
        }),
      },
      status: proxyResponse.status === "failure" ? "failure" : "unavailable",
      errorMessage: proxyResponse.message,
    });

    return {
      status: "unavailable" as const,
      message: buildUnavailableMessage(),
      metadata: {
        ...metadataBase,
        ...buildAssistantRunObservability({
          latencyMs,
          usageMetrics,
        }),
        review_status: buildAssistantReviewStatus(answeredFutureReviewMarker),
        self_assessment: buildAssistantSelfAssessment({
          status: "unavailable",
          lawResultCount: retrieval.lawRetrieval.resultCount,
          precedentResultCount: retrieval.precedentRetrieval.resultCount,
          directBasisStatus: lawSelection.direct_basis_status,
        }),
      },
    };
  }

  const parsedSections = parseAssistantAnswerSections(proxyResponse.content);
  const usedSourcesManifest = parseAssistantUsedSourcesManifest(proxyResponse.content);
  const sections = {
    ...parsedSections,
    sources: proxyResponse.content.includes("## Использованные нормы / источники")
      ? parsedSections.sources
      : buildSourcesSectionText(retrieval),
  };
  const answerMarkdown = composeAssistantAnswerMarkdown(sections);
  const answeredUsedSources = inferAssistantUsedSources({
    retrieval,
    lawContext: generationContext.law_sources,
    precedentContext: generationContext.precedent_sources,
    sections,
    manifest: usedSourcesManifest,
  });
  const usedNorms = inferAssistantUsedNorms({
    sourceLedger,
    sections,
    manifest: usedSourcesManifest,
  });
  const answeredSourceLedger = buildAssistantSourceLedgerWithUsedNorms(sourceLedgerBase, usedNorms);
  const answeredLawVersionContract = buildAssistantLawVersionContract({
    retrieval,
    sourceLedger: answeredSourceLedger,
  });
  const answeredRequestPayload = {
    ...proxyRequestPayload,
    law_version_contract: answeredLawVersionContract,
    used_sources: answeredUsedSources,
    source_ledger: answeredSourceLedger,
  };
  const answeredResponsePayload = {
    ...(proxyResponse.responsePayloadJson ?? {}),
    latencyMs,
    prompt_tokens: usageMetrics.prompt_tokens,
    completion_tokens: usageMetrics.completion_tokens,
    total_tokens: usageMetrics.total_tokens,
    cost_usd: usageMetrics.cost_usd,
    confidence: answeredSelfAssessment.answer_confidence,
    output_trace: buildAssistantOutputTrace({
      answerMarkdown,
      sections,
    }),
    answer_markdown_preview: buildAnswerPreview(answerMarkdown),
    answer_sections: sections,
    used_sources_manifest: usedSourcesManifest,
    used_sources: answeredUsedSources,
    ...answeredFutureReviewMarker,
    self_assessment: answeredSelfAssessment,
  };
  const storedAnsweredRequestPayload = buildAssistantStorageRequestPayload({
    payloadProfile,
    payload: answeredRequestPayload,
    usedSources: answeredUsedSources,
  });
  const storedAnsweredResponsePayload = buildAssistantStorageResponsePayload({
    payloadProfile,
    payload: answeredResponsePayload,
    answerSections: sections,
  });
  const reviewedAnsweredResponsePayload = await attachDeterministicAIQualityReview({
    featureKey: "server_legal_assistant",
    requestPayloadJson: storedAnsweredRequestPayload,
    responsePayloadJson: storedAnsweredResponsePayload,
  });

  await dependencies.createAIRequest({
    accountId: input.accountId ?? null,
    guestSessionId: input.guestSessionId ?? null,
    serverId: input.serverId,
    featureKey: "server_legal_assistant",
    providerKey: proxyResponse.providerKey ?? null,
    proxyKey: proxyResponse.proxyKey ?? null,
    model: proxyResponse.model ?? null,
    requestPayloadJson: storedAnsweredRequestPayload,
    responsePayloadJson: {
      ...reviewedAnsweredResponsePayload,
      stage_usage: buildAssistantStageUsage({
        normalizationStageUsage,
        normalizationRetryStageUsage,
        generationStageUsage,
        generationRetryStageUsage,
        responsePayloadJson: reviewedAnsweredResponsePayload,
      }),
    },
    status: "success",
    errorMessage: null,
  });

  return {
    status: "answered" as const,
    answerMarkdown,
    sections,
    metadata: {
      ...metadataBase,
      law_version_contract: answeredLawVersionContract,
      used_sources: answeredUsedSources,
      source_ledger: answeredSourceLedger,
      ...buildAssistantRunObservability({
        latencyMs,
        usageMetrics,
      }),
      review_status: buildAssistantReviewStatus(answeredFutureReviewMarker),
      self_assessment: answeredSelfAssessment,
    },
  };
}
