import { describe, expect, it, vi } from "vitest";

import { syncAccountFromSupabaseUser } from "@/server/auth/account";

describe("account reconciliation", () => {
  it("создаёт новый account из Supabase user и login metadata", async () => {
    const createAccountFromReconciliation = vi.fn().mockResolvedValue({
      id: "fd790c10-133b-4747-af87-0fa8731f8b40",
      email: "user@example.com",
      login: "lawyer_user",
    });

    const result = await syncAccountFromSupabaseUser(
      {
        id: "fd790c10-133b-4747-af87-0fa8731f8b40",
        email: "User@example.com",
        user_metadata: {
          login: "Lawyer_User",
        },
      },
      {
        getAccountById: vi.fn().mockResolvedValue(null),
        isAccountLoginTaken: vi.fn().mockResolvedValue(false),
        createAccountFromReconciliation,
        syncAccountIdentityState: vi.fn(),
      },
    );

    expect(result.login).toBe("lawyer_user");
    expect(createAccountFromReconciliation).toHaveBeenCalledWith({
      id: "fd790c10-133b-4747-af87-0fa8731f8b40",
      email: "user@example.com",
      login: "lawyer_user",
    });
  });

  it("делает runtime fallback login и чистит pendingEmail для legacy account", async () => {
    const syncAccountIdentityState = vi.fn().mockResolvedValue({
      id: "fd790c10-133b-4747-af87-0fa8731f8b40",
      email: "legacy@example.com",
      login: "legacy_user",
      pendingEmail: null,
    });

    await syncAccountFromSupabaseUser(
      {
        id: "fd790c10-133b-4747-af87-0fa8731f8b40",
        email: "legacy@example.com",
        user_metadata: null,
      },
      {
        getAccountById: vi.fn().mockResolvedValue({
          id: "fd790c10-133b-4747-af87-0fa8731f8b40",
          email: "old@example.com",
          login: "",
          pendingEmail: "legacy@example.com",
        }),
        isAccountLoginTaken: vi.fn().mockResolvedValue(false),
        createAccountFromReconciliation: vi.fn(),
        syncAccountIdentityState,
      },
    );

    expect(syncAccountIdentityState).toHaveBeenCalledWith({
      accountId: "fd790c10-133b-4747-af87-0fa8731f8b40",
      email: "legacy@example.com",
      login: "legacy",
      clearPendingEmail: true,
    });
  });
});
