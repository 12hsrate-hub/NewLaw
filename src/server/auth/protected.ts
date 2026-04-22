import { redirect } from "next/navigation";

import { buildAccountSecurityPath } from "@/lib/routes/account-security";
import { syncAccountFromSupabaseUser } from "@/server/auth/account";
import { getCurrentUser } from "@/server/auth/helpers";

type ProtectedUser = {
  id: string;
  email?: string | null;
};

type ProtectedAccessDependencies = {
  getCurrentUser: typeof getCurrentUser;
  syncAccountFromSupabaseUser: typeof syncAccountFromSupabaseUser;
  redirect: (path: string) => never;
};

const defaultDependencies: ProtectedAccessDependencies = {
  getCurrentUser,
  syncAccountFromSupabaseUser,
  redirect,
};

export function buildSignInRedirectPath(nextPath: string) {
  const params = new URLSearchParams({
    next: nextPath,
  });

  return `/sign-in?${params.toString()}`;
}

export function buildMustChangePasswordRedirectPath() {
  return buildAccountSecurityPath("must-change-password");
}

export function buildAdminAccessDeniedRedirectPath() {
  return buildAccountSecurityPath("admin-access-denied");
}

type ProtectedAccessOptions = {
  allowMustChangePassword?: boolean;
};

export async function requireProtectedAccountContext(
  nextPath: string,
  dependencies: ProtectedAccessDependencies = defaultDependencies,
  options: ProtectedAccessOptions = {},
) {
  const user = (await dependencies.getCurrentUser()) as ProtectedUser | null;

  if (!user?.id) {
    return dependencies.redirect(buildSignInRedirectPath(nextPath));
  }

  if (!user.email) {
    throw new Error("Authenticated user email is required");
  }

  const account = await dependencies.syncAccountFromSupabaseUser(user);

  if (account.mustChangePassword && !options.allowMustChangePassword) {
    return dependencies.redirect(buildMustChangePasswordRedirectPath());
  }

  return {
    user,
    account,
  };
}

export async function requireSuperAdminAccountContext(
  nextPath: string,
  dependencies: ProtectedAccessDependencies = defaultDependencies,
  options: ProtectedAccessOptions = {},
) {
  const protectedContext = await requireProtectedAccountContext(
    nextPath,
    dependencies,
    options,
  );

  if (!protectedContext.account.isSuperAdmin) {
    return dependencies.redirect(buildAdminAccessDeniedRedirectPath());
  }

  return protectedContext;
}
