import { aiProxyConfigListSchema, type AIProxyConfigEntry } from "@/schemas/legal-assistant";
import { getAIProxyRuntimeEnv, hasLiveAIProxyRuntimeEnv } from "@/schemas/env";

type ProxyCompletionInput = {
  systemPrompt: string;
  userPrompt: string;
  modelOverride?: string;
  temperature?: number;
  requestMetadata?: Record<string, unknown>;
};

type ProxyRuntimeDependencies = {
  fetch: typeof fetch;
  getRuntimeEnv: typeof getAIProxyRuntimeEnv;
  getProcessEnv: () => Record<string, string | undefined>;
};

const defaultDependencies: ProxyRuntimeDependencies = {
  fetch,
  getRuntimeEnv: getAIProxyRuntimeEnv,
  getProcessEnv: () => process.env,
};

type ProxyAttempt = {
  proxyKey: string;
  providerKey: string;
  model: string;
  endpointUrl: string;
  secretEnvKeyName: string;
};

function parseProxyConfigs(configsJson: string) {
  return aiProxyConfigListSchema.parse(JSON.parse(configsJson));
}

function sortFallbackCandidates(configs: AIProxyConfigEntry[]) {
  return [...configs].sort((left, right) => {
    if (left.priority !== right.priority) {
      return left.priority - right.priority;
    }

    if (left.weight !== right.weight) {
      return right.weight - left.weight;
    }

    return left.proxyKey.localeCompare(right.proxyKey);
  });
}

function selectProxyAttempts(input: {
  activeKey?: string;
  configs: AIProxyConfigEntry[];
}) {
  const enabledConfigs = input.configs.filter((config) => config.isEnabled);

  if (enabledConfigs.length === 0) {
    return [];
  }

  const fallbackCandidates = sortFallbackCandidates(enabledConfigs);
  const activeConfig = input.activeKey
    ? enabledConfigs.find((config) => config.proxyKey === input.activeKey)
    : null;

  if (!activeConfig) {
    return fallbackCandidates;
  }

  return [
    activeConfig,
    ...fallbackCandidates.filter((config) => config.proxyKey !== activeConfig.proxyKey),
  ];
}

function buildAuthorizedHeaders(input: {
  secret: string;
}) {
  return {
    "content-type": "application/json",
    authorization: `Bearer ${input.secret}`,
  };
}

function readProxySecret(input: {
  config: AIProxyConfigEntry;
  processEnv: Record<string, string | undefined>;
}) {
  const secret = input.processEnv[input.config.secretEnvKeyName]?.trim() ?? "";

  if (!secret || secret.includes("your-") || secret.includes("placeholder")) {
    return null;
  }

  return secret;
}

function toAttemptMetadata(config: AIProxyConfigEntry): ProxyAttempt {
  return {
    proxyKey: config.proxyKey,
    providerKey: config.providerKey,
    model: config.model,
    endpointUrl: config.endpointUrl,
    secretEnvKeyName: config.secretEnvKeyName,
  };
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
      attemptedProxyKeys: [] as string[],
    };
  }

  if (!hasLiveAIProxyRuntimeEnv(runtimeEnv)) {
    return {
      status: "unavailable" as const,
      message: "AI proxy не настроен для текущего окружения.",
      attemptedProxyKeys: [] as string[],
    };
  }

  let configs: AIProxyConfigEntry[];

  try {
    configs = parseProxyConfigs(runtimeEnv.AI_PROXY_CONFIGS_JSON);
  } catch {
    return {
      status: "unavailable" as const,
      message: "Конфигурация AI proxy повреждена или неполна.",
      attemptedProxyKeys: [] as string[],
    };
  }

  const attempts = selectProxyAttempts({
    activeKey: runtimeEnv.AI_PROXY_ACTIVE_KEY,
    configs,
  });

  if (attempts.length === 0) {
    return {
      status: "unavailable" as const,
      message: "Не найден активный AI proxy endpoint.",
      attemptedProxyKeys: [] as string[],
    };
  }

  const attemptedProxyKeys: string[] = [];
  let lastFailure:
    | {
        status: "failure" | "unavailable";
        message: string;
        proxyKey: string;
        providerKey: string;
        model: string;
        responsePayloadJson?: Record<string, unknown> | null;
      }
    | null = null;
  const processEnv = dependencies.getProcessEnv();

  for (const config of attempts) {
    attemptedProxyKeys.push(config.proxyKey);

    const secret = readProxySecret({
      config,
      processEnv,
    });

    if (!secret) {
      lastFailure = {
        status: "unavailable",
        message: `Не найден server-side secret для proxy ${config.proxyKey}.`,
        proxyKey: config.proxyKey,
        providerKey: config.providerKey,
        model: config.model,
      };
      continue;
    }

    try {
      const response = await dependencies.fetch(config.endpointUrl, {
        method: "POST",
        headers: buildAuthorizedHeaders({
          secret,
        }),
        body: JSON.stringify({
          model: input.modelOverride ?? config.model,
          temperature: input.temperature ?? 0.1,
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
        signal: AbortSignal.timeout(config.timeoutMs ?? 30000),
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
        lastFailure = {
          status: "failure",
          message: payload?.error?.message ?? "AI proxy вернул ошибку.",
          proxyKey: config.proxyKey,
          providerKey: config.providerKey,
          model: config.model,
          responsePayloadJson: payload && typeof payload === "object" ? payload : null,
        };
        continue;
      }

      const content = payload?.choices?.[0]?.message?.content?.trim();

      if (!content) {
        lastFailure = {
          status: "failure",
          message: "AI proxy не вернул содержимое ответа.",
          proxyKey: config.proxyKey,
          providerKey: config.providerKey,
          model: config.model,
          responsePayloadJson: payload && typeof payload === "object" ? payload : null,
        };
        continue;
      }

      return {
        status: "success" as const,
        content,
        proxyKey: config.proxyKey,
        providerKey: config.providerKey,
        model: input.modelOverride ?? config.model,
        attemptedProxyKeys,
        responsePayloadJson: payload && typeof payload === "object" ? payload : null,
      };
    } catch (error) {
      lastFailure = {
        status: "unavailable",
        message: error instanceof Error ? error.message : "AI proxy временно недоступен.",
        proxyKey: config.proxyKey,
        providerKey: config.providerKey,
        model: config.model,
      };
    }
  }

  if (lastFailure) {
    return {
      ...lastFailure,
      attemptedProxyKeys,
    };
  }

  return {
    status: "unavailable" as const,
    message: "AI proxy недоступен.",
    attemptedProxyKeys,
  };
}

export function buildInternalAssistantProxyConfig(input: {
  endpointUrl: string;
  activeKey?: string;
}) {
  return {
    AI_PROXY_ACTIVE_KEY: input.activeKey ?? "primary",
    AI_PROXY_CONFIGS_JSON: JSON.stringify([
      {
        proxyKey: input.activeKey ?? "primary",
        providerKey: "openai_compatible",
        endpointUrl: input.endpointUrl,
        secretEnvKeyName: "AI_PROXY_INTERNAL_TOKEN",
        model: "gpt-5.4",
        isEnabled: true,
        priority: 100,
        weight: 1,
        capabilities: ["server_legal_assistant"],
      } satisfies Omit<AIProxyConfigEntry, "timeoutMs">,
    ]),
  };
}

export { parseProxyConfigs, selectProxyAttempts, toAttemptMetadata };
