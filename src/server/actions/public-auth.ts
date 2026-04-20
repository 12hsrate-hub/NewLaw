"use server";

import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  accountIdentifierSchema,
  resetPasswordInputSchema,
} from "@/schemas/account-security";
import { hasLiveSupabaseRuntimeEnv } from "@/schemas/env";
import { getCurrentSession, getCurrentUser } from "@/server/auth/helpers";
import {
  buildRecoveryInvalidPath,
  clearRecoveryAccessCookie,
  completeRecoveryPasswordReset,
  createPublicRecoveryClient,
  getRecoveryAppUrl,
  hasServerRecoveryAccess,
  requestPasswordRecovery,
} from "@/server/auth/recovery";

export type ForgotPasswordActionState = {
  errorMessage: string | null;
  fieldErrors: {
    identifier?: string;
  };
};

export type ResetPasswordActionState = {
  errorMessage: string | null;
  fieldErrors: {
    confirmNewPassword?: string;
    newPassword?: string;
  };
};

export const initialForgotPasswordActionState: ForgotPasswordActionState = {
  errorMessage: null,
  fieldErrors: {},
};

export const initialResetPasswordActionState: ResetPasswordActionState = {
  errorMessage: null,
  fieldErrors: {},
};

function getFirstIssueMessage(error: {
  issues?: Array<{
    message: string;
    path: Array<string | number>;
  }>;
}) {
  return error.issues?.[0]?.message ?? "Проверь данные формы и попробуй ещё раз.";
}

function hasLivePublicAuthRuntime() {
  return hasLiveSupabaseRuntimeEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}

export async function requestPasswordRecoveryAction(
  _previousState: ForgotPasswordActionState,
  formData: FormData,
): Promise<ForgotPasswordActionState> {
  const identifier = formData.get("identifier");
  const parsed = accountIdentifierSchema.safeParse(typeof identifier === "string" ? identifier : "");

  if (!parsed.success) {
    return {
      errorMessage: null,
      fieldErrors: {
        identifier: getFirstIssueMessage(parsed.error),
      },
    };
  }

  if (!hasLivePublicAuthRuntime()) {
    return {
      errorMessage:
        "Сейчас подключены placeholder-переменные Supabase. Без боевых значений и настроенного Custom SMTP письмо для восстановления не отправится.",
      fieldErrors: {},
    };
  }

  const result = await requestPasswordRecovery(
    createPublicRecoveryClient(),
    {
      identifier: parsed.data,
    },
    getRecoveryAppUrl(),
  );

  if (result.status === "placeholder" || result.status === "error") {
    return {
      errorMessage: result.message,
      fieldErrors: {},
    };
  }

  redirect(result.checkEmailPath);
}

export async function resetPasswordAction(
  _previousState: ResetPasswordActionState,
  formData: FormData,
): Promise<ResetPasswordActionState> {
  const hasRecoveryAccess = await hasServerRecoveryAccess({
    getCurrentSession,
    getCurrentUser,
  });

  if (!hasRecoveryAccess) {
    redirect(buildRecoveryInvalidPath());
  }

  const rawInput = {
    newPassword:
      typeof formData.get("newPassword") === "string" ? String(formData.get("newPassword")) : "",
    confirmNewPassword:
      typeof formData.get("confirmNewPassword") === "string"
        ? String(formData.get("confirmNewPassword"))
        : "",
  };
  const parsed = resetPasswordInputSchema.safeParse(rawInput);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return {
      errorMessage: null,
      fieldErrors: {
        newPassword: fieldErrors.newPassword?.[0],
        confirmNewPassword: fieldErrors.confirmNewPassword?.[0],
      },
    };
  }

  if (!hasLivePublicAuthRuntime()) {
    return {
      errorMessage:
        "Сейчас подключены placeholder-переменные Supabase. Без боевых значений обновление пароля не сработает.",
      fieldErrors: {},
    };
  }

  const supabase = await createServerSupabaseClient();
  const user = await getCurrentUser(supabase);

  if (!user?.id || !user.email) {
    redirect(buildRecoveryInvalidPath());
  }

  const result = await completeRecoveryPasswordReset(
    supabase,
    user,
    parsed.data,
  );

  if (result.status === "placeholder" || result.status === "error") {
    return {
      errorMessage: result.message,
      fieldErrors: {},
    };
  }

  await clearRecoveryAccessCookie();
  redirect(result.redirectPath);
}
