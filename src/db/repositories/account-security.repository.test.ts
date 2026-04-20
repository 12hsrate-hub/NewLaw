import { describe, expect, it, vi } from "vitest";

import {
  DirectAccountEmailUpdateError,
  createAccountFromReconciliation,
  updateMustChangePasswordState,
  updateAccountMutableFields,
} from "@/db/repositories/account-security.repository";

describe("account security repository", () => {
  it("запрещает прямой update Account.email", async () => {
    await expect(
      updateAccountMutableFields(
        "ec0cc8c6-8393-4073-b5a5-2d595f170cae",
        {
          email: "new@example.com",
        },
        {
          account: {
            findUnique: vi.fn(),
            findFirst: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
          },
        },
      ),
    ).rejects.toBeInstanceOf(DirectAccountEmailUpdateError);
  });

  it("создаёт аккаунт только через reconciliation-слой с login", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "ec0cc8c6-8393-4073-b5a5-2d595f170cae",
      email: "user@example.com",
      login: "lawyer_user",
    });

    const result = await createAccountFromReconciliation(
      {
        id: "ec0cc8c6-8393-4073-b5a5-2d595f170cae",
        email: "user@example.com",
        login: "Lawyer_User",
      },
      {
        account: {
          findUnique: vi.fn(),
          findFirst: vi.fn(),
          create,
          update: vi.fn(),
        },
      },
    );

    expect(result.login).toBe("lawyer_user");
    expect(create).toHaveBeenCalledWith({
      data: {
        id: "ec0cc8c6-8393-4073-b5a5-2d595f170cae",
        email: "user@example.com",
        login: "lawyer_user",
      },
    });
  });

  it("умеет явно очищать passwordChangedAt для admin reset сценария", async () => {
    const update = vi.fn().mockResolvedValue({
      id: "ec0cc8c6-8393-4073-b5a5-2d595f170cae",
      mustChangePassword: true,
      mustChangePasswordReason: "admin_reset",
      passwordChangedAt: null,
    });

    await updateMustChangePasswordState(
      {
        accountId: "ec0cc8c6-8393-4073-b5a5-2d595f170cae",
        mustChangePassword: true,
        reason: "admin_reset",
        changedAt: null,
      },
      {
        account: {
          findUnique: vi.fn(),
          findFirst: vi.fn(),
          create: vi.fn(),
          update,
        },
      },
    );

    expect(update).toHaveBeenCalledWith({
      where: {
        id: "ec0cc8c6-8393-4073-b5a5-2d595f170cae",
      },
      data: {
        mustChangePassword: true,
        mustChangePasswordReason: "admin_reset",
        passwordChangedAt: null,
      },
    });
  });
});
