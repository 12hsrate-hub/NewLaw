import { NextResponse, type NextRequest } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAppRuntimeEnv } from "@/schemas/env";
import { confirmEmailFromUrl } from "@/server/auth/confirm";
import { setRecoveryAccessCookie } from "@/server/auth/recovery";

export async function GET(request: NextRequest) {
  const { APP_URL } = getAppRuntimeEnv();

  try {
    const result = await confirmEmailFromUrl(
      await createServerSupabaseClient(),
      new URL(request.url),
    );

    const response = NextResponse.redirect(new URL(result.redirectPath, APP_URL));

    if (result.setRecoveryAccessCookie) {
      setRecoveryAccessCookie(response);
    }

    return response;
  } catch {
    return NextResponse.redirect(new URL("/sign-in?status=auth-error", APP_URL));
  }
}
