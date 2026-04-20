"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasLiveSupabaseRuntimeEnv, getAppRuntimeEnv } from "@/schemas/env";
import { changeEmailInputSchema, changePasswordInputSchema } from "@/schemas/account-security";
import { requireProtectedAccountContext } from "@/server/auth/protected";
import {
  changePasswordSelfService,
  requestEmailChangeSelfService,
} from "@/server/auth/security";

export type ChangePasswordActionState = {
  errorMessage: string | null;
  fieldErrors: {
    currentPassword?: string;
    newPassword?: string;
    confirmNewPassword?: string;
  };
};

export type ChangeEmailActionState = {
  errorMessage: string | null;
  fieldErrors: {
    currentPassword?: string;
    newEmail?: string;
  };
};

const initialRuntimeConfig = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

export async function changePasswordAction(
  _previousState: ChangePasswordActionState,
  formData: FormData,
): Promise<ChangePasswordActionState> {
  const { account } = await requireProtectedAccountContext(
    "/app/security",
    undefined,
    {
      allowMustChangePassword: true,
    },
  );
  const rawInput = {
    currentPassword:
      typeof formData.get("currentPassword") === "string" ? String(formData.get("currentPassword")) : "",
    newPassword:
      typeof formData.get("newPassword") === "string" ? String(formData.get("newPassword")) : "",
    confirmNewPassword:
      typeof formData.get("confirmNewPassword") === "string"
        ? String(formData.get("confirmNewPassword"))
        : "",
  };
  const parsed = changePasswordInputSchema.safeParse(rawInput);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return {
      errorMessage: null,
      fieldErrors: {
        currentPassword: fieldErrors.currentPassword?.[0],
        newPassword: fieldErrors.newPassword?.[0],
        confirmNewPassword: fieldErrors.confirmNewPassword?.[0],
      },
    };
  }

  if (!hasLiveSupabaseRuntimeEnv(initialRuntimeConfig)) {
    return {
      errorMessage:
        "Сейчас подключены placeholder-переменные Supabase. Без боевых значений смена пароля не сработает.",
      fieldErrors: {},
    };
  }

  const result = await changePasswordSelfService(
    await createServerSupabaseClient(),
    {
      id: account.id,
      email: account.email,
      login: account.login,
      pendingEmail: account.pendingEmail,
      mustChangePassword: account.mustChangePassword,
    },
    parsed.data,
  );

  if (result.status === "error") {
    return {
      errorMessage: result.message,
      fieldErrors: {},
    };
  }

  revalidatePath("/app");
  revalidatePath("/app/security");
  redirect(result.redirectPath);
}

export async function changeEmailAction(
  _previousState: ChangeEmailActionState,
  formData: FormData,
): Promise<ChangeEmailActionState> {
  const { account } = await requireProtectedAccountContext(
    "/app/security",
    undefined,
    {
      allowMustChangePassword: true,
    },
  );
  const rawInput = {
    newEmail:
      typeof formData.get("newEmail") === "string" ? String(formData.get("newEmail")) : "",
    currentPassword:
      typeof formData.get("currentPassword") === "string" ? String(formData.get("currentPassword")) : "",
  };
  const parsed = changeEmailInputSchema.safeParse(rawInput);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return {
      errorMessage: null,
      fieldErrors: {
        newEmail: fieldErrors.newEmail?.[0],
        currentPassword: fieldErrors.currentPassword?.[0],
      },
    };
  }

  if (!hasLiveSupabaseRuntimeEnv(initialRuntimeConfig)) {
    return {
      errorMessage:
        "Сейчас подключены placeholder-переменные Supabase. Без боевых значений смена email не сработает.",
      fieldErrors: {},
    };
  }

  const result = await requestEmailChangeSelfService(
    await createServerSupabaseClient(),
    {
      id: account.id,
      email: account.email,
      login: account.login,
      pendingEmail: account.pendingEmail,
      mustChangePassword: account.mustChangePassword,
    },
    parsed.data,
    getAppRuntimeEnv().APP_URL,
  );

  if (result.status === "blocked" || result.status === "error") {
    return {
      errorMessage: result.message,
      fieldErrors: {},
    };
  }

  revalidatePath("/app");
  revalidatePath("/app/security");
  redirect(result.redirectPath);
}
