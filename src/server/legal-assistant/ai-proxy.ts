import { aiProxyConfigListSchema, type AIProxyConfigEntry } from "@/schemas/legal-assistant";
import { getAIProxyRuntimeEnv, hasLiveAIProxyRuntimeEnv } from "@/schemas/env";

type ProxyCompletionInput = {
  systemPrompt: string;
  userPrompt: string;
  requestMetadata?: Record<string, unknown>;
};

type ProxyRuntimeDependencies = {
  fetch: typeof fetch;
  getRuntimeEnv: typeof getAIProxyRuntimeEnv;
};

const defaultDependencies: ProxyRuntimeDependencies = {
  fetch,
  getRuntimeEnv: getAIProxyRuntimeEnv,
};

function parseProxyConfigs(configsJson: string) {
  return aiProxyConfigListSchema.parse(JSON.parse(configsJson));
}

function selectActiveProxyConfig(input: {
  activeKey?: string;
  configs: AIProxyConfigEntry[];
}) {
  const enabledConfigs = input.configs.filter((config) => config.isEnabled);

  if (enabledConfigs.length === 0) {
    return null;
  }

  if (!input.activeKey) {
    return enabledConfigs[0];
  }

  return enabledConfigs.find((config) => config.key === input.activeKey) ?? null;
}

export function getConfiguredAIProxyEntries(
  dependencies: Pick<ProxyRuntimeDependencies, "getRuntimeEnv"> = defaultDependencies,
) {
  const runtimeEnv = dependencies.getRuntimeEnv();

  if (!hasLiveAIProxyRuntimeEnv(runtimeEnv)) {
    return [];
  }

  return parseProxyConfigs(runtimeEnv.AI_PROXY_CONFIGS_JSON);
}

export async function requestAssistantProxyCompletion(
  input: ProxyCompletionInput,
  dependencies: ProxyRuntimeDependencies = defaultDependencies,
) {
  let runtimeEnv: ReturnType<typeof getAIProxyRuntimeEnv>;

  try {
    runtimeEnv = dependencies.getRuntimeEnv();
  } catch {
    return {
      status: "unavailable" as const,
      message: "AI proxy не настроен для текущего окружения.",
    };
  }

  if (!hasLiveAIProxyRuntimeEnv(runtimeEnv)) {
    return {
      status: "unavailable" as const,
      message: "AI proxy не настроен для текущего окружения.",
    };
  }

  let configs: AIProxyConfigEntry[];

  try {
    configs = parseProxyConfigs(runtimeEnv.AI_PROXY_CONFIGS_JSON);
  } catch {
    return {
      status: "unavailable" as const,
      message: "Конфигурация AI proxy повреждена или неполна.",
    };
  }

  const activeConfig = selectActiveProxyConfig({
    activeKey: runtimeEnv.AI_PROXY_ACTIVE_KEY,
    configs,
  });

  if (!activeConfig) {
    return {
      status: "unavailable" as const,
      message: "Не найден активный AI proxy endpoint.",
    };
  }

  try {
    const response = await dependencies.fetch(activeConfig.endpointUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${activeConfig.apiKey}`,
        ...(activeConfig.extraHeaders ?? {}),
      },
      body: JSON.stringify({
        model: activeConfig.model,
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content: input.systemPrompt,
          },
          {
            role: "user",
            content: input.userPrompt,
          },
        ],
        metadata: input.requestMetadata ?? null,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(activeConfig.timeoutMs ?? 30000),
    });
    const payload = (await response.json().catch(() => null)) as
      | {
          choices?: Array<{
            message?: {
              content?: string | null;
            };
          }>;
          error?: {
            message?: string;
          };
        }
      | null;

    if (!response.ok) {
      return {
        status: "failure" as const,
        message: payload?.error?.message ?? "AI proxy вернул ошибку.",
        proxyKey: activeConfig.key,
        providerKey: activeConfig.provider,
        model: activeConfig.model,
        responsePayloadJson: payload && typeof payload === "object" ? payload : null,
      };
    }

    const content = payload?.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return {
        status: "failure" as const,
        message: "AI proxy не вернул содержимое ответа.",
        proxyKey: activeConfig.key,
        providerKey: activeConfig.provider,
        model: activeConfig.model,
        responsePayloadJson: payload && typeof payload === "object" ? payload : null,
      };
    }

    return {
      status: "success" as const,
      content,
      proxyKey: activeConfig.key,
      providerKey: activeConfig.provider,
      model: activeConfig.model,
      responsePayloadJson: payload && typeof payload === "object" ? payload : null,
    };
  } catch (error) {
    return {
      status: "unavailable" as const,
      message: error instanceof Error ? error.message : "AI proxy временно недоступен.",
      proxyKey: activeConfig.key,
      providerKey: activeConfig.provider,
      model: activeConfig.model,
    };
  }
}
