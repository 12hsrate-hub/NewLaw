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

vi.mock("@/components/product/auth/forgot-password-form", () => ({
  ForgotPasswordForm: ({ nextPath }: { nextPath: string }) => (
    <div>{`forgot-password-form:${nextPath}`}</div>
  ),
}));

import ForgotPasswordPage from "@/app/forgot-password/page";
import { getCurrentUser } from "@/server/auth/helpers";

describe("/forgot-password page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("использует workspace split framing для восстановления", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const html = renderToStaticMarkup(
      await ForgotPasswordPage({
        searchParams: Promise.resolve({
          next: "/servers",
        }),
      }),
    );

    expect(html).toContain('data-tone="workspace"');
    expect(html).toContain('data-variant="split"');
    expect(html).toContain("forgot-password-form:/servers");
    expect(html).toContain("Восстановление доступа к аккаунту");
  });

  it("для уже авторизованного пользователя сохраняет redirect semantics", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
    });

    await ForgotPasswordPage({
      searchParams: Promise.resolve({
        next: "/assistant",
      }),
    });

    expect(redirectMock).toHaveBeenCalledWith("/assistant");
  });
});
