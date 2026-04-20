import { z } from "zod";

const appRuntimeEnvSchema = z.object({
  APP_URL: z.string().url(),
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

export function getAppRuntimeEnv() {
  return appRuntimeEnvSchema.parse({
    APP_URL: process.env.APP_URL,
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
