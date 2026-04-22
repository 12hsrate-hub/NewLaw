import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock("@/server/auth/protected", () => ({
  requireSuperAdminAccountContext: vi.fn(),
}));

import AdminSecurityPage from "@/app/(protected-admin)/app/admin-security/page";
import { redirect } from "next/navigation";
import { requireSuperAdminAccountContext } from "@/server/auth/protected";

describe("/app/admin-security", () => {
  it("ведет super_admin в новый internal contour", async () => {
    vi.mocked(requireSuperAdminAccountContext).mockResolvedValue({
      account: {
        id: "account-1",
        email: "admin@example.com",
        login: "admin",
        isSuperAdmin: true,
        mustChangePassword: false,
      },
      user: {
        id: "user-1",
        email: "admin@example.com",
      },
    } as never);

    await expect(AdminSecurityPage()).rejects.toThrowError("redirect:/internal/security");

    expect(requireSuperAdminAccountContext).toHaveBeenCalledWith("/app/admin-security");
    expect(redirect).toHaveBeenCalledWith("/internal/security");
  });

  it("сохраняет существующий denied flow, если helper отклоняет доступ", async () => {
    vi.mocked(requireSuperAdminAccountContext).mockRejectedValue(
      new Error("redirect:/app/security?denied=admin-access"),
    );

    await expect(AdminSecurityPage()).rejects.toThrowError(
      "redirect:/app/security?denied=admin-access",
    );

    expect(redirect).not.toHaveBeenCalledWith("/internal/security");
  });
});
