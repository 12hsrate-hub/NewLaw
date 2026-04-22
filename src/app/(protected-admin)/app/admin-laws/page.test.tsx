import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock("@/server/auth/protected", () => ({
  requireSuperAdminAccountContext: vi.fn(),
}));

import AdminLawsPage from "@/app/(protected-admin)/app/admin-laws/page";
import { redirect } from "next/navigation";
import { requireSuperAdminAccountContext } from "@/server/auth/protected";

describe("/app/admin-laws", () => {
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

    await expect(AdminLawsPage()).rejects.toThrowError("redirect:/internal/laws");

    expect(requireSuperAdminAccountContext).toHaveBeenCalledWith("/app/admin-laws");
    expect(redirect).toHaveBeenCalledWith("/internal/laws");
  });

  it("сохраняет существующий denied flow, если helper отклоняет доступ", async () => {
    vi.mocked(requireSuperAdminAccountContext).mockRejectedValue(
      new Error("redirect:/account/security?status=admin-access-denied"),
    );

    await expect(AdminLawsPage()).rejects.toThrowError(
      "redirect:/account/security?status=admin-access-denied",
    );

    expect(redirect).not.toHaveBeenCalledWith("/internal/laws");
  });
});
