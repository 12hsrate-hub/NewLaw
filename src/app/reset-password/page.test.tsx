import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn(),
}));

vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/navigation")>();

  return {
    ...actual,
    redirect: redirectMock,
  };
});

vi.mock("@/server/auth/helpers", () => ({
  getCurrentSession: vi.fn(),
  getCurrentUser: vi.fn(),
}));

vi.mock("@/server/auth/recovery", () => ({
  buildRecoveryInvalidPath: vi.fn(() => "/sign-in?status=recovery-invalid"),
  hasServerRecoveryAccess: vi.fn(),
}));

vi.mock("@/components/product/auth/reset-password-form", () => ({
  ResetPasswordForm: () => <div>reset-password-form</div>,
}));

import ResetPasswordPage from "@/app/reset-password/page";
import { hasServerRecoveryAccess } from "@/server/auth/recovery";

describe("/reset-password page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("использует workspace split framing для смены пароля", async () => {
    vi.mocked(hasServerRecoveryAccess).mockResolvedValue(true);

    const html = renderToStaticMarkup(await ResetPasswordPage());

    expect(html).toContain('data-tone="workspace"');
    expect(html).toContain('data-variant="split"');
    expect(html).toContain("reset-password-form");
    expect(html).toContain("Задайте новый пароль");
  });

  it("сохраняет recovery redirect, если серверный доступ к смене пароля недоступен", async () => {
    vi.mocked(hasServerRecoveryAccess).mockResolvedValue(false);

    await ResetPasswordPage();

    expect(redirectMock).toHaveBeenCalledWith("/sign-in?status=recovery-invalid");
  });
});
