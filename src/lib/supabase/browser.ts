import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseRuntimeEnv } from "@/schemas/env";

export function createBrowserSupabaseClient() {
  const env = getSupabaseRuntimeEnv();

  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
