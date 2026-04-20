import {
  createAccountFromReconciliation,
  isAccountLoginTaken,
  syncAccountIdentityState,
} from "@/db/repositories/account-security.repository";
import { getAccountById } from "@/db/repositories/account.repository";
import { accountLoginSchema } from "@/schemas/account-security";
import { resolveAccountLoginWithFallback } from "@/server/account-security/login";

type AuthenticatedAccountUser = {
  id: string;
  email?: string | null;
  user_metadata?: {
    login?: unknown;
  } | null;
};

type ReconciliationDependencies = {
  getAccountById: typeof getAccountById;
  isAccountLoginTaken: typeof isAccountLoginTaken;
  createAccountFromReconciliation: typeof createAccountFromReconciliation;
  syncAccountIdentityState: typeof syncAccountIdentityState;
};

const defaultDependencies: ReconciliationDependencies = {
  getAccountById,
  isAccountLoginTaken,
  createAccountFromReconciliation,
  syncAccountIdentityState,
};

function extractRequestedLogin(user: AuthenticatedAccountUser) {
  const loginValue = user.user_metadata?.login;

  if (typeof loginValue !== "string") {
    return null;
  }

  const parsedLogin = accountLoginSchema.safeParse(loginValue);

  return parsedLogin.success ? parsedLogin.data : null;
}

export async function syncAccountFromSupabaseUser(
  user: AuthenticatedAccountUser,
  dependencies: ReconciliationDependencies = defaultDependencies,
) {
  if (!user.email) {
    throw new Error("Authenticated user email is required");
  }

  const normalizedEmail = user.email.trim().toLowerCase();
  const existingAccount = await dependencies.getAccountById(user.id);
  const requestedLogin = extractRequestedLogin(user);

  if (!existingAccount) {
    const resolvedLogin = await resolveAccountLoginWithFallback({
      requestedLogin,
      email: normalizedEmail,
      accountId: user.id,
      allowRequestedConflictFallback: true,
      isLoginTaken: (login) => dependencies.isAccountLoginTaken(login),
    });

    if (!resolvedLogin) {
      throw new Error("Failed to resolve account login during account creation");
    }

    return dependencies.createAccountFromReconciliation({
      id: user.id,
      email: normalizedEmail,
      login: resolvedLogin,
    });
  }

  let nextLogin: string | undefined;

  if (!existingAccount.login) {
    const resolvedLogin = await resolveAccountLoginWithFallback({
      requestedLogin,
      email: normalizedEmail,
      accountId: existingAccount.id,
      allowRequestedConflictFallback: true,
      isLoginTaken: (login) => dependencies.isAccountLoginTaken(login, existingAccount.id),
    });

    if (!resolvedLogin) {
      throw new Error("Failed to resolve account login during legacy account backfill");
    }

    nextLogin = resolvedLogin;
  }

  return dependencies.syncAccountIdentityState({
    accountId: existingAccount.id,
    email: normalizedEmail,
    login: nextLogin,
    clearPendingEmail:
      typeof existingAccount.pendingEmail === "string" &&
      existingAccount.pendingEmail.toLowerCase() === normalizedEmail,
  });
}
