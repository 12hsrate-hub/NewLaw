import { cookies } from "next/headers";

import { buildEmailConfirmationRedirectUrl, buildStatusPath } from "@/lib/auth/email-auth";
import { createPublicServerSupabaseClient } from "@/lib/supabase/public-server";
import { getAccountByEmail, getAccountByLogin } from "@/db/repositories/account.repository";
import { createAuditLog } from "@/db/repositories/audit-log.repository";
import { updateMustChangePasswordState } from "@/db/repositories/account-security.repository";
import { hasLiveSupabaseRuntimeEnv, getAppRuntimeEnv } from "@/schemas/env";
import {
  accountIdentifierSchema,
  resetPasswordInputSchema,
  type ResetPasswordInput,
} from "@/schemas/account-security";
import { syncAccountFromSupabaseUser } from "@/server/auth/account";

const recoveryAccessCookieName = "lawyer5rp_recovery_access";
const recoveryAccessMaxAgeSeconds = 60 * 20;

type AuthErrorLike = {
  code?: string;
  message?: string;
  status?: number;
} | null;

type RecoveryRequestClientLike = {
  auth: {
    resetPasswordForEmail: (
      email: string,
      options: {
        redirectTo: string;
      },
    ) => Promise<{
      error: AuthErrorLike;
    }>;
  };
};

type PasswordResetClientLike = {
  auth: {
    updateUser: (input: {
      password: string;
    }) => Promise<{
      error: AuthErrorLike;
    }>;
    signOut: () => Promise<unknown>;
  };
};

type RecoveryUser = {
  id: string;
  email?: string | null;
  user_metadata?: {
    login?: unknown;
  } | null;
};

type RecoveryRequestDependencies = {
  getAccountByEmail: typeof getAccountByEmail;
  getAccountByLogin: typeof getAccountByLogin;
  createAuditLog: typeof createAuditLog;
};

type PasswordResetDependencies = {
  syncAccountFromSupabaseUser: typeof syncAccountFromSupabaseUser;
  updateMustChangePasswordState: typeof updateMustChangePasswordState;
  createAuditLog: typeof createAuditLog;
};

const defaultRecoveryRequestDependencies: RecoveryRequestDependencies = {
  getAccountByEmail,
  getAccountByLogin,
  createAuditLog,
};

const defaultPasswordResetDependencies: PasswordResetDependencies = {
  syncAccountFromSupabaseUser,
  updateMustChangePasswordState,
  createAuditLog,
};

function isEmailIdentifier(value: string) {
  return value.includes("@");
}

function getServerRuntimeConfig() {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

export function getRecoveryAccessCookieName() {
  return recoveryAccessCookieName;
}

export function buildForgotPasswordCheckEmailPath() {
  return buildStatusPath("/forgot-password/check-email", "recovery-sent");
}

export function buildRecoveryInvalidPath() {
  return buildStatusPath("/sign-in", "recovery-invalid");
}

export function buildRecoveryExpiredPath() {
  return buildStatusPath("/sign-in", "recovery-expired");
}

export function buildPasswordResetSuccessPath() {
  return buildStatusPath("/sign-in", "password-reset-success");
}

export function buildPasswordRecoveryRedirectUrl(origin: string) {
  return buildEmailConfirmationRedirectUrl(origin, "/reset-password");
}

export function hasValidRecoveryAccess(input: {
  hasRecoveryCookie: boolean;
  userId?: string | null;
  accessToken?: string | null;
}) {
  return Boolean(input.hasRecoveryCookie && input.userId && input.accessToken);
}

export async function hasServerRecoveryAccess(input: {
  getCurrentSession: () => Promise<{
    access_token?: string;
  } | null>;
  getCurrentUser: () => Promise<{
    id: string;
  } | null>;
}) {
  const cookieStore = await cookies();
  const session = await input.getCurrentSession();
  const user = await input.getCurrentUser();

  return hasValidRecoveryAccess({
    hasRecoveryCookie: cookieStore.get(recoveryAccessCookieName)?.value === "1",
    userId: user?.id ?? null,
    accessToken: session?.access_token ?? null,
  });
}

export function setRecoveryAccessCookie(response: {
  cookies: {
    set: (input: {
      name: string;
      value: string;
      httpOnly: boolean;
      maxAge: number;
      path: string;
      sameSite: "lax";
      secure: boolean;
    }) => void;
  };
}) {
  response.cookies.set({
    name: recoveryAccessCookieName,
    value: "1",
    httpOnly: true,
    maxAge: recoveryAccessMaxAgeSeconds,
    path: "/reset-password",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearRecoveryAccessCookie() {
  const cookieStore = await cookies();

  cookieStore.set(recoveryAccessCookieName, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/reset-password",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function requestPasswordRecovery(
  client: RecoveryRequestClientLike,
  input: {
    identifier: string;
  },
  origin: string,
  dependencies: RecoveryRequestDependencies = defaultRecoveryRequestDependencies,
) {
  if (!hasLiveSupabaseRuntimeEnv(getServerRuntimeConfig())) {
    return {
      status: "placeholder" as const,
      message: "Восстановление доступа временно недоступно. Попробуй ещё раз немного позже.",
    };
  }

  const identifier = accountIdentifierSchema.parse(input.identifier);
  const normalizedIdentifier = identifier.trim().toLowerCase();
  const identifierType = isEmailIdentifier(normalizedIdentifier) ? "email" : "login";
  const targetAccount =
    identifierType === "email"
      ? await dependencies.getAccountByEmail(normalizedIdentifier)
      : await dependencies.getAccountByLogin(normalizedIdentifier);
  const targetEmail =
    identifierType === "email" ? normalizedIdentifier : targetAccount?.email ?? null;

  if (targetEmail) {
    const { error } = await client.auth.resetPasswordForEmail(targetEmail, {
      redirectTo: buildPasswordRecoveryRedirectUrl(origin),
    });

    if (error) {
      await dependencies.createAuditLog({
        actionKey: "forgot_password_requested",
        status: "failure",
        targetAccountId: targetAccount?.id ?? null,
        metadataJson: {
          identifierType,
        },
      });

      return {
        status: "error" as const,
        message:
          "Не удалось подготовить письмо для восстановления. Попробуй ещё раз немного позже.",
      };
    }
  }

  await dependencies.createAuditLog({
    actionKey: "forgot_password_requested",
    status: "success",
    targetAccountId: targetAccount?.id ?? null,
    metadataJson: {
      identifierType,
      emailDeliveryRequested: Boolean(targetEmail),
    },
  });

  return {
    status: "check-email" as const,
    checkEmailPath: buildForgotPasswordCheckEmailPath(),
  };
}

export async function completeRecoveryPasswordReset(
  client: PasswordResetClientLike,
  user: RecoveryUser,
  input: ResetPasswordInput,
  dependencies: PasswordResetDependencies = defaultPasswordResetDependencies,
) {
  if (!hasLiveSupabaseRuntimeEnv(getServerRuntimeConfig())) {
    return {
      status: "placeholder" as const,
      message: "Смена пароля временно недоступна. Попробуй ещё раз немного позже.",
    };
  }

  const parsed = resetPasswordInputSchema.parse(input);
  const account = await dependencies.syncAccountFromSupabaseUser(user);
  const { error } = await client.auth.updateUser({
    password: parsed.newPassword,
  });

  if (error) {
    await dependencies.createAuditLog({
      actionKey: "password_reset_completed",
      status: "failure",
      actorAccountId: account.id,
      targetAccountId: account.id,
      metadataJson: {
        flow: "recovery",
      },
    });

    return {
      status: "error" as const,
      message: "Не удалось сохранить новый пароль. Попробуй открыть ссылку из письма ещё раз.",
    };
  }

  const changedAt = new Date();

  await dependencies.updateMustChangePasswordState({
    accountId: account.id,
    mustChangePassword: false,
    reason: null,
    changedAt,
  });

  await dependencies.createAuditLog({
    actionKey: "password_reset_completed",
    status: "success",
    actorAccountId: account.id,
    targetAccountId: account.id,
    metadataJson: {
      flow: "recovery",
    },
  });

  await client.auth.signOut();

  return {
    status: "success" as const,
    redirectPath: buildPasswordResetSuccessPath(),
  };
}

export function createPublicRecoveryClient() {
  return createPublicServerSupabaseClient();
}

export function getRecoveryAppUrl() {
  return getAppRuntimeEnv().APP_URL;
}
