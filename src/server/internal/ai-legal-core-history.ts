import { listRecentAIRequests } from "@/db/repositories/ai-request.repository";

type ScenarioRunStatus = "success" | "failure" | "unavailable";

export type AILegalCoreScenarioRunSnapshot = {
  scenarioId: string;
  testRunId: string;
  createdAt: string;
  featureKey: string;
  status: ScenarioRunStatus;
  rawInput: string | null;
  normalizedInput: string | null;
  outputPreview: string | null;
  usedSourcesCount: number;
  confidence: string | null;
  insufficientData: boolean | null;
  tokens: number | null;
  costUsd: number | null;
  latencyMs: number | null;
  sentToReview: boolean;
  reviewPriority: string | null;
};

export type AILegalCoreScenarioComparison = {
  scenarioId: string;
  current: AILegalCoreScenarioRunSnapshot;
  previous: AILegalCoreScenarioRunSnapshot | null;
  changed: {
    outputPreview: boolean;
    confidence: boolean;
    insufficientData: boolean;
    sentToReview: boolean;
  };
  deltas: {
    tokens: number | null;
    costUsd: number | null;
    latencyMs: number | null;
    usedSourcesCount: number | null;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readUnknownArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function readScenarioSnapshot(
  entry: Awaited<ReturnType<typeof listRecentAIRequests>>[number],
): AILegalCoreScenarioRunSnapshot | null {
  const requestPayloadJson = isRecord(entry.requestPayloadJson) ? entry.requestPayloadJson : null;
  const responsePayloadJson = isRecord(entry.responsePayloadJson) ? entry.responsePayloadJson : null;
  const testRunContext =
    requestPayloadJson && isRecord(requestPayloadJson.test_run_context)
      ? requestPayloadJson.test_run_context
      : null;

  if (!testRunContext || readString(testRunContext.run_kind) !== "internal_ai_legal_core_test") {
    return null;
  }

  const scenarioId = readString(testRunContext.test_scenario_id);
  const testRunId = readString(testRunContext.test_run_id);

  if (!scenarioId || !testRunId) {
    return null;
  }

  const aiQualityReview =
    responsePayloadJson && isRecord(responsePayloadJson.ai_quality_review)
      ? responsePayloadJson.ai_quality_review
      : null;
  const caseChain = aiQualityReview && isRecord(aiQualityReview.case_chain)
    ? aiQualityReview.case_chain
    : null;
  const selfAssessment =
    responsePayloadJson && isRecord(responsePayloadJson.self_assessment)
      ? responsePayloadJson.self_assessment
      : null;

  return {
    scenarioId,
    testRunId,
    createdAt: entry.createdAt.toISOString(),
    featureKey: entry.featureKey,
    status: entry.status,
    rawInput:
      readString(requestPayloadJson?.raw_input) ??
      (caseChain ? readString(caseChain.raw_input) : null),
    normalizedInput:
      readString(requestPayloadJson?.normalized_input) ??
      (caseChain ? readString(caseChain.normalized_input) : null),
    outputPreview:
      readString(responsePayloadJson?.suggestion_preview) ??
      readString(responsePayloadJson?.answer_markdown_preview) ??
      (caseChain ? readString(caseChain.final_output_preview) : null),
    usedSourcesCount: readUnknownArray(requestPayloadJson?.used_sources).length,
    confidence:
      readString(responsePayloadJson?.confidence) ??
      (selfAssessment ? readString(selfAssessment.answer_confidence) : null),
    insufficientData: selfAssessment ? readBoolean(selfAssessment.insufficient_data) : null,
    tokens: readNumber(responsePayloadJson?.total_tokens),
    costUsd: readNumber(responsePayloadJson?.cost_usd),
    latencyMs: readNumber(responsePayloadJson?.latencyMs) ?? readNumber(responsePayloadJson?.latency_ms),
    sentToReview: responsePayloadJson?.queue_for_future_ai_quality_review === true,
    reviewPriority: readString(responsePayloadJson?.future_review_priority),
  };
}

function buildDelta(current: number | null, previous: number | null) {
  if (current === null || previous === null) {
    return null;
  }

  return Number((current - previous).toFixed(6));
}

export async function getAILegalCoreScenarioComparisons(input: {
  scenarioIds: string[];
  take?: number;
}) {
  const scenarioIds = Array.from(new Set(input.scenarioIds.filter((value) => value.trim().length > 0)));

  if (scenarioIds.length === 0) {
    return new Map<string, AILegalCoreScenarioComparison>();
  }

  const recentRequests = await listRecentAIRequests({
    take: input.take ?? 250,
  });
  const byScenario = new Map<string, AILegalCoreScenarioRunSnapshot[]>();

  for (const entry of recentRequests) {
    const snapshot = readScenarioSnapshot(entry);

    if (!snapshot || !scenarioIds.includes(snapshot.scenarioId)) {
      continue;
    }

    const currentItems = byScenario.get(snapshot.scenarioId) ?? [];

    if (!currentItems.some((item) => item.testRunId === snapshot.testRunId)) {
      currentItems.push(snapshot);
    }

    byScenario.set(snapshot.scenarioId, currentItems);
  }

  const comparisons = new Map<string, AILegalCoreScenarioComparison>();

  for (const scenarioId of scenarioIds) {
    const items = (byScenario.get(scenarioId) ?? [])
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 2);
    const current = items[0];

    if (!current) {
      continue;
    }

    const previous = items[1] ?? null;

    comparisons.set(scenarioId, {
      scenarioId,
      current,
      previous,
      changed: {
        outputPreview:
          previous !== null && (current.outputPreview ?? "") !== (previous.outputPreview ?? ""),
        confidence:
          previous !== null && (current.confidence ?? "") !== (previous.confidence ?? ""),
        insufficientData:
          previous !== null &&
          (current.insufficientData ?? false) !== (previous.insufficientData ?? false),
        sentToReview:
          previous !== null && current.sentToReview !== previous.sentToReview,
      },
      deltas: {
        tokens: buildDelta(current.tokens, previous?.tokens ?? null),
        costUsd: buildDelta(current.costUsd, previous?.costUsd ?? null),
        latencyMs: buildDelta(current.latencyMs, previous?.latencyMs ?? null),
        usedSourcesCount: buildDelta(current.usedSourcesCount, previous?.usedSourcesCount ?? null),
      },
    });
  }

  return comparisons;
}
