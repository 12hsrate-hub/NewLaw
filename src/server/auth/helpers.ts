import { createServerSupabaseClient } from "@/lib/supabase/server";

type AuthUserLike = {
  id: string;
  email?: string | null;
} | null;

type AuthSessionLike = {
  access_token?: string;
  user?: AuthUserLike;
} | null;

export type SupabaseAuthClientLike = {
  auth: {
    getSession: () => Promise<{
      data: {
        session: AuthSessionLike;
      };
      error: Error | null;
    }>;
    getUser: () => Promise<{
      data: {
        user: AuthUserLike;
      };
      error: Error | null;
    }>;
  };
};

export class AuthRequiredError extends Error {
  constructor() {
    super("Authentication required");
    this.name = "AuthRequiredError";
  }
}

async function getAuthClient(client?: SupabaseAuthClientLike) {
  if (client) {
    return client;
  }

  return createServerSupabaseClient();
}

export async function getCurrentSession(client?: SupabaseAuthClientLike) {
  try {
    const authClient = await getAuthClient(client);
    const { data, error } = await authClient.auth.getSession();

    if (error) {
      return null;
    }

    return data.session;
  } catch {
    return null;
  }
}

export async function getCurrentUser(client?: SupabaseAuthClientLike) {
  try {
    const authClient = await getAuthClient(client);
    const { data, error } = await authClient.auth.getUser();

    if (error) {
      return null;
    }

    return data.user;
  } catch {
    return null;
  }
}

export async function isAuthenticatedServerSide(client?: SupabaseAuthClientLike) {
  const user = await getCurrentUser(client);

  return Boolean(user);
}

export async function requireAuthenticatedUser(client?: SupabaseAuthClientLike) {
  const user = await getCurrentUser(client);

  if (!user) {
    throw new AuthRequiredError();
  }

  return user;
}
