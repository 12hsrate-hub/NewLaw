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

const OPENAI_METADATA_MAX_LENGTH = 500;

function truncateAssistantProxyMetadataValue(value: string) {
  return value.length > OPENAI_METADATA_MAX_LENGTH
    ? value.slice(0, OPENAI_METADATA_MAX_LENGTH)
    : value;
}

function normalizeAssistantProxyMetadata(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, string> | undefined {
  if (!metadata || typeof metadata !== "object") {
    return undefined;
  }

  const entries = Object.entries(metadata)
    .map(([key, value]) => {
      if (value == null) {
        return null;
      }

      if (typeof value === "string") {
        return [key, truncateAssistantProxyMetadataValue(value)] as const;
      }

      if (typeof value === "number" || typeof value === "boolean") {
        return [key, truncateAssistantProxyMetadataValue(String(value))] as const;
      }

      return [key, truncateAssistantProxyMetadataValue(JSON.stringify(value))] as const;
    })
    .filter((entry): entry is readonly [string, string] => Boolean(entry));

  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries);
}

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
      metadata: normalizeAssistantProxyMetadata(input.payload.metadata),
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
