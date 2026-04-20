import { createClient } from "@supabase/supabase-js";

import { getSupabaseServiceRoleEnv } from "@/schemas/env";

export function createServiceRoleSupabaseClient() {
  const env = getSupabaseServiceRoleEnv();

  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
