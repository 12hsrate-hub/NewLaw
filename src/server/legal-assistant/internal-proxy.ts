import { getAssistantInternalProxyEnv, hasLiveAssistantInternalProxyEnv } from "@/schemas/env";

type AssistantInternalProxyRequest = {
  model: string;
  temperature?: number;
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  metadata?: Record<string, unknown> | null;
};

type AssistantInternalProxyDependencies = {
  fetch: typeof fetch;
  getEnv: typeof getAssistantInternalProxyEnv;
};

const defaultDependencies: AssistantInternalProxyDependencies = {
  fetch,
  getEnv: getAssistantInternalProxyEnv,
};

export async function executeAssistantInternalProxyRequest(
  input: {
    bearerToken: string;
    payload: AssistantInternalProxyRequest;
  },
  dependencies: AssistantInternalProxyDependencies = defaultDependencies,
) {
  let env: ReturnType<typeof getAssistantInternalProxyEnv>;

  try {
    env = dependencies.getEnv();
  } catch {
    return {
      status: 503,
      payload: {
        error: {
          message: "Internal assistant proxy не настроен.",
        },
      },
    };
  }

  if (!hasLiveAssistantInternalProxyEnv(env)) {
    return {
      status: 503,
      payload: {
        error: {
          message: "Internal assistant proxy не настроен.",
        },
      },
    };
  }

  if (input.bearerToken.trim() !== env.AI_PROXY_INTERNAL_TOKEN.trim()) {
    return {
      status: 401,
      payload: {
        error: {
          message: "Недопустимый internal proxy token.",
        },
      },
    };
  }

  const response = await dependencies.fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: input.payload.model,
      temperature: input.payload.temperature ?? 0.1,
      messages: input.payload.messages,
      metadata: input.payload.metadata ?? null,
    }),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;

  return {
    status: response.status,
    payload:
      payload ??
      ({
        error: {
          message: "Upstream AI provider вернул непустой, но нечитаемый ответ.",
        },
      } satisfies Record<string, unknown>),
  };
}
