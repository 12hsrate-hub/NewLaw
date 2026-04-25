import { listRecentAIRequests } from "@/db/repositories/ai-request.repository";

type ReviewQueuePriority = "low" | "medium" | "high";
type ReviewRootCause =
  | "normalization_issue"
  | "law_basis_issue"
  | "availability_issue"
  | "input_quality_issue"
  | "generation_issue"
  | "unknown";

type ReviewRunSource = "user_flow" | "test_run";

type ReviewTestRunContext = {
  serverId: string | null;
  serverCode: string | null;
  testRunId: string;
  testScenarioId: string;
  testScenarioGroup: string;
  testScenarioTitle: string | null;
  lawVersionSelection: string | null;
};

export type InternalAIQualityReviewQueueItem = {
  id: string;
  createdAt: string;
  featureKey: string;
  model: string | null;
  status: "success" | "failure" | "unavailable";
  queueForSuperAdmin: boolean;
  priority: ReviewQueuePriority;
  qualityScore: number | null;
  confidence: "low" | "medium" | "high" | null;
  rootCause: ReviewRootCause;
  inputQuality: "low" | "medium" | "high" | null;
  flags: string[];
  reviewItems: string[];
  issueClusterKey: string | null;
  fixTarget: string | null;
  account: {
    id: string;
    login: string;
    email: string;
  } | null;
  server: {
    id: string;
    code: string;
    name: string;
  } | null;
  runSource: ReviewRunSource;
  testRunContext: ReviewTestRunContext | null;
  caseChain: {
    rawInput: string | null;
    normalizedInput: string | null;
    normalizationModel: string | null;
    normalizationPromptVersion: string | null;
    normalizationChanged: boolean;
    normalizationComparisonResult: string | null;
    retrievedSources: unknown[];
    finalOutputPreview: string | null;
  };
  aiReviewerStatus: "not_run" | "unavailable" | "invalid_output" | "completed" | null;
  outputPreview: string | null;
};

export type InternalAIQualityReviewCounterItem = {
  key: string;
  count: number;
};

export type InternalAIQualityReviewAnalytics = {
  reviewedCount: number;
  queuedCount: number;
  totalTokens: number;
  totalCostUsd: number;
  byRootCause: InternalAIQualityReviewCounterItem[];
  byFlag: InternalAIQualityReviewCounterItem[];
  byPromptVersion: InternalAIQualityReviewCounterItem[];
  byLawVersion: InternalAIQualityReviewCounterItem[];
  byFixTarget: InternalAIQualityReviewCounterItem[];
  byRunSource: InternalAIQualityReviewCounterItem[];
  byTestScenarioGroup: InternalAIQualityReviewCounterItem[];
};

export type InternalAIQualityReviewPreview = {
  queuedCount: number;
  byPriority: {
    high: number;
    medium: number;
    low: number;
  };
  analytics: InternalAIQualityReviewAnalytics;
  recentQueuedItems: InternalAIQualityReviewQueueItem[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readBoolean(value: unknown) {
  return value === true;
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readUnknownArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function readTestRunContext(
  requestPayloadJson: Record<string, unknown> | null,
): ReviewTestRunContext | null {
  const raw = requestPayloadJson && isRecord(requestPayloadJson.test_run_context)
    ? requestPayloadJson.test_run_context
    : null;

  if (!raw) {
    return null;
  }

  const testRunId = readString(raw.test_run_id);
  const testScenarioId = readString(raw.test_scenario_id);
  const testScenarioGroup = readString(raw.test_scenario_group);

  if (!testRunId || !testScenarioId || !testScenarioGroup) {
    return null;
  }

  return {
    serverId: readString(raw.server_id),
    serverCode: readString(raw.server_code),
    testRunId,
    testScenarioId,
    testScenarioGroup,
    testScenarioTitle: readString(raw.test_scenario_title),
    lawVersionSelection: readString(raw.law_version_selection),
  };
}

function readAIReviewerStatus(
  value: unknown,
): InternalAIQualityReviewQueueItem["aiReviewerStatus"] {
  return value === "not_run" ||
    value === "unavailable" ||
    value === "invalid_output" ||
    value === "completed"
    ? value
    : null;
}

function incrementCounter(map: Map<string, number>, key: string | null) {
  if (!key) {
    return;
  }

  map.set(key, (map.get(key) ?? 0) + 1);
}

function mapToSortedCounters(map: Map<string, number>): InternalAIQualityReviewCounterItem[] {
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return left.key.localeCompare(right.key);
    });
}

function toQueueItem(
  entry: Awaited<ReturnType<typeof listRecentAIRequests>>[number],
): InternalAIQualityReviewQueueItem | null {
  const requestPayloadJson = isRecord(entry.requestPayloadJson) ? entry.requestPayloadJson : null;
  const responsePayloadJson = isRecord(entry.responsePayloadJson) ? entry.responsePayloadJson : null;
  const aiQualityReview = responsePayloadJson && isRecord(responsePayloadJson.ai_quality_review)
    ? responsePayloadJson.ai_quality_review
    : null;

  if (!aiQualityReview) {
    return null;
  }

  const priorityValue = readString(aiQualityReview.risk_level);
  const priority: ReviewQueuePriority =
    priorityValue === "high" || priorityValue === "medium" ? priorityValue : "low";
  const rootCauseValue = readString(aiQualityReview.root_cause);
  const rootCause: ReviewRootCause =
    rootCauseValue === "normalization_issue" ||
    rootCauseValue === "law_basis_issue" ||
    rootCauseValue === "availability_issue" ||
    rootCauseValue === "input_quality_issue" ||
    rootCauseValue === "generation_issue"
      ? rootCauseValue
      : "unknown";
  const caseChain = isRecord(aiQualityReview.case_chain) ? aiQualityReview.case_chain : null;
  const layers = isRecord(aiQualityReview.layers) ? aiQualityReview.layers : null;
  const aiReviewer = layers && isRecord(layers.ai_reviewer) ? layers.ai_reviewer : null;
  const confidenceValue = readString(aiQualityReview.confidence);
  const inputQualityValue = readString(aiQualityReview.input_quality);
  const testRunContext = readTestRunContext(requestPayloadJson);

  return {
    id: entry.id,
    createdAt: entry.createdAt.toISOString(),
    featureKey: entry.featureKey,
    model: entry.model,
    status: entry.status,
    queueForSuperAdmin: readBoolean(aiQualityReview.queue_for_super_admin),
    priority,
    qualityScore: readNumber(aiQualityReview.quality_score),
    confidence:
      confidenceValue === "low" || confidenceValue === "medium" || confidenceValue === "high"
        ? confidenceValue
        : null,
    rootCause,
    inputQuality:
      inputQualityValue === "low" ||
      inputQualityValue === "medium" ||
      inputQualityValue === "high"
        ? inputQualityValue
        : null,
    flags: readStringArray(aiQualityReview.flags),
    reviewItems: readStringArray(aiQualityReview.review_items),
    issueClusterKey: readString(aiQualityReview.issue_cluster_key),
    fixTarget: readString(aiQualityReview.fix_target),
    account: entry.account
      ? {
          id: entry.account.id,
          login: entry.account.login,
          email: entry.account.email,
        }
      : null,
    server: entry.server
      ? {
          id: entry.server.id,
          code: entry.server.code,
          name: entry.server.name,
        }
      : null,
    runSource: testRunContext ? "test_run" : "user_flow",
    testRunContext,
    caseChain: {
      rawInput: caseChain ? readString(caseChain.raw_input) : null,
      normalizedInput: caseChain ? readString(caseChain.normalized_input) : null,
      normalizationModel: caseChain ? readString(caseChain.normalization_model) : null,
      normalizationPromptVersion: caseChain
        ? readString(caseChain.normalization_prompt_version)
        : null,
      normalizationChanged: caseChain ? readBoolean(caseChain.normalization_changed) : false,
      normalizationComparisonResult: caseChain
        ? readString(caseChain.normalization_comparison_result)
        : null,
      retrievedSources: caseChain ? readUnknownArray(caseChain.retrieved_sources) : [],
      finalOutputPreview: caseChain ? readString(caseChain.final_output_preview) : null,
    },
    aiReviewerStatus: aiReviewer ? readAIReviewerStatus(aiReviewer.status) : null,
    outputPreview: caseChain ? readString(caseChain.final_output_preview) : null,
  };
}

export async function getInternalAIQualityReviewPreview(): Promise<InternalAIQualityReviewPreview> {
  const recentRequests = await listRecentAIRequests({ take: 100 });
  const reviewItems = recentRequests.map(toQueueItem).filter((item) => item !== null);
  const queuedItems = reviewItems.filter((item) => item.queueForSuperAdmin);
  const byRootCause = new Map<string, number>();
  const byFlag = new Map<string, number>();
  const byPromptVersion = new Map<string, number>();
  const byLawVersion = new Map<string, number>();
  const byFixTarget = new Map<string, number>();
  const byRunSource = new Map<string, number>();
  const byTestScenarioGroup = new Map<string, number>();
  let totalTokens = 0;
  let totalCostUsd = 0;

  for (const request of recentRequests) {
    const responsePayloadJson = isRecord(request.responsePayloadJson) ? request.responsePayloadJson : null;
    const requestPayloadJson = isRecord(request.requestPayloadJson) ? request.requestPayloadJson : null;
    const aiQualityReview =
      responsePayloadJson && isRecord(responsePayloadJson.ai_quality_review)
        ? responsePayloadJson.ai_quality_review
        : null;

    if (!aiQualityReview || aiQualityReview.queue_for_super_admin !== true) {
      continue;
    }

    incrementCounter(byRootCause, readString(aiQualityReview.root_cause));
    incrementCounter(byFixTarget, readString(aiQualityReview.fix_target));
    incrementCounter(
      byRunSource,
      readTestRunContext(requestPayloadJson) ? "test_run" : "user_flow",
    );
    incrementCounter(
      byTestScenarioGroup,
      readTestRunContext(requestPayloadJson)?.testScenarioGroup ?? null,
    );

    for (const flag of readStringArray(aiQualityReview.flags)) {
      incrementCounter(byFlag, flag);
    }

    if (requestPayloadJson) {
      incrementCounter(byPromptVersion, readString(requestPayloadJson.prompt_version));

      for (const lawVersionId of readStringArray(requestPayloadJson.law_version_ids)) {
        incrementCounter(byLawVersion, lawVersionId);
      }
    }

    totalTokens += readNumber(responsePayloadJson?.total_tokens) ?? 0;
    totalCostUsd += readNumber(responsePayloadJson?.cost_usd) ?? 0;
  }

  return {
    queuedCount: queuedItems.length,
    byPriority: {
      high: queuedItems.filter((item) => item.priority === "high").length,
      medium: queuedItems.filter((item) => item.priority === "medium").length,
      low: queuedItems.filter((item) => item.priority === "low").length,
    },
    analytics: {
      reviewedCount: reviewItems.length,
      queuedCount: queuedItems.length,
      totalTokens,
      totalCostUsd: Number(totalCostUsd.toFixed(6)),
      byRootCause: mapToSortedCounters(byRootCause),
      byFlag: mapToSortedCounters(byFlag),
      byPromptVersion: mapToSortedCounters(byPromptVersion),
      byLawVersion: mapToSortedCounters(byLawVersion),
      byFixTarget: mapToSortedCounters(byFixTarget),
      byRunSource: mapToSortedCounters(byRunSource),
      byTestScenarioGroup: mapToSortedCounters(byTestScenarioGroup),
    },
    recentQueuedItems: queuedItems.slice(0, 5),
  };
}
