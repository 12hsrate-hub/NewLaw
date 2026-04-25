import { promises as fs } from "node:fs";

import {
  getAIProxyRuntimeEnv,
  getAppRuntimeEnv,
  getAssistantInternalProxyEnv,
  getForumIntegrationRuntimeEnv,
  getOgpForumAutomationRuntimeEnv,
  getSupabaseRuntimeEnv,
  hasLiveAIProxyRuntimeEnv,
  hasLiveForumIntegrationRuntimeEnv,
  hasLiveOgpForumAutomationRuntimeEnv,
  isPlaceholderRuntimeValue,
} from "../../schemas/env";

export type ReleaseFailureClassification =
  | "code_regression"
  | "external_runtime_env_blocker"
  | "flaky_operational_issue";

export type EnvCheckStatus =
  | "valid"
  | "blocking_missing"
  | "optional_missing"
  | "placeholder_non_live";

export type EnvCheckScope = "required" | "optional";

export type EnvCheck = {
  key: string;
  scope: EnvCheckScope;
  status: EnvCheckStatus;
  note: string;
};

export type EnvPreflightResult = {
  checks: EnvCheck[];
  blockingFailure: boolean;
  classification: "ok" | "external_runtime_env_blocker";
};

export type RouteSmokeResult = {
  url: string;
  kind: "public" | "redirect";
  status: number;
  expectedStatus: number;
  expectedLocation?: string;
  location?: string | null;
};

export type ReadOnlyDbSmokeResult = {
  serverSlug: string;
};

export type AppContextDbSmokeResult = {
  runtimeStatus: string;
  serverCount: number;
  warningCount: number;
};

export type MandatorySmokeResult = {
  routeResults: RouteSmokeResult[];
  readOnlyDb: ReadOnlyDbSmokeResult;
  appContext: AppContextDbSmokeResult;
};

type EnvMap = Record<string, string | undefined>;

type RuntimeFetch = typeof fetch;

export class OperationalFailure extends Error {
  classification: ReleaseFailureClassification;

  constructor(message: string, classification: ReleaseFailureClassification) {
    super(message);
    this.name = "OperationalFailure";
    this.classification = classification;
  }
}

const REQUIRED_ENV_KEYS = [
  "APP_ENV",
  "APP_URL",
  "DATABASE_URL",
  "DIRECT_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "AI_PROXY_CONFIGS_JSON",
  "AI_PROXY_INTERNAL_TOKEN",
  "OPENAI_API_KEY",
] as const;

const OPTIONAL_ENV_KEYS = [
  "FORUM_SESSION_ENCRYPTION_KEY",
  "OGP_FORUM_THREAD_FORM_URL",
  "AI_PROXY_ACTIVE_KEY",
] as const;

type EnvKey = (typeof REQUIRED_ENV_KEYS)[number] | (typeof OPTIONAL_ENV_KEYS)[number];

function normalizeEnvValue(value: string | undefined) {
  return value?.trim() || "";
}

function withTemporaryEnv<T>(env: EnvMap, fn: () => T): T {
  const backup = new Map<string, string | undefined>();
  const keys = [...new Set([...Object.keys(env), ...REQUIRED_ENV_KEYS, ...OPTIONAL_ENV_KEYS])];

  for (const key of keys) {
    backup.set(key, process.env[key]);

    const value = env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return fn();
  } finally {
    for (const key of keys) {
      const previous = backup.get(key);

      if (previous === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous;
      }
    }
  }
}

function makeCheck(
  key: EnvKey,
  scope: EnvCheckScope,
  status: EnvCheckStatus,
  note: string,
): EnvCheck {
  return { key, scope, status, note };
}

function isNonLiveDatabaseUrl(value: string) {
  return (
    isPlaceholderRuntimeValue(value) &&
    !(
      (value.startsWith("postgresql://") || value.startsWith("postgres://")) &&
      (value.includes("localhost") || value.includes("127.0.0.1"))
    )
  );
}

function classifyAppReleaseKey(env: EnvMap, key: EnvKey): EnvCheck {
  const value = normalizeEnvValue(env[key]);

  if (!value) {
    return makeCheck(key, "required", "blocking_missing", "required env is missing");
  }

  if (key === "APP_ENV") {
    if (value !== "production") {
      return makeCheck(
        key,
        "required",
        "placeholder_non_live",
        "APP_ENV must be production for production release",
      );
    }

    return makeCheck(key, "required", "valid", "required env looks live");
  }

  if (key === "APP_URL") {
    const parsed = withTemporaryEnv({ APP_URL: value }, () => {
      try {
        getAppRuntimeEnv();
        return true;
      } catch {
        return false;
      }
    });

    if (!parsed || isPlaceholderRuntimeValue(value)) {
      return makeCheck(
        key,
        "required",
        "placeholder_non_live",
        "APP_URL is invalid or looks placeholder/non-live",
      );
    }

    return makeCheck(key, "required", "valid", "required env looks live");
  }

  if ((key === "DATABASE_URL" || key === "DIRECT_URL") && isNonLiveDatabaseUrl(value)) {
    return makeCheck(
      key,
      "required",
      "placeholder_non_live",
      "database connection string looks placeholder or non-live",
    );
  }

  if (key !== "DATABASE_URL" && key !== "DIRECT_URL" && isPlaceholderRuntimeValue(value)) {
    return makeCheck(
      key,
      "required",
      "placeholder_non_live",
      "database connection string looks placeholder or non-live",
    );
  }

  return makeCheck(key, "required", "valid", "required env looks live");
}

function classifySupabaseRuntimeKey(env: EnvMap, key: EnvKey): EnvCheck {
  const value = normalizeEnvValue(env[key]);

  if (!value) {
    return makeCheck(key, "required", "blocking_missing", "required env is missing");
  }

  if (key === "NEXT_PUBLIC_SUPABASE_URL") {
    const parsed = withTemporaryEnv(
      {
        NEXT_PUBLIC_SUPABASE_URL: value,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "runtime-check",
      },
      () => {
        try {
          getSupabaseRuntimeEnv();
          return true;
        } catch {
          return false;
        }
      },
    );

    if (!parsed || isPlaceholderRuntimeValue(value)) {
      return makeCheck(
        key,
        "required",
        "placeholder_non_live",
        "Supabase URL is invalid or looks placeholder/non-live",
      );
    }

    return makeCheck(key, "required", "valid", "required env looks live");
  }

  if (isPlaceholderRuntimeValue(value)) {
    return makeCheck(
      key,
      "required",
      "placeholder_non_live",
      "Supabase anon key looks placeholder or non-live",
    );
  }

  return makeCheck(key, "required", "valid", "required env looks live");
}

function classifySupabaseServiceRoleKey(env: EnvMap, key: EnvKey): EnvCheck {
  const value = normalizeEnvValue(env[key]);

  if (!value) {
    return makeCheck(key, "required", "blocking_missing", "required env is missing");
  }

  if (isPlaceholderRuntimeValue(value)) {
    return makeCheck(
      key,
      "required",
      "placeholder_non_live",
      "service-role key looks placeholder or non-live",
    );
  }

  return makeCheck(key, "required", "valid", "required env looks live");
}

function classifyAiProxyKey(env: EnvMap, key: EnvKey): EnvCheck {
  const value = normalizeEnvValue(env[key]);

  if (!value) {
    return makeCheck(key, "required", "blocking_missing", "required env is missing");
  }

  const parsed = withTemporaryEnv(
    {
      AI_PROXY_CONFIGS_JSON: value,
      AI_PROXY_ACTIVE_KEY: env.AI_PROXY_ACTIVE_KEY,
    },
    () => {
      try {
        getAIProxyRuntimeEnv();
        return true;
      } catch {
        return false;
      }
    },
  );

  if (!parsed) {
    return makeCheck(
      key,
      "required",
      "placeholder_non_live",
      "env value does not satisfy AI proxy schema",
    );
  }

  if (
    !hasLiveAIProxyRuntimeEnv({
      AI_PROXY_CONFIGS_JSON: value,
      AI_PROXY_ACTIVE_KEY: env.AI_PROXY_ACTIVE_KEY,
    })
  ) {
    return makeCheck(key, "required", "placeholder_non_live", "env value looks placeholder or non-live");
  }

  return makeCheck(key, "required", "valid", "required env looks live");
}

function classifyAssistantInternalKey(env: EnvMap, key: EnvKey): EnvCheck {
  const value = normalizeEnvValue(env[key]);

  if (!value) {
    return makeCheck(key, "required", "blocking_missing", "required env is missing");
  }

  const parsed = withTemporaryEnv(
    key === "OPENAI_API_KEY"
      ? {
          OPENAI_API_KEY: value,
          AI_PROXY_INTERNAL_TOKEN: env.AI_PROXY_INTERNAL_TOKEN ?? "runtime-check",
        }
      : {
          OPENAI_API_KEY: env.OPENAI_API_KEY ?? "runtime-check",
          AI_PROXY_INTERNAL_TOKEN: value,
        },
    () => {
      try {
        getAssistantInternalProxyEnv();
        return true;
      } catch {
        return false;
      }
    },
  );

  if (!parsed) {
    return makeCheck(
      key,
      "required",
      "placeholder_non_live",
      "env value does not satisfy assistant internal proxy schema",
    );
  }

  if (isPlaceholderRuntimeValue(value)) {
    return makeCheck(key, "required", "placeholder_non_live", "env value looks placeholder or non-live");
  }

  return makeCheck(key, "required", "valid", "required env looks live");
}

function classifyOptionalForumIntegrationKey(env: EnvMap): EnvCheck {
  const value = normalizeEnvValue(env.FORUM_SESSION_ENCRYPTION_KEY);

  if (!value) {
    return makeCheck(
      "FORUM_SESSION_ENCRYPTION_KEY",
      "optional",
      "optional_missing",
      "forum integration feature will stay disabled or unavailable",
    );
  }

  const parsed = withTemporaryEnv(env, () => {
    try {
      getForumIntegrationRuntimeEnv();
      return true;
    } catch {
      return false;
    }
  });

  if (!parsed || !withTemporaryEnv(env, () => hasLiveForumIntegrationRuntimeEnv(getForumIntegrationRuntimeEnv()))) {
    return makeCheck(
      "FORUM_SESSION_ENCRYPTION_KEY",
      "optional",
      "placeholder_non_live",
      "forum integration env is present but non-live; feature remains unavailable",
    );
  }

  return makeCheck("FORUM_SESSION_ENCRYPTION_KEY", "optional", "valid", "optional env looks live");
}

function classifyOptionalForumAutomationKey(env: EnvMap): EnvCheck {
  const value = normalizeEnvValue(env.OGP_FORUM_THREAD_FORM_URL);

  if (!value) {
    return makeCheck(
      "OGP_FORUM_THREAD_FORM_URL",
      "optional",
      "optional_missing",
      "OGP forum automation will stay disabled or unavailable",
    );
  }

  const parsed = withTemporaryEnv(env, () => {
    try {
      getOgpForumAutomationRuntimeEnv();
      return true;
    } catch {
      return false;
    }
  });

  if (
    !parsed ||
    !withTemporaryEnv(env, () =>
      hasLiveOgpForumAutomationRuntimeEnv(getOgpForumAutomationRuntimeEnv()),
    )
  ) {
    return makeCheck(
      "OGP_FORUM_THREAD_FORM_URL",
      "optional",
      "placeholder_non_live",
      "forum automation env is present but non-live; feature remains unavailable",
    );
  }

  return makeCheck("OGP_FORUM_THREAD_FORM_URL", "optional", "valid", "optional env looks live");
}

function classifyOptionalAiProxyActiveKey(env: EnvMap): EnvCheck {
  const value = normalizeEnvValue(env.AI_PROXY_ACTIVE_KEY);

  if (!value) {
    return makeCheck(
      "AI_PROXY_ACTIVE_KEY",
      "optional",
      "optional_missing",
      "default AI proxy selection stays implicit; feature remains operational if configs are valid",
    );
  }

  if (isPlaceholderRuntimeValue(value)) {
    return makeCheck(
      "AI_PROXY_ACTIVE_KEY",
      "optional",
      "placeholder_non_live",
      "optional AI proxy selector looks placeholder or non-live",
    );
  }

  return makeCheck("AI_PROXY_ACTIVE_KEY", "optional", "valid", "optional env looks live");
}

export async function loadEnvFile(filePath: string): Promise<Record<string, string>> {
  const raw = await fs.readFile(filePath, "utf8");
  const env: Record<string, string> = {};

  for (const line of raw.split(/\r?\n/u)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const normalized = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
    const separatorIndex = normalized.indexOf("=");

    if (separatorIndex < 0) {
      continue;
    }

    const key = normalized.slice(0, separatorIndex).trim();
    let value = normalized.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

export function evaluateReleaseEnv(env: EnvMap): EnvPreflightResult {
  const checks: EnvCheck[] = [
    classifyAppReleaseKey(env, "APP_ENV"),
    classifyAppReleaseKey(env, "APP_URL"),
    classifyAppReleaseKey(env, "DATABASE_URL"),
    classifyAppReleaseKey(env, "DIRECT_URL"),
    classifySupabaseRuntimeKey(env, "NEXT_PUBLIC_SUPABASE_URL"),
    classifySupabaseRuntimeKey(env, "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    classifySupabaseServiceRoleKey(env, "SUPABASE_SERVICE_ROLE_KEY"),
    classifyAiProxyKey(env, "AI_PROXY_CONFIGS_JSON"),
    classifyAssistantInternalKey(env, "AI_PROXY_INTERNAL_TOKEN"),
    classifyAssistantInternalKey(env, "OPENAI_API_KEY"),
    classifyOptionalForumIntegrationKey(env),
    classifyOptionalForumAutomationKey(env),
    classifyOptionalAiProxyActiveKey(env),
  ];

  return {
    checks,
    blockingFailure: checks.some((check) => check.status === "blocking_missing" || (check.scope === "required" && check.status === "placeholder_non_live")),
    classification: checks.some((check) => check.status === "blocking_missing" || (check.scope === "required" && check.status === "placeholder_non_live"))
      ? "external_runtime_env_blocker"
      : "ok",
  };
}

export function formatEnvPreflightResult(result: EnvPreflightResult) {
  const lines = result.checks.map((check) => {
    const prefix =
      check.status === "valid"
        ? "[valid]"
        : check.status === "blocking_missing"
          ? "[blocking]"
          : check.status === "optional_missing"
            ? "[optional]"
            : "[non-live]";

    return `${prefix} ${check.key}: ${check.note}`;
  });

  lines.push(
    result.blockingFailure
      ? `[summary] classification=external_runtime_env_blocker`
      : `[summary] classification=ok`,
  );

  return lines;
}

export function buildMandatoryRouteTargets(appUrl: string, knownServerSlug: string) {
  const baseUrl = appUrl.replace(/\/+$/u, "");

  return [
    { url: `${baseUrl}/api/health`, kind: "public" as const, expectedStatus: 200 },
    { url: `${baseUrl}/sign-in`, kind: "public" as const, expectedStatus: 200 },
    { url: `${baseUrl}/forgot-password`, kind: "public" as const, expectedStatus: 200 },
    { url: `${baseUrl}/assistant`, kind: "public" as const, expectedStatus: 200 },
    { url: `${baseUrl}/servers`, kind: "public" as const, expectedStatus: 200 },
    {
      url: `${baseUrl}/account`,
      kind: "redirect" as const,
      expectedStatus: 307,
      expectedLocation: "/sign-in?next=%2Faccount",
    },
    {
      url: `${baseUrl}/servers/${knownServerSlug}`,
      kind: "redirect" as const,
      expectedStatus: 307,
      expectedLocation: `/sign-in?next=%2Fservers%2F${knownServerSlug}`,
    },
    {
      url: `${baseUrl}/internal`,
      kind: "redirect" as const,
      expectedStatus: 307,
      expectedLocation: "/sign-in?next=%2Finternal",
    },
  ];
}

export async function runReadOnlyDbSmoke() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({
    log: ["warn", "error"],
  });

  try {
    const server = await prisma.server.findFirst({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { code: true },
    });

    if (!server?.code) {
      throw new OperationalFailure(
        "Read-only DB smoke did not find any server records",
        "code_regression",
      );
    }

    return { serverSlug: server.code } satisfies ReadOnlyDbSmokeResult;
  } catch (error) {
    throw normalizeOperationalFailure(error, "external_runtime_env_blocker");
  } finally {
    await prisma.$disconnect();
  }
}

export async function runAppContextDbSmoke() {
  try {
    const { getInternalHealthContext } = await import("../internal/health");
    const context = await getInternalHealthContext();

    if (context.runtime.status !== "ok") {
      throw new OperationalFailure(
        `Unexpected internal runtime status: ${context.runtime.status}`,
        "code_regression",
      );
    }

    if (context.serverSummaries.length === 0) {
      throw new OperationalFailure(
        "App-context DB smoke returned zero server summaries",
        "code_regression",
      );
    }

    return {
      runtimeStatus: context.runtime.status,
      serverCount: context.serverSummaries.length,
      warningCount: context.warnings.length,
    } satisfies AppContextDbSmokeResult;
  } catch (error) {
    throw normalizeOperationalFailure(error, "code_regression");
  }
}

export async function runMandatoryHttpSmoke(
  appUrl: string,
  knownServerSlug: string,
  fetchImpl: RuntimeFetch = fetch,
) {
  const results: RouteSmokeResult[] = [];

  for (const target of buildMandatoryRouteTargets(appUrl, knownServerSlug)) {
    let response: Response;

    try {
      response = await fetchImpl(target.url, {
        method: "GET",
        redirect: "manual",
      });
    } catch (error) {
      throw normalizeOperationalFailure(error, "flaky_operational_issue");
    }

    const location = response.headers.get("location");

    if (response.status !== target.expectedStatus) {
      throw new OperationalFailure(
        `Unexpected status for ${target.url}: expected ${target.expectedStatus}, got ${response.status}`,
        "code_regression",
      );
    }

    if (target.kind === "redirect" && (!location || !location.includes(target.expectedLocation ?? ""))) {
      throw new OperationalFailure(
        `Unexpected redirect for ${target.url}: expected location containing ${target.expectedLocation}, got ${location ?? "none"}`,
        "code_regression",
      );
    }

    results.push({
      url: target.url,
      kind: target.kind,
      status: response.status,
      expectedStatus: target.expectedStatus,
      expectedLocation: target.expectedLocation,
      location,
    });
  }

  return results;
}

export async function runMandatorySmoke(appUrl: string) {
  const readOnlyDb = await runReadOnlyDbSmoke();
  const appContext = await runAppContextDbSmoke();
  const routeResults = await runMandatoryHttpSmoke(appUrl, readOnlyDb.serverSlug);

  return {
    routeResults,
    readOnlyDb,
    appContext,
  } satisfies MandatorySmokeResult;
}

export function classifyOperationalFailure(error: unknown): ReleaseFailureClassification {
  if (error instanceof OperationalFailure) {
    return error.classification;
  }

  const message =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);

  if (
    /env|environment variable|database|authentication failed|permission denied|invalid url|secret|token|credential|supabase|prisma/iu.test(
      message,
    )
  ) {
    return "external_runtime_env_blocker";
  }

  if (/timeout|fetch failed|econnreset|econnrefused|enotfound|temporarily unavailable|network/iu.test(message)) {
    return "flaky_operational_issue";
  }

  return "code_regression";
}

function normalizeOperationalFailure(
  error: unknown,
  fallbackClassification: ReleaseFailureClassification,
) {
  if (error instanceof OperationalFailure) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);

  return new OperationalFailure(
    message,
    classifyOperationalFailure(error) ?? fallbackClassification,
  );
}
