import { z } from "zod";

const appRuntimeEnvSchema = z.object({
  APP_URL: z.string().url(),
});

const appReleaseEnvSchema = z.object({
  APP_ENV: z.enum(["local", "staging", "production"]),
  APP_URL: z.string().url(),
  DATABASE_URL: z.string().trim().min(1),
  DIRECT_URL: z.string().trim().min(1),
});

const supabaseRuntimeEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const supabaseServiceRoleEnvSchema = appRuntimeEnvSchema.extend({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

const aiProxyRuntimeEnvSchema = z.object({
  AI_PROXY_ACTIVE_KEY: z.string().trim().min(1).optional(),
  AI_PROXY_CONFIGS_JSON: z.string().trim().min(1),
});

const assistantInternalProxyEnvSchema = z.object({
  OPENAI_API_KEY: z.string().trim().min(1),
  AI_PROXY_INTERNAL_TOKEN: z.string().trim().min(1),
});

const aiQualityReviewRuntimeEnvSchema = z.object({
  AI_REVIEW_ENABLED: z.boolean().default(true),
  AI_REVIEW_MODE: z.enum(["off", "log_only", "full"]).default("log_only"),
  AI_REVIEW_DAILY_REQUEST_LIMIT: z.number().int().positive().optional(),
  AI_REVIEW_DAILY_COST_LIMIT_USD: z.number().nonnegative().optional(),
});

const forumIntegrationRuntimeEnvSchema = z.object({
  FORUM_SESSION_ENCRYPTION_KEY: z.string().trim().min(32),
});

const ogpForumAutomationRuntimeEnvSchema = z.object({
  OGP_FORUM_THREAD_FORM_URL: z
    .string()
    .url()
    .refine((value) => value.startsWith("https://forum.gta5rp.com/"), {
      message: "OGP_FORUM_THREAD_FORM_URL должен указывать на https://forum.gta5rp.com/...",
    }),
});

export function getAppRuntimeEnv() {
  return appRuntimeEnvSchema.parse({
    APP_URL: process.env.APP_URL,
  });
}

export function getAppReleaseEnv() {
  return appReleaseEnvSchema.parse({
    APP_ENV: process.env.APP_ENV,
    APP_URL: process.env.APP_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
  });
}

export function getSupabaseRuntimeEnv() {
  return supabaseRuntimeEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}

export function getSupabaseServiceRoleEnv() {
  return supabaseServiceRoleEnvSchema.parse({
    APP_URL: process.env.APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}

export function getAIProxyRuntimeEnv() {
  return aiProxyRuntimeEnvSchema.parse({
    AI_PROXY_ACTIVE_KEY: process.env.AI_PROXY_ACTIVE_KEY,
    AI_PROXY_CONFIGS_JSON: process.env.AI_PROXY_CONFIGS_JSON,
  });
}

export function getAssistantInternalProxyEnv() {
  return assistantInternalProxyEnvSchema.parse({
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    AI_PROXY_INTERNAL_TOKEN: process.env.AI_PROXY_INTERNAL_TOKEN,
  });
}

function parseBooleanEnv(value: string | undefined, fallback: boolean) {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return fallback;
  }

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function parseOptionalPositiveIntEnv(value: string | undefined) {
  const normalized = value?.trim() ?? "";

  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function parseOptionalNonNegativeNumberEnv(value: string | undefined) {
  const normalized = value?.trim() ?? "";

  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export function getAIQualityReviewRuntimeEnv() {
  return aiQualityReviewRuntimeEnvSchema.parse({
    AI_REVIEW_ENABLED: parseBooleanEnv(process.env.AI_REVIEW_ENABLED, true),
    AI_REVIEW_MODE: process.env.AI_REVIEW_MODE?.trim() || "log_only",
    AI_REVIEW_DAILY_REQUEST_LIMIT: parseOptionalPositiveIntEnv(
      process.env.AI_REVIEW_DAILY_REQUEST_LIMIT,
    ),
    AI_REVIEW_DAILY_COST_LIMIT_USD: parseOptionalNonNegativeNumberEnv(
      process.env.AI_REVIEW_DAILY_COST_LIMIT_USD,
    ),
  });
}

export function getForumIntegrationRuntimeEnv() {
  return forumIntegrationRuntimeEnvSchema.parse({
    FORUM_SESSION_ENCRYPTION_KEY: process.env.FORUM_SESSION_ENCRYPTION_KEY,
  });
}

export function getOgpForumAutomationRuntimeEnv() {
  return ogpForumAutomationRuntimeEnvSchema.parse({
    OGP_FORUM_THREAD_FORM_URL: process.env.OGP_FORUM_THREAD_FORM_URL,
  });
}

export function hasLiveSupabaseServiceRoleEnv(
  env: Partial<z.infer<typeof supabaseServiceRoleEnvSchema>>,
) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  const appUrl = env.APP_URL?.trim() ?? "";

  if (!url || !serviceRoleKey || !appUrl) {
    return false;
  }

  if (
    url.includes("your-") ||
    url.includes("example.supabase.co") ||
    serviceRoleKey.includes("your-") ||
    serviceRoleKey.includes("placeholder") ||
    appUrl.includes("your-") ||
    appUrl.includes("example.com")
  ) {
    return false;
  }

  return true;
}

export function isPlaceholderRuntimeValue(value: string | undefined) {
  const normalized = value?.trim() ?? "";

  if (!normalized) {
    return false;
  }

  return (
    normalized.includes("your-") ||
    normalized.includes("placeholder") ||
    normalized.includes("example") ||
    normalized.includes("postgres:postgres@") ||
    normalized.includes("@db:") ||
    normalized.includes("localhost") ||
    normalized.includes("127.0.0.1")
  );
}

export function hasLiveAppReleaseEnv(
  env: Partial<z.infer<typeof appReleaseEnvSchema>>,
) {
  const appEnv = env.APP_ENV?.trim() ?? "";
  const appUrl = env.APP_URL?.trim() ?? "";
  const databaseUrl = env.DATABASE_URL?.trim() ?? "";
  const directUrl = env.DIRECT_URL?.trim() ?? "";

  if (!appEnv || !appUrl || !databaseUrl || !directUrl) {
    return false;
  }

  if (appEnv !== "production") {
    return false;
  }

  if (
    isPlaceholderRuntimeValue(appUrl) ||
    isPlaceholderRuntimeValue(databaseUrl) ||
    isPlaceholderRuntimeValue(directUrl)
  ) {
    return false;
  }

  return true;
}

export function hasLiveSupabaseRuntimeEnv(
  env: Partial<z.infer<typeof supabaseRuntimeEnvSchema>>,
) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

  if (!url || !anonKey) {
    return false;
  }

  if (
    url.includes("your-") ||
    url.includes("example.supabase.co") ||
    anonKey.includes("your-") ||
    anonKey.includes("placeholder")
  ) {
    return false;
  }

  return true;
}

export function hasLiveAIProxyRuntimeEnv(
  env: Partial<z.infer<typeof aiProxyRuntimeEnvSchema>>,
) {
  const configsJson = env.AI_PROXY_CONFIGS_JSON?.trim() ?? "";

  if (!configsJson) {
    return false;
  }

  if (
    configsJson.includes("your-") ||
    configsJson.includes("example.com") ||
    configsJson.includes("placeholder")
  ) {
    return false;
  }

  return true;
}

export function hasLiveAssistantInternalProxyEnv(
  env: Partial<z.infer<typeof assistantInternalProxyEnvSchema>>,
) {
  const openAIKey = env.OPENAI_API_KEY?.trim() ?? "";
  const internalToken = env.AI_PROXY_INTERNAL_TOKEN?.trim() ?? "";

  if (!openAIKey || !internalToken) {
    return false;
  }

  if (
    openAIKey.includes("your-") ||
    openAIKey.includes("placeholder") ||
    internalToken.includes("your-") ||
    internalToken.includes("placeholder")
  ) {
    return false;
  }

  return true;
}

export function hasLiveForumIntegrationRuntimeEnv(
  env: Partial<z.infer<typeof forumIntegrationRuntimeEnvSchema>>,
) {
  const encryptionKey = env.FORUM_SESSION_ENCRYPTION_KEY?.trim() ?? "";

  if (encryptionKey.length < 32) {
    return false;
  }

  if (
    encryptionKey.includes("your-") ||
    encryptionKey.includes("placeholder") ||
    encryptionKey.includes("example")
  ) {
    return false;
  }

  return true;
}

export function hasLiveOgpForumAutomationRuntimeEnv(
  env: Partial<z.infer<typeof ogpForumAutomationRuntimeEnvSchema>>,
) {
  const threadFormUrl = env.OGP_FORUM_THREAD_FORM_URL?.trim() ?? "";

  if (!threadFormUrl) {
    return false;
  }

  if (
    !threadFormUrl.startsWith("https://forum.gta5rp.com/") ||
    threadFormUrl.includes("your-") ||
    threadFormUrl.includes("placeholder") ||
    threadFormUrl.includes("example")
  ) {
    return false;
  }

  return true;
}
