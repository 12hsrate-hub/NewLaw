export const LEGAL_ASSISTANT_PROMPT_VERSION = "server_legal_assistant_legal_core_v1";
export const DOCUMENT_FIELD_REWRITE_PROMPT_VERSION = "document_field_rewrite_legal_core_v1";
export const GROUNDED_DOCUMENT_FIELD_REWRITE_PROMPT_VERSION =
  "document_field_rewrite_grounded_legal_core_v1";

type ProxyUsageMetrics = {
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  cost_usd: number | null;
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
