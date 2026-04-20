import { describe, expect, it, vi } from "vitest";

import { executeAssistantInternalProxyRequest } from "@/server/legal-assistant/internal-proxy";

describe("assistant internal proxy", () => {
  it("использует только server-side env и не пропускает неверный internal token", async () => {
    const result = await executeAssistantInternalProxyRequest(
      {
        bearerToken: "wrong-token",
        payload: {
          model: "gpt-5.4",
          messages: [
            {
              role: "system",
              content: "system",
            },
          ],
        },
      },
      {
        fetch: vi.fn() as typeof fetch,
        getEnv: () => ({
          OPENAI_API_KEY: "secret-openai-key",
          AI_PROXY_INTERNAL_TOKEN: "correct-token",
        }),
      },
    );

    expect(result.status).toBe(401);
  });

  it("проксирует запрос в OpenAI только с server-side key", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: "ok",
            },
          },
        ],
      }),
    });

    const result = await executeAssistantInternalProxyRequest(
      {
        bearerToken: "correct-token",
        payload: {
          model: "gpt-5.4",
          messages: [
            {
              role: "system",
              content: "system",
            },
            {
              role: "user",
              content: "user",
            },
          ],
        },
      },
      {
        fetch: fetchSpy as typeof fetch,
        getEnv: () => ({
          OPENAI_API_KEY: "secret-openai-key",
          AI_PROXY_INTERNAL_TOKEN: "correct-token",
        }),
      },
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer secret-openai-key",
        }),
      }),
    );
    expect(result.status).toBe(200);
  });

  it("нормализует metadata в flat string map перед отправкой upstream", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: "ok",
            },
          },
        ],
      }),
    });

    await executeAssistantInternalProxyRequest(
      {
        bearerToken: "correct-token",
        payload: {
          model: "gpt-5.4",
          messages: [
            {
              role: "system",
              content: "system",
            },
          ],
          metadata: {
            featureKey: "server_legal_assistant",
            corpusSnapshot: {
              currentVersionIds: ["v1", "v2"],
            },
            retrievalResultsCount: 4,
          },
        },
      },
      {
        fetch: fetchSpy as typeof fetch,
        getEnv: () => ({
          OPENAI_API_KEY: "secret-openai-key",
          AI_PROXY_INTERNAL_TOKEN: "correct-token",
        }),
      },
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({
        body: JSON.stringify({
          model: "gpt-5.4",
          temperature: 0.1,
          messages: [
            {
              role: "system",
              content: "system",
            },
          ],
          metadata: {
            featureKey: "server_legal_assistant",
            corpusSnapshot: "{\"currentVersionIds\":[\"v1\",\"v2\"]}",
            retrievalResultsCount: "4",
          },
        }),
      }),
    );
  });
});
