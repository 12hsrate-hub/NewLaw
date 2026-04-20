import type { EmailOtpType } from "@supabase/supabase-js";

import {
  type SignInInput,
  signInInputSchema,
  type SignUpInput,
  signUpInputSchema,
} from "@/schemas/auth";
import { hasLiveSupabaseRuntimeEnv } from "@/schemas/env";

const supportedEmailOtpTypes = [
  "email",
  "signup",
  "magiclink",
  "recovery",
  "invite",
  "email_change",
] as const satisfies readonly EmailOtpType[];

type PublicSupabaseRuntimeConfig = {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
};

type BrowserAuthClientLike = {
  auth: {
    signInWithPassword: (input: SignInInput) => Promise<{
      error: AuthErrorLike | null;
    }>;
    signOut: () => Promise<unknown>;
    signUp: (input: {
      email: string;
      password: string;
      options: {
        emailRedirectTo: string;
        data: {
          login: string;
        };
      };
    }) => Promise<{
      data: {
        session: unknown | null;
      };
      error: AuthErrorLike | null;
    }>;
    verifyOtp: (input: {
      token_hash: string;
      type: EmailOtpType;
    }) => Promise<{
      error: AuthErrorLike | null;
    }>;
  };
};

type ConfirmationAuthClientLike = {
  auth: {
    verifyOtp: BrowserAuthClientLike["auth"]["verifyOtp"];
  };
};

type AuthErrorLike = {
  code?: string;
  message?: string;
  status?: number;
};

type ConfirmEmailInput = {
  nextPath: string;
  tokenHash: string | null;
  type: string | null;
};

type ConfirmEmailResult =
  | {
      redirectPath: string;
      status: "success";
    }
  | {
      redirectPath: string;
      status: "expired";
    }
  | {
      redirectPath: string;
      status: "invalid";
    };

type SignInResult =
  | {
      nextPath: string;
      status: "success";
    }
  | {
      message: string;
      status: "error";
    }
  | {
      message: string;
      status: "placeholder";
    };

type SignUpResult =
  | {
      checkEmailPath: string;
      status: "confirmation-required";
    }
  | {
      message: string;
      status: "error";
    }
  | {
      message: string;
      status: "placeholder";
    };

export function sanitizeNextPath(nextPath: string | null | undefined) {
  if (typeof nextPath === "string" && nextPath.startsWith("/")) {
    return nextPath;
  }

  return "/app";
}

export function buildStatusPath(pathname: string, status: string, extraParams?: Record<string, string>) {
  const params = new URLSearchParams({
    status,
  });

  Object.entries(extraParams ?? {}).forEach(([key, value]) => {
    params.set(key, value);
  });

  return `${pathname}?${params.toString()}`;
}

function mapSignInErrorToMessage(error: AuthErrorLike) {
  if (
    error.code === "email_not_confirmed" ||
    error.message?.toLowerCase().includes("email not confirmed")
  ) {
    return "Подтверди email по ссылке из письма, а затем попробуй войти снова.";
  }

  return "Не удалось войти. Проверь email, пароль и попробуй ещё раз.";
}

function mapSignUpErrorToMessage(error: AuthErrorLike) {
  if (
    error.code === "user_already_exists" ||
    error.message?.toLowerCase().includes("already registered")
  ) {
    return "Не удалось создать аккаунт. Если email уже использовался, попробуй войти или подтверди письмо из предыдущей регистрации.";
  }

  return "Не удалось создать аккаунт. Проверь данные и попробуй ещё раз.";
}

function mapConfirmErrorToStatus(error: AuthErrorLike) {
  const normalizedMessage = error.message?.toLowerCase() ?? "";

  if (
    error.code === "otp_expired" ||
    normalizedMessage.includes("expired") ||
    normalizedMessage.includes("invalid or has expired")
  ) {
    return "expired" as const;
  }

  return "invalid" as const;
}

export function isSupabaseAuthRuntimeReady(config: PublicSupabaseRuntimeConfig) {
  return hasLiveSupabaseRuntimeEnv(config);
}

export function buildEmailConfirmationRedirectUrl(origin: string, nextPath?: string | null) {
  const redirectUrl = new URL("/auth/confirm", origin);
  const sanitizedNextPath = sanitizeNextPath(nextPath);

  redirectUrl.searchParams.set("next", sanitizedNextPath);

  return redirectUrl.toString();
}

export function buildCheckEmailPath(nextPath?: string | null) {
  const sanitizedNextPath = sanitizeNextPath(nextPath);

  return buildStatusPath("/sign-up/check-email", "signup-sent", {
    next: sanitizedNextPath,
  });
}

export async function signInWithEmailPassword(
  client: Pick<BrowserAuthClientLike, "auth">,
  input: SignInInput,
  runtimeConfig: PublicSupabaseRuntimeConfig,
  nextPath?: string | null,
): Promise<SignInResult> {
  if (!isSupabaseAuthRuntimeReady(runtimeConfig)) {
    return {
      status: "placeholder",
      message:
        "Сейчас подключены placeholder-переменные Supabase. UI доступен, но реальный вход не будет работать, пока не подставлены боевые значения.",
    };
  }

  const parsed = signInInputSchema.parse(input);
  const { error } = await client.auth.signInWithPassword(parsed);

  if (error) {
    return {
      status: "error",
      message: mapSignInErrorToMessage(error),
    };
  }

  return {
    status: "success",
    nextPath: sanitizeNextPath(nextPath),
  };
}

export async function signUpWithEmailPassword(
  client: Pick<BrowserAuthClientLike, "auth">,
  input: SignUpInput,
  runtimeConfig: PublicSupabaseRuntimeConfig,
  origin: string,
  nextPath?: string | null,
): Promise<SignUpResult> {
  if (!isSupabaseAuthRuntimeReady(runtimeConfig)) {
    return {
      status: "placeholder",
      message:
        "Сейчас подключены placeholder-переменные Supabase. Экран регистрации доступен, но реальное письмо подтверждения не отправится, пока не подставлены боевые значения Supabase и не будет настроен Custom SMTP в проекте.",
    };
  }

  const parsed = signUpInputSchema.parse(input);
  const emailRedirectTo = buildEmailConfirmationRedirectUrl(origin, nextPath);
  const { data, error } = await client.auth.signUp({
    email: parsed.email,
    password: parsed.password,
    options: {
      emailRedirectTo,
      data: {
        login: parsed.login,
      },
    },
  });

  if (error) {
    return {
      status: "error",
      message: mapSignUpErrorToMessage(error),
    };
  }

  if (data.session) {
    await client.auth.signOut();
  }

  return {
    status: "confirmation-required",
    checkEmailPath: buildCheckEmailPath(nextPath),
  };
}

export function parseEmailConfirmationInput(input: ConfirmEmailInput) {
  const normalizedType = input.type?.trim() ?? null;
  const normalizedTokenHash = input.tokenHash?.trim() ?? null;
  const sanitizedNextPath = sanitizeNextPath(input.nextPath);

  const isSupportedType = normalizedType
    ? supportedEmailOtpTypes.includes(normalizedType as (typeof supportedEmailOtpTypes)[number])
    : false;

  return {
    tokenHash: normalizedTokenHash,
    type: isSupportedType ? (normalizedType as EmailOtpType) : null,
    nextPath: sanitizedNextPath,
  };
}

export async function completeEmailConfirmation(
  client: ConfirmationAuthClientLike,
  input: ConfirmEmailInput,
): Promise<ConfirmEmailResult> {
  const parsed = parseEmailConfirmationInput(input);

  if (!parsed.tokenHash || !parsed.type) {
    return {
      status: "invalid",
      redirectPath: buildStatusPath("/sign-in", "confirmation-invalid"),
    };
  }

  const { error } = await client.auth.verifyOtp({
    token_hash: parsed.tokenHash,
    type: parsed.type,
  });

  if (error) {
    const status = mapConfirmErrorToStatus(error);

    return {
      status,
      redirectPath: buildStatusPath(
        "/sign-in",
        status === "expired" ? "confirmation-expired" : "confirmation-invalid",
      ),
    };
  }

  return {
    status: "success",
    redirectPath: parsed.nextPath,
  };
}
