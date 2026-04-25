import { requestAssistantProxyCompletion } from "@/server/legal-assistant/ai-proxy";
import {
  buildAIStageUsageEntry,
  mergeAIStageUsageEntries,
} from "@/server/legal-core/observability";

export const LEGAL_INPUT_NORMALIZATION_PROMPT_VERSION = "legal_input_normalization_v1";
export const LEGAL_INPUT_NORMALIZATION_MODEL = "gpt-5.4-nano";

type LegalInputNormalizationDependencies = {
  requestProxyCompletion: typeof requestAssistantProxyCompletion;
};

const defaultDependencies: LegalInputNormalizationDependencies = {
  requestProxyCompletion: requestAssistantProxyCompletion,
};

export type LegalInputNormalizationResult = {
  raw_input: string;
  normalized_input: string;
  normalization_model: string | null;
  normalization_prompt_version: string;
  normalization_changed: boolean;
  normalization_stage_usage: ReturnType<typeof buildAIStageUsageEntry>;
  normalization_retry_stage_usage: ReturnType<typeof mergeAIStageUsageEntries> | null;
};

function normalizeWhitespaceOnly(input: string) {
  return input.trim().replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
}

function buildNormalizationSystemPrompt() {
  return [
    "Ты выполняешь только нормализацию пользовательского юридического текста.",
    "Исправь орфографию и пунктуацию.",
    "Приведи разговорные, ломаные и кривые фразы к понятной нейтральной форме.",
    "Сохрани исходный смысл.",
    "Не добавляй новые факты, доказательства, обстоятельства, правовые выводы и не усиливай позицию автора.",
    "Не удаляй важные факты.",
    "Верни только нормализованный текст без комментариев и без markdown.",
  ].join("\n");
}

function buildNormalizationUserPrompt(rawInput: string) {
  return [
    "Нормализуй этот текст без изменения юридического смысла:",
    rawInput,
  ].join("\n\n");
}

export async function normalizeLegalInputText(
  input: {
    rawInput: string;
    featureKey:
      | "server_legal_assistant"
      | "document_field_rewrite"
      | "document_field_rewrite_grounded";
  },
  dependencies: LegalInputNormalizationDependencies = defaultDependencies,
): Promise<LegalInputNormalizationResult> {
  const rawInput = input.rawInput;
  const fallbackNormalizedInput = normalizeWhitespaceOnly(rawInput);
  const buildFallbackUsage = () =>
    buildAIStageUsageEntry({
      model: LEGAL_INPUT_NORMALIZATION_MODEL,
      prompt_tokens: null,
      completion_tokens: null,
      total_tokens: null,
      cost_usd: null,
      latency_ms: 0,
    });

  if (fallbackNormalizedInput.length === 0) {
    return {
      raw_input: rawInput,
      normalized_input: fallbackNormalizedInput,
      normalization_model: LEGAL_INPUT_NORMALIZATION_MODEL,
      normalization_prompt_version: LEGAL_INPUT_NORMALIZATION_PROMPT_VERSION,
      normalization_changed: fallbackNormalizedInput !== rawInput,
      normalization_stage_usage: buildFallbackUsage(),
      normalization_retry_stage_usage: null,
    };
  }

  const startedAt = Date.now();
  const proxyResponse = await dependencies.requestProxyCompletion({
    systemPrompt: buildNormalizationSystemPrompt(),
    userPrompt: buildNormalizationUserPrompt(rawInput),
    modelOverride: LEGAL_INPUT_NORMALIZATION_MODEL,
    temperature: 0,
    requestMetadata: {
      featureKey: "legal_input_normalization",
      normalization_for_feature: input.featureKey,
      normalization_prompt_version: LEGAL_INPUT_NORMALIZATION_PROMPT_VERSION,
    },
  });
  const latencyMs = Math.max(0, Date.now() - startedAt);
  const normalizationAttempts = proxyResponse.attempts ?? [];
  const finalAttempt = normalizationAttempts.at(-1) ?? null;
  const retryStageUsage = mergeAIStageUsageEntries(
    normalizationAttempts.slice(0, -1).map((attempt) =>
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

  if (proxyResponse.status !== "success") {
    return {
      raw_input: rawInput,
      normalized_input: fallbackNormalizedInput,
      normalization_model: LEGAL_INPUT_NORMALIZATION_MODEL,
      normalization_prompt_version: LEGAL_INPUT_NORMALIZATION_PROMPT_VERSION,
      normalization_changed: fallbackNormalizedInput !== rawInput,
      normalization_stage_usage: buildAIStageUsageEntry({
        model:
          "model" in proxyResponse && typeof proxyResponse.model === "string"
            ? proxyResponse.model
            : LEGAL_INPUT_NORMALIZATION_MODEL,
        prompt_tokens: finalAttempt?.prompt_tokens ?? null,
        completion_tokens: finalAttempt?.completion_tokens ?? null,
        total_tokens: finalAttempt?.total_tokens ?? null,
        cost_usd: finalAttempt?.cost_usd ?? null,
        latency_ms: latencyMs,
      }),
      normalization_retry_stage_usage: retryStageUsage,
    };
  }

  const normalizedInput = normalizeWhitespaceOnly(proxyResponse.content);

  return {
    raw_input: rawInput,
    normalized_input: normalizedInput || fallbackNormalizedInput,
    normalization_model: proxyResponse.model ?? LEGAL_INPUT_NORMALIZATION_MODEL,
    normalization_prompt_version: LEGAL_INPUT_NORMALIZATION_PROMPT_VERSION,
    normalization_changed: (normalizedInput || fallbackNormalizedInput) !== rawInput,
    normalization_stage_usage: buildAIStageUsageEntry({
      model: proxyResponse.model ?? LEGAL_INPUT_NORMALIZATION_MODEL,
      prompt_tokens: finalAttempt?.prompt_tokens ?? null,
      completion_tokens: finalAttempt?.completion_tokens ?? null,
      total_tokens: finalAttempt?.total_tokens ?? null,
      cost_usd: finalAttempt?.cost_usd ?? null,
      latency_ms: latencyMs,
    }),
    normalization_retry_stage_usage: retryStageUsage,
  };
}
