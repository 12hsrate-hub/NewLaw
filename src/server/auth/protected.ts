import { redirect } from "next/navigation";

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

export async function requireProtectedAccountContext(
  nextPath: string,
  dependencies: ProtectedAccessDependencies = defaultDependencies,
) {
  const user = (await dependencies.getCurrentUser()) as ProtectedUser | null;

  if (!user?.id) {
    return dependencies.redirect(buildSignInRedirectPath(nextPath));
  }

  if (!user.email) {
    throw new Error("Authenticated user email is required");
  }

  const account = await dependencies.syncAccountFromSupabaseUser(user);

  return {
    user,
    account,
  };
}
