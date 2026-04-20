import { createClient } from "@supabase/supabase-js";

import { getSupabaseRuntimeEnv } from "@/schemas/env";

export function createPublicServerSupabaseClient() {
  const env = getSupabaseRuntimeEnv();

  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
