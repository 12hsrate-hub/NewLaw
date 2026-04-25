import { describe, expect, it, vi } from "vitest";

import {
  LEGAL_INPUT_NORMALIZATION_MODEL,
  LEGAL_INPUT_NORMALIZATION_PROMPT_VERSION,
  normalizeLegalInputText,
} from "@/server/legal-core/input-normalization";

describe("legal input normalization", () => {
  it("использует nano model override и возвращает normalized input", async () => {
    const requestProxyCompletion = vi.fn().mockResolvedValue({
      status: "success",
      content: "Исправленный и нейтральный текст.",
      model: LEGAL_INPUT_NORMALIZATION_MODEL,
      attempts: [
        {
          proxyKey: "primary",
          providerKey: "openai_compatible",
          model: LEGAL_INPUT_NORMALIZATION_MODEL,
          status: "success",
          latency_ms: 120,
          prompt_tokens: 80,
          completion_tokens: 20,
          total_tokens: 100,
          cost_usd: null,
        },
      ],
    });

    const result = await normalizeLegalInputText(
      {
        rawInput: "испраленный   текст!!",
        featureKey: "server_legal_assistant",
      },
      {
        requestProxyCompletion,
      },
    );

    expect(requestProxyCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        modelOverride: LEGAL_INPUT_NORMALIZATION_MODEL,
        temperature: 0,
        requestMetadata: expect.objectContaining({
          featureKey: "legal_input_normalization",
          normalization_for_feature: "server_legal_assistant",
          normalization_prompt_version: LEGAL_INPUT_NORMALIZATION_PROMPT_VERSION,
        }),
      }),
    );
    expect(result).toEqual({
      raw_input: "испраленный   текст!!",
      normalized_input: "Исправленный и нейтральный текст.",
      normalization_model: LEGAL_INPUT_NORMALIZATION_MODEL,
      normalization_prompt_version: LEGAL_INPUT_NORMALIZATION_PROMPT_VERSION,
      normalization_changed: true,
      normalization_stage_usage: {
        model: LEGAL_INPUT_NORMALIZATION_MODEL,
        prompt_tokens: 80,
        completion_tokens: 20,
        total_tokens: 100,
        estimated_cost_usd: 0.000041,
        latency_ms: expect.any(Number),
      },
      normalization_retry_stage_usage: null,
    });
  });

  it("fallback-ит к whitespace normalization, если proxy недоступен", async () => {
    const result = await normalizeLegalInputText(
      {
        rawInput: "  текст \r\n\r\n\r\n с   пробелами  ",
        featureKey: "document_field_rewrite",
      },
      {
        requestProxyCompletion: vi.fn().mockResolvedValue({
          status: "unavailable",
          message: "proxy down",
          attempts: [
            {
              proxyKey: "primary",
              providerKey: "openai_compatible",
              model: LEGAL_INPUT_NORMALIZATION_MODEL,
              status: "unavailable",
              latency_ms: 0,
              prompt_tokens: null,
              completion_tokens: null,
              total_tokens: null,
              cost_usd: null,
            },
          ],
        }),
      },
    );

    expect(result).toEqual({
      raw_input: "  текст \r\n\r\n\r\n с   пробелами  ",
      normalized_input: "текст\n\n с   пробелами",
      normalization_model: LEGAL_INPUT_NORMALIZATION_MODEL,
      normalization_prompt_version: LEGAL_INPUT_NORMALIZATION_PROMPT_VERSION,
      normalization_changed: true,
      normalization_stage_usage: {
        model: LEGAL_INPUT_NORMALIZATION_MODEL,
        prompt_tokens: null,
        completion_tokens: null,
        total_tokens: null,
        estimated_cost_usd: null,
        latency_ms: expect.any(Number),
      },
      normalization_retry_stage_usage: null,
    });
  });

  it("агрегирует retry usage, если normalization переключилась на второй proxy", async () => {
    const result = await normalizeLegalInputText(
      {
        rawInput: "кривой текст",
        featureKey: "server_legal_assistant",
      },
      {
        requestProxyCompletion: vi.fn().mockResolvedValue({
          status: "success",
          content: "Кривой текст.",
          model: LEGAL_INPUT_NORMALIZATION_MODEL,
          attempts: [
            {
              proxyKey: "primary",
              providerKey: "openai_compatible",
              model: LEGAL_INPUT_NORMALIZATION_MODEL,
              status: "unavailable",
              latency_ms: 300,
              prompt_tokens: null,
              completion_tokens: null,
              total_tokens: null,
              cost_usd: null,
            },
            {
              proxyKey: "secondary",
              providerKey: "openai_compatible",
              model: LEGAL_INPUT_NORMALIZATION_MODEL,
              status: "success",
              latency_ms: 200,
              prompt_tokens: 40,
              completion_tokens: 10,
              total_tokens: 50,
              cost_usd: null,
            },
          ],
        }),
      },
    );

    expect(result.normalization_retry_stage_usage).toEqual({
      model: LEGAL_INPUT_NORMALIZATION_MODEL,
      prompt_tokens: null,
      completion_tokens: null,
      total_tokens: null,
      estimated_cost_usd: null,
      latency_ms: 300,
    });
  });
});
