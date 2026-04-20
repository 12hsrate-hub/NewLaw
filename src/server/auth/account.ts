import { upsertAccountFromAuthUser } from "@/db/repositories/account.repository";

type AuthenticatedAccountUser = {
  id: string;
  email?: string | null;
};

export async function syncAccountFromSupabaseUser(user: AuthenticatedAccountUser) {
  if (!user.email) {
    throw new Error("Authenticated user email is required");
  }

  return upsertAccountFromAuthUser({
    id: user.id,
    email: user.email,
  });
}
