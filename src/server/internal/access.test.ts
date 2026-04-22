import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/auth/protected", () => ({
  requireProtectedAccountContext: vi.fn(),
}));

import { requireProtectedAccountContext } from "@/server/auth/protected";
import { getInternalAccessContext } from "@/server/internal/access";

describe("internal access context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("требует auth и передаёт корректный nextPath для internal route", async () => {
    const redirectError = new Error("redirect");
    vi.mocked(requireProtectedAccountContext).mockRejectedValue(redirectError);

    await expect(getInternalAccessContext("/internal/laws")).rejects.toBe(redirectError);

    expect(requireProtectedAccountContext).toHaveBeenCalledWith(
      "/internal/laws",
      undefined,
      {
        allowMustChangePassword: true,
      },
    );
  });

  it("возвращает granted для super_admin", async () => {
    vi.mocked(requireProtectedAccountContext).mockResolvedValue({
      user: {
        id: "user-1",
        email: "admin@example.com",
      },
      account: {
        id: "account-1",
        email: "admin@example.com",
        login: "admin",
        isSuperAdmin: true,
        mustChangePassword: false,
      },
    } as never);

    const result = await getInternalAccessContext("/internal");

    expect(result).toEqual({
      status: "granted",
      viewer: {
        accountId: "account-1",
        email: "admin@example.com",
        login: "admin",
      },
    });
  });

  it("возвращает honest denied flow для авторизованного не-super_admin", async () => {
    vi.mocked(requireProtectedAccountContext).mockResolvedValue({
      user: {
        id: "user-1",
        email: "user@example.com",
      },
      account: {
        id: "account-1",
        email: "user@example.com",
        login: "tester",
        isSuperAdmin: false,
        mustChangePassword: false,
      },
    } as never);

    const result = await getInternalAccessContext("/internal/security");

    expect(result).toEqual({
      status: "denied",
      viewer: {
        accountId: "account-1",
        email: "user@example.com",
        login: "tester",
      },
    });
  });
});
