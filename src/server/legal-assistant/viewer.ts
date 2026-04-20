import { syncAccountFromSupabaseUser } from "@/server/auth/account";
import { getCurrentUser } from "@/server/auth/helpers";

export async function getAssistantViewerContext() {
  const user = await getCurrentUser();

  if (!user?.id || !user.email) {
    return {
      user: null,
      account: null,
      isAuthenticated: false,
    };
  }

  const account = await syncAccountFromSupabaseUser(user);

  return {
    user,
    account,
    isAuthenticated: true,
  };
}
