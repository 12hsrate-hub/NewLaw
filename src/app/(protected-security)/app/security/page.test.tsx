import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock("@/server/auth/protected", () => ({
  requireProtectedAccountContext: vi.fn(),
}));

import ProtectedSecurityPage from "@/app/(protected-security)/app/security/page";
import { redirect } from "next/navigation";
import { requireProtectedAccountContext } from "@/server/auth/protected";

describe("/app/security compatibility route", () => {
  it("переводит self-service security flow в account zone", async () => {
    vi.mocked(requireProtectedAccountContext).mockResolvedValue({
      account: {
        id: "account-1",
        email: "user@example.com",
        login: "lawyer",
        mustChangePassword: false,
      },
    } as never);

    await expect(
      ProtectedSecurityPage({
        searchParams: Promise.resolve({
          status: "email-change-requested",
        }),
      }),
    ).rejects.toThrowError("redirect:/account/security?status=email-change-requested");

    expect(requireProtectedAccountContext).toHaveBeenCalledWith(
      "/app/security",
      undefined,
      {
        allowMustChangePassword: true,
      },
    );
    expect(redirect).toHaveBeenCalledWith(
      "/account/security?status=email-change-requested",
    );
  });

  it("нормализует старый denied query в canonical status", async () => {
    vi.mocked(requireProtectedAccountContext).mockResolvedValue({
      account: {
        id: "account-1",
        email: "user@example.com",
        login: "lawyer",
        mustChangePassword: false,
      },
    } as never);

    await expect(
      ProtectedSecurityPage({
        searchParams: Promise.resolve({
          denied: "admin-access",
        }),
      }),
    ).rejects.toThrowError("redirect:/account/security?status=admin-access-denied");
  });
});
