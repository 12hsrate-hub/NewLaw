import { mapSignInErrorToMessage, sanitizeNextPath, isSupabaseAuthRuntimeReady } from "@/lib/auth/email-auth";
import { getAccountByLogin } from "@/db/repositories/account.repository";
import {
  type SignInIdentifierInput,
  signInIdentifierInputSchema,
} from "@/schemas/auth";

type PublicSupabaseRuntimeConfig = {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
};

type ServerSignInClientLike = {
  auth: {
    signInWithPassword: (input: {
      email: string;
      password: string;
    }) => Promise<{
      error: {
        code?: string;
        message?: string;
        status?: number;
      } | null;
    }>;
  };
};

type ResolveSignInEmailDependencies = {
  getAccountByLogin: typeof getAccountByLogin;
};

const defaultResolveDependencies: ResolveSignInEmailDependencies = {
  getAccountByLogin,
};

type ServerSignInResult =
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

function isEmailIdentifier(identifier: string) {
  return identifier.includes("@");
}

export async function resolveSignInTargetEmail(
  identifier: string,
  dependencies: ResolveSignInEmailDependencies = defaultResolveDependencies,
) {
  const normalizedIdentifier = identifier.trim().toLowerCase();

  if (isEmailIdentifier(normalizedIdentifier)) {
    return normalizedIdentifier;
  }

  const account = await dependencies.getAccountByLogin(normalizedIdentifier);

  return account?.email?.trim().toLowerCase() ?? null;
}

export async function signInWithIdentifierPassword(
  client: ServerSignInClientLike,
  input: SignInIdentifierInput,
  runtimeConfig: PublicSupabaseRuntimeConfig,
  nextPath?: string | null,
  dependencies: ResolveSignInEmailDependencies = defaultResolveDependencies,
): Promise<ServerSignInResult> {
  if (!isSupabaseAuthRuntimeReady(runtimeConfig)) {
    return {
      status: "placeholder",
      message:
        "Сейчас подключены placeholder-переменные Supabase. UI доступен, но реальный вход не будет работать, пока не подставлены боевые значения.",
    };
  }

  const parsed = signInIdentifierInputSchema.parse(input);
  const targetEmail = await resolveSignInTargetEmail(parsed.identifier, dependencies);

  if (!targetEmail) {
    return {
      status: "error",
      message: "Не удалось войти. Проверь email, login, пароль и попробуй ещё раз.",
    };
  }

  const { error } = await client.auth.signInWithPassword({
    email: targetEmail,
    password: parsed.password,
  });

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
