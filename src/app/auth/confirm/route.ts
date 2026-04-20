import { NextResponse, type NextRequest } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get("code");
    const nextPath = requestUrl.searchParams.get("next");
    const redirectPath = nextPath && nextPath.startsWith("/") ? nextPath : "/app";

    if (!code) {
      return NextResponse.redirect(new URL("/sign-in?status=missing-code", request.url));
    }

    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(new URL("/sign-in?status=auth-error", request.url));
    }

    return NextResponse.redirect(new URL(redirectPath, request.url));
  } catch {
    return NextResponse.redirect(new URL("/sign-in?status=auth-error", request.url));
  }
}
