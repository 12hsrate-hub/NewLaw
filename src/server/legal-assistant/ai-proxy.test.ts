import { describe, expect, it, vi } from "vitest";

import {
  buildInternalAssistantProxyConfig,
  getConfiguredAIProxyEntries,
  requestAssistantProxyCompletion,
} from "@/server/legal-assistant/ai-proxy";

describe("ai proxy", () => {
  it("читает несколько proxy entries из server-side config без секретов в JSON", () => {
    const configs = getConfiguredAIProxyEntries({
      getRuntimeEnv: () => ({
        AI_PROXY_ACTIVE_KEY: "secondary",
        AI_PROXY_CONFIGS_JSON: JSON.stringify([
          {
            proxyKey: "primary",
            providerKey: "openai_compatible",
            endpointUrl: "https://proxy-1.internal.test/v1/chat/completions",
            secretEnvKeyName: "AI_PROXY_SECRET_PRIMARY",
            model: "gpt-5.4",
            priority: 200,
            weight: 1,
          },
          {
            proxyKey: "secondary",
            providerKey: "openai_compatible",
            endpointUrl: "https://proxy-2.internal.test/v1/chat/completions",
            secretEnvKeyName: "AI_PROXY_SECRET_SECONDARY",
            model: "gpt-5.4-mini",
            priority: 100,
            weight: 2,
          },
        ]),
      }),
    });

    expect(configs).toHaveLength(2);
    expect(configs[1].proxyKey).toBe("secondary");
    expect("secretEnvKeyName" in configs[0]).toBe(true);
  });

  it("ходит только через proxy layer и читает secret из env", async () => {
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
              proxyKey: "primary",
              providerKey: "openai_compatible",
              endpointUrl: "https://proxy.internal.test/v1/chat/completions",
              secretEnvKeyName: "AI_PROXY_SECRET_PRIMARY",
              model: "gpt-5.4",
              priority: 100,
              weight: 1,
            },
          ]),
        }),
        getProcessEnv: () => ({
          AI_PROXY_SECRET_PRIMARY: "secret",
        }),
      },
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://proxy.internal.test/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer secret",
        }),
      }),
    );
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.content).toContain("Краткий вывод");
      expect(result.attemptedProxyKeys).toEqual(["primary"]);
    }
  });

  it("делает failover на следующий proxy, если первый недоступен", async () => {
    const fetchSpy = vi
      .fn()
      .mockRejectedValueOnce(new Error("connect ECONNREFUSED"))
      .mockResolvedValueOnce({
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
              proxyKey: "primary",
              providerKey: "openai_compatible",
              endpointUrl: "https://proxy-1.internal.test/v1/chat/completions",
              secretEnvKeyName: "AI_PROXY_SECRET_PRIMARY",
              model: "gpt-5.4",
              priority: 100,
              weight: 1,
            },
            {
              proxyKey: "secondary",
              providerKey: "openai_compatible",
              endpointUrl: "https://proxy-2.internal.test/v1/chat/completions",
              secretEnvKeyName: "AI_PROXY_SECRET_SECONDARY",
              model: "gpt-5.4-mini",
              priority: 200,
              weight: 1,
            },
          ]),
        }),
        getProcessEnv: () => ({
          AI_PROXY_SECRET_PRIMARY: "secret-1",
          AI_PROXY_SECRET_SECONDARY: "secret-2",
        }),
      },
    );

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.proxyKey).toBe("secondary");
      expect(result.attemptedProxyKeys).toEqual(["primary", "secondary"]);
    }
  });

  it("возвращает unavailable, если secret env не найден", async () => {
    const result = await requestAssistantProxyCompletion(
      {
        systemPrompt: "system",
        userPrompt: "user",
      },
      {
        fetch: vi.fn() as typeof fetch,
        getRuntimeEnv: () => ({
          AI_PROXY_ACTIVE_KEY: "primary",
          AI_PROXY_CONFIGS_JSON: JSON.stringify([
            {
              proxyKey: "primary",
              providerKey: "openai_compatible",
              endpointUrl: "https://proxy.internal.test/v1/chat/completions",
              secretEnvKeyName: "AI_PROXY_SECRET_PRIMARY",
              model: "gpt-5.4",
              priority: 100,
              weight: 1,
            },
          ]),
        }),
        getProcessEnv: () => ({}),
      },
    );

    expect(result.status).toBe("unavailable");
    if (result.status === "unavailable") {
      expect(result.message).toContain("secret");
      expect(result.attemptedProxyKeys).toEqual(["primary"]);
    }
  });

  it("может собрать internal proxy config foundation", () => {
    const config = buildInternalAssistantProxyConfig({
      endpointUrl: "http://127.0.0.1:3000/api/assistant-proxy",
    });

    const parsed = JSON.parse(config.AI_PROXY_CONFIGS_JSON);
    expect(config.AI_PROXY_ACTIVE_KEY).toBe("primary");
    expect(parsed[0].secretEnvKeyName).toBe("AI_PROXY_INTERNAL_TOKEN");
  });
});
