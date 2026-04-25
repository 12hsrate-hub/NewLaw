import { createAIRequest } from "@/db/repositories/ai-request.repository";
import { requestAssistantProxyCompletion } from "@/server/legal-assistant/ai-proxy";
import { searchAssistantCorpus } from "@/server/legal-assistant/retrieval";
import {
  buildDocumentGuardrailContextText,
  buildDocumentGuardrailSearchQuery,
  buildDocumentGuardrailUsedSources,
  buildDocumentLawVersionContract,
  buildDocumentRewritePolicyLines,
  buildDocumentSourceLedger,
} from "@/server/legal-core/document-guardrails";
import {
  type LegalCoreActorContext,
  type LegalCoreResponseMode,
  buildDocumentRewriteSelfAssessment,
} from "@/server/legal-core/metadata";
import { normalizeLegalInputText } from "@/server/legal-core/input-normalization";
import { extractProxyUsageMetrics } from "@/server/legal-core/observability";
import { attachDeterministicAIQualityReview } from "@/server/legal-core/quality-review";
import { buildDocumentRewriteFutureReviewMarker } from "@/server/legal-core/review-routing";

const INTERNAL_DOCUMENT_TEXT_IMPROVEMENT_FEATURE_KEY = "document_field_rewrite";
const INTERNAL_DOCUMENT_TEXT_IMPROVEMENT_PROMPT_VERSION =
  "internal_document_text_improvement_test_v1";
const MAX_SOURCE_TEXT_LENGTH = 6_000;
const MAX_SEARCH_QUERY_LENGTH = 1_400;
const MAX_CONTEXT_TEXT_LENGTH = 1_500;
const MAX_LAW_BLOCKS = 3;
const MAX_PRECEDENT_BLOCKS = 2;
const MAX_BLOCK_TEXT_LENGTH = 700;
const MAX_PREVIEW_LENGTH = 220;

type InternalDocumentTextImprovementTestRunContext = {
  run_kind: "internal_ai_legal_core_test";
  server_id: string;
  server_code: string;
  test_run_id: string;
  test_scenario_id: string;
  test_scenario_group: string;
  test_scenario_title: string;
  law_version_selection: "current_snapshot_only";
};

type InternalDocumentTextImprovementDependencies = {
  searchAssistantCorpus: typeof searchAssistantCorpus;
  requestProxyCompletion: typeof requestAssistantProxyCompletion;
  normalizeInputText?: typeof normalizeLegalInputText;
  createAIRequest: typeof createAIRequest;
  now: () => Date;
};

const defaultDependencies: InternalDocumentTextImprovementDependencies = {
  searchAssistantCorpus,
  requestProxyCompletion: requestAssistantProxyCompletion,
  createAIRequest,
  now: () => new Date(),
};

type InternalDocumentRewriteFactLedger = {
  participants: string[];
  event: string | null;
  date_time: string | null;
  organization: string | null;
  evidence: string[];
  missing_data: string[];
};

function clampText(value: string, maxLength: number) {
  return value.trim().slice(0, maxLength);
}

function collectUnique(values: string[]) {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

function extractOrganization(sourceText: string) {
  const matches = sourceText.match(/\b(LSPD|FIB|OGP|GOV|EMS|BCSO|SANG)\b/gi) ?? [];

  return matches.length > 0 ? matches[0]!.toUpperCase() : null;
}

function extractDateTime(sourceText: string) {
  const match =
    sourceText.match(/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/) ??
    sourceText.match(/\b\d{1,2}:\d{2}\b/);

  return match?.[0] ?? null;
}

function extractParticipants(sourceText: string, actorContext: LegalCoreActorContext) {
  const lowered = sourceText.toLowerCase();
  const participants = [
    lowered.includes("доверител") ? "доверитель" : "",
    lowered.includes("клиент") ? "клиент" : "",
    lowered.includes("сотрудник") ? "сотрудник" : "",
    lowered.includes("адвокат") ? "адвокат" : "",
    lowered.includes("руководств") ? "руководство" : "",
    actorContext === "self" ? "заявитель" : "",
    actorContext === "representative_for_trustor" ? "представитель доверителя" : "",
  ];

  return collectUnique(participants);
}

function extractEvidence(sourceText: string) {
  const lowered = sourceText.toLowerCase();
  const evidence: string[] = [];

  if (lowered.includes("бодикам")) {
    evidence.push("бодикам");
  }

  if (lowered.includes("видео") || lowered.includes("запись")) {
    evidence.push("видео/запись");
  }

  if (lowered.includes("договор")) {
    evidence.push("договор");
  }

  if (lowered.includes("запрос")) {
    evidence.push("запрос");
  }

  if (lowered.includes("штраф")) {
    evidence.push("штраф");
  }

  return collectUnique(evidence);
}

function buildInternalDocumentRewriteFactLedger(input: {
  sourceText: string;
  actorContext: LegalCoreActorContext;
}): InternalDocumentRewriteFactLedger {
  const participants = extractParticipants(input.sourceText, input.actorContext);
  const dateTime = extractDateTime(input.sourceText);
  const organization = extractOrganization(input.sourceText);
  const evidence = extractEvidence(input.sourceText);
  const missingData = [
    participants.length > 0 ? null : "participants",
    input.sourceText.trim().length > 0 ? null : "event",
    dateTime ? null : "date_time",
    organization ? null : "organization",
    evidence.length > 0 ? null : "evidence",
  ].filter((value): value is string => Boolean(value));

  return {
    participants,
    event: clampText(input.sourceText, 240) || null,
    date_time: dateTime,
    organization,
    evidence,
    missing_data: missingData,
  };
}

function buildResponseModeInstruction(responseMode: LegalCoreResponseMode) {
  switch (responseMode) {
    case "short":
      return "Сделай текст короче и компактнее, но не жертвуй смыслом.";
    case "detailed":
      return "Сделай текст более подробным и лучше выстроенным по хронологии, не добавляя новых фактов.";
    case "document_ready":
      return "Сделай текст максимально пригодным для вставки в жалобу или процессуальный документ.";
    default:
      return "Сделай текст нейтральным, ясным и пригодным для юридической описательной части.";
  }
}

function buildRewriteSystemPrompt(responseMode: LegalCoreResponseMode) {
  return [
    ...buildDocumentRewritePolicyLines({
      includeGuardrailsAsBoundary: true,
    }),
    buildResponseModeInstruction(responseMode),
    "Не используй markdown, заголовки, списки и служебные комментарии.",
    "Верни только улучшенную описательную часть как plain text.",
  ].join("\n");
}

function buildContextText(input: {
  actorContext: LegalCoreActorContext;
  responseMode: LegalCoreResponseMode;
}) {
  return clampText(
    [`actor_context: ${input.actorContext}`, `response_mode: ${input.responseMode}`].join("\n"),
    MAX_CONTEXT_TEXT_LENGTH,
  );
}

function buildRewriteUserPrompt(input: {
  serverName: string;
  sourceText: string;
  actorContext: LegalCoreActorContext;
  responseMode: LegalCoreResponseMode;
  factLedger: InternalDocumentRewriteFactLedger;
  guardrailContext: {
    combinedCorpusSnapshotHash: string;
    lawContext: string;
    precedentContext: string;
  };
  lawVersionIds: string[];
}) {
  return [
    `Сервер: ${input.serverName}`,
    "Тип прохода: internal AI Legal Core test scenario",
    `Actor context: ${input.actorContext}`,
    `Response mode: ${input.responseMode}`,
    "",
    "Исходный текст описательной части:",
    clampText(input.sourceText, MAX_SOURCE_TEXT_LENGTH) || "(пусто)",
    "",
    "Fact ledger:",
    JSON.stringify(input.factLedger, null, 2),
    "",
    "Legal guardrails:",
    `Combined corpus snapshot hash: ${input.guardrailContext.combinedCorpusSnapshotHash}`,
    `Law version contract: current_snapshot_only (${input.lawVersionIds.join(", ") || "none"})`,
    input.guardrailContext.lawContext || "Подходящие legal guardrails по нормам закона не найдены.",
    input.guardrailContext.precedentContext ||
      "Подходящие legal guardrails по подтверждённым прецедентам не найдены.",
    "",
    "Улучши только описательную часть.",
    "Разрешено: улучшать стиль, структуру, хронологию, убирать эмоции и сленг.",
    "Запрещено: добавлять факты, доказательства, ФИО, даты, организации, статьи и категоричные выводы.",
  ].join("\n");
}

function buildInputTrace(input: {
  rawInput: string;
  normalizedInput: string;
  actorContext: LegalCoreActorContext;
  responseMode: LegalCoreResponseMode;
}) {
  return {
    input_kind: "internal_document_text_improvement",
    raw_input_preview: clampText(input.rawInput, MAX_PREVIEW_LENGTH),
    raw_input_length: input.rawInput.trim().length,
    normalized_input_preview: clampText(input.normalizedInput, MAX_PREVIEW_LENGTH),
    normalized_input_length: input.normalizedInput.trim().length,
    actor_context: input.actorContext,
    response_mode: input.responseMode,
  };
}

function buildOutputTrace(input: { suggestionText: string }) {
  return {
    output_kind: "internal_document_text_improvement_plain_text",
    output_preview: clampText(input.suggestionText, MAX_PREVIEW_LENGTH),
    output_length: input.suggestionText.length,
  };
}

export async function runInternalDocumentTextImprovementScenario(
  input: {
    serverId: string;
    serverCode: string;
    serverName: string;
    sourceText: string;
    actorContext: LegalCoreActorContext;
    responseMode: LegalCoreResponseMode;
    accountId: string;
    testRunContext: InternalDocumentTextImprovementTestRunContext;
  },
  dependencies: InternalDocumentTextImprovementDependencies = defaultDependencies,
) {
  const normalizeInputText = dependencies.normalizeInputText ?? normalizeLegalInputText;
  const normalizedInput = await normalizeInputText({
    rawInput: input.sourceText,
    featureKey: INTERNAL_DOCUMENT_TEXT_IMPROVEMENT_FEATURE_KEY,
  });
  const normalizedSourceText = clampText(normalizedInput.normalized_input, MAX_SOURCE_TEXT_LENGTH);
  const factLedger = buildInternalDocumentRewriteFactLedger({
    sourceText: normalizedSourceText,
    actorContext: input.actorContext,
  });
  const selfAssessment = buildDocumentRewriteSelfAssessment({
    missingDataCount: factLedger.missing_data.length,
    sourceLength: normalizedSourceText.length,
  });
  const retrieval = await dependencies.searchAssistantCorpus({
    serverId: input.serverId,
    query: buildDocumentGuardrailSearchQuery({
      sectionLabel: "Описательная часть",
      sourceText: normalizedSourceText,
      contextText: buildContextText({
        actorContext: input.actorContext,
        responseMode: input.responseMode,
      }),
      maxLength: MAX_SEARCH_QUERY_LENGTH,
    }),
    lawLimit: MAX_LAW_BLOCKS,
    precedentLimit: MAX_PRECEDENT_BLOCKS,
  });
  const usedSources = buildDocumentGuardrailUsedSources(retrieval, {
    lawLimit: MAX_LAW_BLOCKS,
    precedentLimit: MAX_PRECEDENT_BLOCKS,
  });
  const sourceLedger = buildDocumentSourceLedger({
    retrieval,
    contextSources: usedSources,
    usedSourcesStrategy: "boundary_context_default",
  });
  const lawVersionContract = buildDocumentLawVersionContract({
    retrieval,
    contextSources: sourceLedger.context_sources,
    usedSources: sourceLedger.used_sources,
  });
  const guardrailContext = buildDocumentGuardrailContextText(retrieval, {
    lawLimit: MAX_LAW_BLOCKS,
    precedentLimit: MAX_PRECEDENT_BLOCKS,
    maxBlockTextLength: MAX_BLOCK_TEXT_LENGTH,
  });
  const inputTrace = buildInputTrace({
    rawInput: normalizedInput.raw_input,
    normalizedInput: normalizedInput.normalized_input,
    actorContext: input.actorContext,
    responseMode: input.responseMode,
  });
  const successFutureReviewMarker = buildDocumentRewriteFutureReviewMarker({
    selfAssessment,
    status: "success",
    missingDataCount: factLedger.missing_data.length,
    usedSourceCount: usedSources.length,
    lawVersionContractConsistent: lawVersionContract.is_current_snapshot_consistent,
  });
  const unavailableFutureReviewMarker = buildDocumentRewriteFutureReviewMarker({
    selfAssessment,
    status: "unavailable",
    missingDataCount: factLedger.missing_data.length,
    usedSourceCount: usedSources.length,
    lawVersionContractConsistent: lawVersionContract.is_current_snapshot_consistent,
  });
  const requestPayloadBase = {
    featureKey: INTERNAL_DOCUMENT_TEXT_IMPROVEMENT_FEATURE_KEY,
    serverId: input.serverId,
    serverCode: input.serverCode,
    serverName: input.serverName,
    intent: "document_text_improvement",
    actor_context: input.actorContext,
    response_mode: input.responseMode,
    prompt_version: INTERNAL_DOCUMENT_TEXT_IMPROVEMENT_PROMPT_VERSION,
    raw_input: normalizedInput.raw_input,
    normalized_input: normalizedInput.normalized_input,
    normalization_model: normalizedInput.normalization_model,
    normalization_prompt_version: normalizedInput.normalization_prompt_version,
    normalization_changed: normalizedInput.normalization_changed,
    law_version_ids: retrieval.combinedRetrievalRevision.lawCurrentVersionIds,
    law_version_contract: lawVersionContract,
    input_trace: inputTrace,
    combinedRetrievalRevision: retrieval.combinedRetrievalRevision,
    used_sources: usedSources,
    source_ledger: sourceLedger,
    fact_ledger: factLedger,
    test_run_context: input.testRunContext,
  };

  const startedAt = dependencies.now();
  const proxyResponse = await dependencies.requestProxyCompletion({
    systemPrompt: buildRewriteSystemPrompt(input.responseMode),
    userPrompt: buildRewriteUserPrompt({
      serverName: input.serverName,
      sourceText: normalizedSourceText,
      actorContext: input.actorContext,
      responseMode: input.responseMode,
      factLedger,
      guardrailContext,
      lawVersionIds: retrieval.combinedRetrievalRevision.lawCurrentVersionIds,
    }),
    requestMetadata: {
      ...requestPayloadBase,
      lawResultsCount: retrieval.lawRetrieval.resultCount,
      precedentResultsCount: retrieval.precedentRetrieval.resultCount,
    },
  });
  const finishedAt = dependencies.now();
  const latencyMs = Math.max(0, finishedAt.getTime() - startedAt.getTime());
  const usageMetrics = extractProxyUsageMetrics(
    "responsePayloadJson" in proxyResponse ? proxyResponse.responsePayloadJson ?? null : null,
  );

  if (proxyResponse.status !== "success") {
    const unavailableResponsePayload = {
      latencyMs,
      prompt_tokens: usageMetrics.prompt_tokens,
      completion_tokens: usageMetrics.completion_tokens,
      total_tokens: usageMetrics.total_tokens,
      cost_usd: usageMetrics.cost_usd,
      confidence: selfAssessment.answer_confidence,
      output_trace: null,
      ...unavailableFutureReviewMarker,
      self_assessment: selfAssessment,
    };

    await dependencies.createAIRequest({
      accountId: input.accountId,
      serverId: input.serverId,
      featureKey: INTERNAL_DOCUMENT_TEXT_IMPROVEMENT_FEATURE_KEY,
      providerKey: "providerKey" in proxyResponse ? proxyResponse.providerKey ?? null : null,
      proxyKey: "proxyKey" in proxyResponse ? proxyResponse.proxyKey ?? null : null,
      model: "model" in proxyResponse ? proxyResponse.model ?? null : null,
      requestPayloadJson: requestPayloadBase,
      responsePayloadJson: await attachDeterministicAIQualityReview({
        featureKey: INTERNAL_DOCUMENT_TEXT_IMPROVEMENT_FEATURE_KEY,
        requestPayloadJson: requestPayloadBase,
        responsePayloadJson: unavailableResponsePayload,
      }),
      status: proxyResponse.status,
      errorMessage: proxyResponse.message,
    });

    return {
      status: "unavailable" as const,
      message: "AI-доработка описательной части сейчас недоступна. Попробуй ещё раз позже.",
      metadata: {
        ...requestPayloadBase,
        latency_ms: latencyMs,
        prompt_tokens: usageMetrics.prompt_tokens,
        completion_tokens: usageMetrics.completion_tokens,
        total_tokens: usageMetrics.total_tokens,
        cost_usd: usageMetrics.cost_usd,
        review_status: unavailableFutureReviewMarker,
        self_assessment: selfAssessment,
      },
    };
  }

  const suggestionText = proxyResponse.content.trim();
  const successResponsePayload = {
    latencyMs,
    prompt_tokens: usageMetrics.prompt_tokens,
    completion_tokens: usageMetrics.completion_tokens,
    total_tokens: usageMetrics.total_tokens,
    cost_usd: usageMetrics.cost_usd,
    confidence: selfAssessment.answer_confidence,
    output_trace: buildOutputTrace({
      suggestionText,
    }),
    suggestion_preview: clampText(suggestionText, MAX_PREVIEW_LENGTH),
    ...successFutureReviewMarker,
    self_assessment: selfAssessment,
  };

  await dependencies.createAIRequest({
    accountId: input.accountId,
    serverId: input.serverId,
    featureKey: INTERNAL_DOCUMENT_TEXT_IMPROVEMENT_FEATURE_KEY,
    providerKey: proxyResponse.providerKey ?? null,
    proxyKey: proxyResponse.proxyKey ?? null,
    model: proxyResponse.model ?? null,
    requestPayloadJson: requestPayloadBase,
    responsePayloadJson: await attachDeterministicAIQualityReview({
      featureKey: INTERNAL_DOCUMENT_TEXT_IMPROVEMENT_FEATURE_KEY,
      requestPayloadJson: requestPayloadBase,
      responsePayloadJson: successResponsePayload,
    }),
    status: "success",
    errorMessage: null,
  });

  return {
    status: "rewritten" as const,
    sourceText: input.sourceText,
    suggestionText,
    metadata: {
      ...requestPayloadBase,
      latency_ms: latencyMs,
      prompt_tokens: usageMetrics.prompt_tokens,
      completion_tokens: usageMetrics.completion_tokens,
      total_tokens: usageMetrics.total_tokens,
      cost_usd: usageMetrics.cost_usd,
      review_status: successFutureReviewMarker,
      self_assessment: selfAssessment,
    },
  };
}
