"use server";

import { redirect } from "next/navigation";
import { ZodError } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasLiveSupabaseRuntimeEnv } from "@/schemas/env";
import { signInWithIdentifierPassword } from "@/server/auth/sign-in";

export type SignInActionState = {
  errorMessage: string | null;
  fieldErrors: {
    identifier?: string;
    password?: string;
  };
};

function getRuntimeConfig() {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

export async function signInAction(
  _previousState: SignInActionState,
  formData: FormData,
): Promise<SignInActionState> {
  const identifier = typeof formData.get("identifier") === "string" ? String(formData.get("identifier")) : "";
  const password = typeof formData.get("password") === "string" ? String(formData.get("password")) : "";
  const nextPath = typeof formData.get("nextPath") === "string" ? String(formData.get("nextPath")) : "/app";

  if (!hasLiveSupabaseRuntimeEnv(getRuntimeConfig())) {
    return {
      errorMessage:
        "Сейчас подключены placeholder-переменные Supabase. UI доступен, но реальный вход не будет работать, пока не подставлены боевые значения.",
      fieldErrors: {},
    };
  }

  try {
    const result = await signInWithIdentifierPassword(
      await createServerSupabaseClient(),
      {
        identifier,
        password,
      },
      getRuntimeConfig(),
      nextPath,
    );

    if (result.status === "placeholder" || result.status === "error") {
      return {
        errorMessage: result.message,
        fieldErrors: {},
      };
    }

    redirect(result.nextPath);
  } catch (error) {
    if (error instanceof ZodError) {
      const fieldErrors = error.flatten().fieldErrors;

      return {
        errorMessage: null,
        fieldErrors: {
          identifier: fieldErrors.identifier?.[0],
          password: fieldErrors.password?.[0],
        },
      };
    }

    return {
      errorMessage: "Не удалось обработать вход. Проверь данные и попробуй ещё раз.",
      fieldErrors: {},
    };
  }
}

export async function signOutAction() {
  const supabase = await createServerSupabaseClient();

  await supabase.auth.signOut();
  redirect("/sign-in");
}
