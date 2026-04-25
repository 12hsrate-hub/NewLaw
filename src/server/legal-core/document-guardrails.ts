import type { searchAssistantCorpus } from "@/server/legal-assistant/retrieval";

export type DocumentGuardrailRetrievalResult = Awaited<ReturnType<typeof searchAssistantCorpus>>;

export type DocumentGuardrailUsedSource =
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

export type DocumentLawVersionContract = {
  server_id: string;
  law_corpus_snapshot_hash: string;
  law_version_ids: string[];
  contract_mode: "current_snapshot_only";
  found_norms_outside_current_snapshot: string[];
  context_norms_outside_current_snapshot: string[];
  used_norms_outside_current_snapshot: string[];
  is_current_snapshot_consistent: boolean;
};

export type DocumentSourceUsageStrategy =
  | "boundary_context_default"
  | "grounded_prompt_subset";

export type DocumentSourceLedger = {
  server_id: string;
  law_version_ids: string[];
  found_sources: DocumentGuardrailUsedSource[];
  context_sources: DocumentGuardrailUsedSource[];
  used_sources: DocumentGuardrailUsedSource[];
  used_sources_strategy: DocumentSourceUsageStrategy;
};

function clampText(value: string, maxLength: number) {
  return value.trim().slice(0, maxLength);
}

function collectOutsideSnapshotLawVersionIds(input: {
  lawVersionIds: string[];
  currentLawVersionIds: string[];
}) {
  const currentLawVersionIdSet = new Set(input.currentLawVersionIds);

  return Array.from(
    new Set(
      input.lawVersionIds.filter((lawVersionId) => !currentLawVersionIdSet.has(lawVersionId)),
    ),
  );
}

export function buildDocumentGuardrailSearchQuery(input: {
  sectionLabel: string;
  sourceText: string;
  contextText: string;
  maxLength: number;
}) {
  return clampText(
    [input.sectionLabel, input.sourceText, input.contextText].filter(Boolean).join("\n"),
    input.maxLength,
  );
}

export function buildDocumentGuardrailUsedSources(
  retrieval: DocumentGuardrailRetrievalResult,
  input: {
    lawLimit: number;
    precedentLimit: number;
    mode?: "all" | "law" | "precedent";
  },
): DocumentGuardrailUsedSource[] {
  const mode = input.mode ?? "all";
  const lawSources =
    mode === "precedent"
      ? []
      : retrieval.lawRetrieval.results.slice(0, input.lawLimit).map((result) => ({
          source_kind: "law" as const,
          server_id: result.serverId,
          law_id: result.lawId,
          law_name: result.lawTitle,
          law_version: result.lawVersionId,
          article_number: result.articleNumberNormalized ?? null,
          source_topic_url: result.sourceTopicUrl,
        }));
  const precedentSources =
    mode === "law"
      ? []
      : retrieval.precedentRetrieval.results.slice(0, input.precedentLimit).map((result) => ({
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

export function buildDocumentGuardrailFoundSources(retrieval: DocumentGuardrailRetrievalResult) {
  return buildDocumentGuardrailUsedSources(retrieval, {
    lawLimit: retrieval.lawRetrieval.results.length,
    precedentLimit: retrieval.precedentRetrieval.results.length,
  });
}

export function buildDocumentSourceLedger(input: {
  retrieval: DocumentGuardrailRetrievalResult;
  contextSources: DocumentGuardrailUsedSource[];
  usedSources?: DocumentGuardrailUsedSource[];
  usedSourcesStrategy: DocumentSourceUsageStrategy;
}) {
  return {
    server_id: input.retrieval.serverId,
    law_version_ids: input.retrieval.combinedRetrievalRevision.lawCurrentVersionIds,
    found_sources: buildDocumentGuardrailFoundSources(input.retrieval),
    context_sources: input.contextSources,
    used_sources: input.usedSources ?? input.contextSources,
    used_sources_strategy: input.usedSourcesStrategy,
  } satisfies DocumentSourceLedger;
}

export function buildDocumentLawVersionContract(input: {
  retrieval: DocumentGuardrailRetrievalResult;
  contextSources: DocumentGuardrailUsedSource[];
  usedSources?: DocumentGuardrailUsedSource[];
}) {
  const foundLawVersionIds = input.retrieval.lawRetrieval.results.map((result) => result.lawVersionId);
  const contextLawVersionIds = input.contextSources
    .filter((source): source is Extract<DocumentGuardrailUsedSource, { source_kind: "law" }> => {
      return source.source_kind === "law";
    })
    .map((source) => source.law_version);
  const usedLawVersionIds = (input.usedSources ?? input.contextSources)
    .filter((source): source is Extract<DocumentGuardrailUsedSource, { source_kind: "law" }> => {
      return source.source_kind === "law";
    })
    .map((source) => source.law_version);
  const currentLawVersionIds = input.retrieval.combinedRetrievalRevision.lawCurrentVersionIds;
  const foundOutside = collectOutsideSnapshotLawVersionIds({
    lawVersionIds: foundLawVersionIds,
    currentLawVersionIds,
  });
  const contextOutside = collectOutsideSnapshotLawVersionIds({
    lawVersionIds: contextLawVersionIds,
    currentLawVersionIds,
  });
  const usedOutside = collectOutsideSnapshotLawVersionIds({
    lawVersionIds: usedLawVersionIds,
    currentLawVersionIds,
  });

  return {
    server_id: input.retrieval.serverId,
    law_corpus_snapshot_hash: input.retrieval.lawCorpusSnapshot.corpusSnapshotHash,
    law_version_ids: currentLawVersionIds,
    contract_mode: "current_snapshot_only" as const,
    found_norms_outside_current_snapshot: foundOutside,
    context_norms_outside_current_snapshot: contextOutside,
    used_norms_outside_current_snapshot: usedOutside,
    is_current_snapshot_consistent:
      foundOutside.length === 0 && contextOutside.length === 0 && usedOutside.length === 0,
  } satisfies DocumentLawVersionContract;
}

export function buildDocumentGuardrailContextText(
  retrieval: DocumentGuardrailRetrievalResult,
  input: {
    lawLimit: number;
    precedentLimit: number;
    maxBlockTextLength: number;
    lawLabel?: string;
    precedentLabel?: string;
    buildLawDetails?: (result: DocumentGuardrailRetrievalResult["lawRetrieval"]["results"][number]) => string[];
    buildPrecedentDetails?: (
      result: DocumentGuardrailRetrievalResult["precedentRetrieval"]["results"][number],
    ) => string[];
  },
) {
  const lawLabel = input.lawLabel ?? "Law guardrail";
  const precedentLabel = input.precedentLabel ?? "Precedent guardrail";

  const lawContext = retrieval.lawRetrieval.results
    .slice(0, input.lawLimit)
    .map((result, index) =>
      [
        `${lawLabel} ${index + 1}`,
        `- title: ${result.lawTitle}`,
        `- law_version_id: ${result.lawVersionId}`,
        `- article_number_normalized: ${result.articleNumberNormalized ?? "n/a"}`,
        ...(input.buildLawDetails?.(result) ?? []),
        `- source_topic_url: ${result.sourceTopicUrl}`,
        `- text: ${clampText(result.blockText, input.maxBlockTextLength)}`,
      ].join("\n"),
    )
    .join("\n\n");
  const precedentContext = retrieval.precedentRetrieval.results
    .slice(0, input.precedentLimit)
    .map((result, index) =>
      [
        `${precedentLabel} ${index + 1}`,
        `- title: ${result.precedentTitle}`,
        `- precedent_version_id: ${result.precedentVersionId}`,
        `- validity_status: ${result.validityStatus}`,
        ...(input.buildPrecedentDetails?.(result) ?? []),
        `- source_topic_url: ${result.sourceTopicUrl}`,
        `- text: ${clampText(result.blockText, input.maxBlockTextLength)}`,
      ].join("\n"),
    )
    .join("\n\n");

  return {
    lawContext,
    precedentContext,
    combinedCorpusSnapshotHash: retrieval.combinedRetrievalRevision.combinedCorpusSnapshotHash,
  };
}

export function buildDocumentRewritePolicyLines(input?: {
  includeGuardrailsAsBoundary?: boolean;
  includeGroundedCorpusLine?: boolean;
}) {
  const includeGuardrailsAsBoundary = input?.includeGuardrailsAsBoundary ?? false;
  const includeGroundedCorpusLine = input?.includeGroundedCorpusLine ?? false;

  return [
    "Ты помогаешь переписать одну юридическую секцию документа.",
    includeGroundedCorpusLine
      ? "Работай только как grounded writing assistant."
      : "Работай только как writing assistant, а не как legal assistant.",
    includeGroundedCorpusLine
      ? "Используй только переданный confirmed corpus выбранного сервера."
      : null,
    "Не придумывай новые факты, даты, имена, trustor details, evidence, нормы закона, судебные прецеденты, суммы или требования, которых нет во входных данных и retrieval context.",
    "Не меняй зафиксированные факты из fact ledger.",
    "Не добавляй новые доказательства, статьи закона и категоричные правовые выводы.",
    includeGuardrailsAsBoundary
      ? "Если переданы legal guardrails, используй их только как ограничитель правового контура выбранного сервера."
      : null,
    includeGuardrailsAsBoundary
      ? "Legal guardrails не дают права добавлять статьи, прямые ссылки на нормы или новые правовые тезисы в переписываемый текст."
      : null,
    "Не переписывай весь документ и не давай советы пользователю.",
    "Сохрани фактический смысл исходного текста.",
    "Сделай секцию яснее, структурнее и формальнее.",
    "Допустимо улучшать стиль, структуру, хронологию и убирать эмоции, если фактическое содержание остаётся тем же.",
    "Верни только улучшенную секцию как plain text без markdown и без служебных пояснений.",
  ].filter((line): line is string => Boolean(line));
}
