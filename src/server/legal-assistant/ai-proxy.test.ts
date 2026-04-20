import { describe, expect, it, vi } from "vitest";

import {
  getConfiguredAIProxyEntries,
  requestAssistantProxyCompletion,
} from "@/server/legal-assistant/ai-proxy";

describe("ai proxy", () => {
  it("читает несколько proxy entries из server-side config", () => {
    const configs = getConfiguredAIProxyEntries({
      getRuntimeEnv: () => ({
        AI_PROXY_ACTIVE_KEY: "secondary",
        AI_PROXY_CONFIGS_JSON: JSON.stringify([
          {
              key: "primary",
              provider: "openai_compatible",
              endpointUrl: "https://proxy-1.internal.test/v1/chat/completions",
              apiKey: "secret-1",
              model: "gpt-5.4",
            },
            {
              key: "secondary",
              provider: "openai_compatible",
              endpointUrl: "https://proxy-2.internal.test/v1/chat/completions",
              apiKey: "secret-2",
              model: "gpt-5.4-mini",
            },
        ]),
      }),
    });

    expect(configs).toHaveLength(2);
    expect(configs[1].key).toBe("secondary");
  });

  it("ходит только через proxy layer и возвращает content", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                "## Краткий вывод\nОтвет.\n\n## Что прямо следует из норм\nНорма.\n\n## Вывод / интерпретация\nИнтерпретация.",
            },
          },
        ],
      }),
    });

    const result = await requestAssistantProxyCompletion(
      {
        systemPrompt: "system",
        userPrompt: "user",
      },
      {
        fetch: fetchSpy as typeof fetch,
        getRuntimeEnv: () => ({
          AI_PROXY_ACTIVE_KEY: "primary",
          AI_PROXY_CONFIGS_JSON: JSON.stringify([
            {
              key: "primary",
              provider: "openai_compatible",
              endpointUrl: "https://proxy.internal.test/v1/chat/completions",
              apiKey: "secret",
              model: "gpt-5.4",
            },
          ]),
        }),
      },
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://proxy.internal.test/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.content).toContain("Краткий вывод");
    }
  });
});
