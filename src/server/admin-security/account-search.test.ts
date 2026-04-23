import { describe, expect, it, vi } from "vitest";

import { findAccountForAdminSearch } from "@/server/admin-security/account-search";

const baseAccount = {
  id: "41be6f0d-06c2-4f32-bf39-7a83b6711b35",
  email: "user@example.com",
  login: "lawyer_admin_test",
  pendingEmail: "pending@example.com",
  mustChangePassword: false,
};

describe("admin account search", () => {
  it("ищет аккаунт по email", async () => {
    const getAccountByEmail = vi.fn().mockResolvedValue(baseAccount);

    const result = await findAccountForAdminSearch("User@example.com", {
      getAccountByEmail,
      getAccountById: vi.fn(),
      getAccountByLogin: vi.fn(),
    });

    expect(result.status).toBe("found");
    expect(getAccountByEmail).toHaveBeenCalledWith("user@example.com");
  });

  it("ищет аккаунт по login", async () => {
    const getAccountByLogin = vi.fn().mockResolvedValue(baseAccount);

    const result = await findAccountForAdminSearch("Lawyer_Admin_Test", {
      getAccountByEmail: vi.fn(),
      getAccountById: vi.fn(),
      getAccountByLogin,
    });

    expect(result.status).toBe("found");
    expect(getAccountByLogin).toHaveBeenCalledWith("lawyer_admin_test");
  });

  it("ищет аккаунт по account id", async () => {
    const getAccountById = vi.fn().mockResolvedValue(baseAccount);

    const result = await findAccountForAdminSearch(baseAccount.id, {
      getAccountByEmail: vi.fn(),
      getAccountById,
      getAccountByLogin: vi.fn(),
    });

    expect(result.status).toBe("found");
    expect(getAccountById).toHaveBeenCalledWith(baseAccount.id);
  });

  it("не пытается искать по character-level идентификаторам", async () => {
    const result = await findAccountForAdminSearch("Passport 123", {
      getAccountByEmail: vi.fn(),
      getAccountById: vi.fn(),
      getAccountByLogin: vi.fn(),
    });

    expect(result).toEqual({
      status: "invalid",
      identifier: "Passport 123",
      account: null,
      message: "Укажите корректный email, логин или ID аккаунта.",
    });
  });
});
