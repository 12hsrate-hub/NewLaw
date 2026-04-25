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
        }),
      },
    );

    expect(result).toEqual({
      raw_input: "  текст \r\n\r\n\r\n с   пробелами  ",
      normalized_input: "текст\n\n с   пробелами",
      normalization_model: LEGAL_INPUT_NORMALIZATION_MODEL,
      normalization_prompt_version: LEGAL_INPUT_NORMALIZATION_PROMPT_VERSION,
      normalization_changed: true,
    });
  });
});

