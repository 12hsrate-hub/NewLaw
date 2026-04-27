export const LEGAL_ASSISTANT_PROMPT_VERSION = "server_legal_assistant_legal_core_v1";
export const DOCUMENT_FIELD_REWRITE_PROMPT_VERSION = "document_field_rewrite_legal_core_v1";
export const GROUNDED_DOCUMENT_FIELD_REWRITE_PROMPT_VERSION =
  "document_field_rewrite_grounded_legal_core_v1";
export const COMPLAINT_NARRATIVE_IMPROVEMENT_PROMPT_VERSION =
  "complaint_narrative_improvement_v1";

export type ProxyUsageMetrics = {
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  cost_usd: number | null;
};

export type AIStageUsageEntry = {
  model: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  estimated_cost_usd: number | null;
  latency_ms: number;
};

type ModelPricingEntry = {
  input_per_1m_tokens_usd: number;
  output_per_1m_tokens_usd: number;
};

export const OPENAI_MODEL_PRICING_USD: Record<string, ModelPricingEntry> = {
  "gpt-5.4": {
    input_per_1m_tokens_usd: 2.5,
    output_per_1m_tokens_usd: 15,
  },
  "gpt-5.4-mini": {
    input_per_1m_tokens_usd: 0.75,
    output_per_1m_tokens_usd: 4.5,
  },
  "gpt-5.4-nano": {
    input_per_1m_tokens_usd: 0.2,
    output_per_1m_tokens_usd: 1.25,
  },
};

function readNumericValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalizedValue = value.trim();

    if (normalizedValue.length === 0) {
      return null;
    }

    const numericValue = Number(normalizedValue);

    return Number.isFinite(numericValue) ? numericValue : null;
  }

  return null;
}

function readRecordValue(
  payload: Record<string, unknown> | null | undefined,
  key: string,
): unknown {
  if (!payload || !(key in payload)) {
    return null;
  }

  return payload[key];
}

function readUsageRecord(payload: Record<string, unknown> | null | undefined) {
  const usage = readRecordValue(payload, "usage");

  return usage && typeof usage === "object" ? (usage as Record<string, unknown>) : null;
}

export function extractProxyUsageMetrics(
  payload: Record<string, unknown> | null | undefined,
): ProxyUsageMetrics {
  const usageRecord = readUsageRecord(payload);

  return {
    prompt_tokens:
      readNumericValue(readRecordValue(usageRecord, "prompt_tokens")) ??
      readNumericValue(readRecordValue(payload, "prompt_tokens")),
    completion_tokens:
      readNumericValue(readRecordValue(usageRecord, "completion_tokens")) ??
      readNumericValue(readRecordValue(payload, "completion_tokens")),
    total_tokens:
      readNumericValue(readRecordValue(usageRecord, "total_tokens")) ??
      readNumericValue(readRecordValue(payload, "total_tokens")),
    cost_usd:
      readNumericValue(readRecordValue(usageRecord, "cost_usd")) ??
      readNumericValue(readRecordValue(usageRecord, "total_cost")) ??
      readNumericValue(readRecordValue(usageRecord, "cost")) ??
      readNumericValue(readRecordValue(payload, "cost_usd")) ??
      readNumericValue(readRecordValue(payload, "total_cost")) ??
      readNumericValue(readRecordValue(payload, "cost")),
  };
}

function roundUsd(value: number) {
  return Number(value.toFixed(6));
}

export function estimateUsageCostUsd(input: {
  model: string | null | undefined;
  prompt_tokens: number | null | undefined;
  completion_tokens: number | null | undefined;
  explicit_cost_usd?: number | null | undefined;
}) {
  if (typeof input.explicit_cost_usd === "number" && Number.isFinite(input.explicit_cost_usd)) {
    return roundUsd(input.explicit_cost_usd);
  }

  if (!input.model) {
    return null;
  }

  const pricingEntry = OPENAI_MODEL_PRICING_USD[input.model];

  if (!pricingEntry) {
    return null;
  }

  const promptTokens =
    typeof input.prompt_tokens === "number" && Number.isFinite(input.prompt_tokens)
      ? input.prompt_tokens
      : 0;
  const completionTokens =
    typeof input.completion_tokens === "number" && Number.isFinite(input.completion_tokens)
      ? input.completion_tokens
      : 0;

  if (promptTokens === 0 && completionTokens === 0) {
    return null;
  }

  return roundUsd(
    (promptTokens / 1_000_000) * pricingEntry.input_per_1m_tokens_usd +
      (completionTokens / 1_000_000) * pricingEntry.output_per_1m_tokens_usd,
  );
}

export function buildAIStageUsageEntry(input: {
  model: string | null | undefined;
  prompt_tokens: number | null | undefined;
  completion_tokens: number | null | undefined;
  total_tokens: number | null | undefined;
  cost_usd?: number | null | undefined;
  latency_ms: number;
}): AIStageUsageEntry {
  return {
    model: input.model ?? null,
    prompt_tokens:
      typeof input.prompt_tokens === "number" && Number.isFinite(input.prompt_tokens)
        ? input.prompt_tokens
        : null,
    completion_tokens:
      typeof input.completion_tokens === "number" && Number.isFinite(input.completion_tokens)
        ? input.completion_tokens
        : null,
    total_tokens:
      typeof input.total_tokens === "number" && Number.isFinite(input.total_tokens)
        ? input.total_tokens
        : null,
    estimated_cost_usd: estimateUsageCostUsd({
      model: input.model ?? null,
      prompt_tokens: input.prompt_tokens ?? null,
      completion_tokens: input.completion_tokens ?? null,
      explicit_cost_usd: input.cost_usd ?? null,
    }),
    latency_ms: Math.max(0, input.latency_ms),
  };
}

export function mergeAIStageUsageEntries(entries: Array<AIStageUsageEntry | null | undefined>) {
  const presentEntries = entries.filter((entry): entry is AIStageUsageEntry => Boolean(entry));

  if (presentEntries.length === 0) {
    return null;
  }

  const uniqueModels = Array.from(
    new Set(presentEntries.map((entry) => entry.model).filter((model): model is string => Boolean(model))),
  );

  const sumField = (field: keyof Pick<
    AIStageUsageEntry,
    "prompt_tokens" | "completion_tokens" | "total_tokens" | "estimated_cost_usd"
  >) => {
    const values = presentEntries
      .map((entry) => entry[field])
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

    if (values.length === 0) {
      return null;
    }

    const total = values.reduce((accumulator, value) => accumulator + value, 0);

    return field === "estimated_cost_usd" ? roundUsd(total) : total;
  };

  return {
    model: uniqueModels.length === 1 ? uniqueModels[0] : uniqueModels.length > 1 ? "multiple" : null,
    prompt_tokens: sumField("prompt_tokens"),
    completion_tokens: sumField("completion_tokens"),
    total_tokens: sumField("total_tokens"),
    estimated_cost_usd: sumField("estimated_cost_usd"),
    latency_ms: presentEntries.reduce((accumulator, entry) => accumulator + entry.latency_ms, 0),
  } satisfies AIStageUsageEntry;
}

export function extractAIReviewerStageUsage(
  payload: Record<string, unknown> | null | undefined,
) {
  if (!payload) {
    return null;
  }

  const aiQualityReview = readRecordValue(payload, "ai_quality_review");
  const aiQualityReviewRecord =
    aiQualityReview && typeof aiQualityReview === "object"
      ? (aiQualityReview as Record<string, unknown>)
      : null;
  const layers = readRecordValue(aiQualityReviewRecord, "layers");
  const layersRecord =
    layers && typeof layers === "object" ? (layers as Record<string, unknown>) : null;
  const aiReviewer = readRecordValue(layersRecord, "ai_reviewer");
  const aiReviewerRecord =
    aiReviewer && typeof aiReviewer === "object" ? (aiReviewer as Record<string, unknown>) : null;

  if (!aiReviewerRecord) {
    return null;
  }

  const status = readRecordValue(aiReviewerRecord, "status");

  if (
    status !== "completed" &&
    status !== "unavailable" &&
    status !== "invalid_output"
  ) {
    return null;
  }

  return buildAIStageUsageEntry({
    model:
      typeof aiReviewerRecord.model === "string" && aiReviewerRecord.model.trim().length > 0
        ? aiReviewerRecord.model
        : null,
    prompt_tokens: readNumericValue(aiReviewerRecord.prompt_tokens),
    completion_tokens: readNumericValue(aiReviewerRecord.completion_tokens),
    total_tokens: readNumericValue(aiReviewerRecord.total_tokens),
    cost_usd: readNumericValue(aiReviewerRecord.cost_usd),
    latency_ms: readNumericValue(aiReviewerRecord.latency_ms) ?? 0,
  });
}
