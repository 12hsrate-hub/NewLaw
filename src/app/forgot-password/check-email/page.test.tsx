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
  getCurrentUser: vi.fn(),
}));

vi.mock("@/components/product/auth/check-email-card", () => ({
  CheckEmailCard: ({ flow }: { flow: string }) => <div>{`check-email-card:${flow}`}</div>,
}));

import ForgotPasswordCheckEmailPage from "@/app/forgot-password/check-email/page";
import { getCurrentUser } from "@/server/auth/helpers";

describe("/forgot-password/check-email page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("использует workspace readable framing для письма восстановления", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const html = renderToStaticMarkup(await ForgotPasswordCheckEmailPage());

    expect(html).toContain('data-tone="workspace"');
    expect(html).toContain('data-variant="readable"');
    expect(html).toContain("check-email-card:recovery");
  });

  it("для уже авторизованного пользователя сохраняет redirect на default landing", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
    });

    await ForgotPasswordCheckEmailPage();

    expect(redirectMock).toHaveBeenCalledWith("/");
  });
});
