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

vi.mock("@/components/product/auth/sign-in-form", () => ({
  SignInForm: ({ nextPath }: { nextPath: string }) => <div>{`sign-in-form:${nextPath}`}</div>,
}));

import SignInPage from "@/app/sign-in/page";
import { getCurrentUser } from "@/server/auth/helpers";

describe("/sign-in page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("использует workspace split framing для формы входа", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const html = renderToStaticMarkup(
      await SignInPage({
        searchParams: Promise.resolve({
          next: "/servers",
          status: "password-reset-success",
        }),
      }),
    );

    expect(html).toContain('data-tone="workspace"');
    expect(html).toContain('data-variant="split"');
    expect(html).toContain("sign-in-form:/servers");
    expect(html).toContain("Пароль обновлён. Теперь войди с новым паролем.");
    expect(html).toContain("Добро пожаловать");
  });

  it("для уже авторизованного пользователя сохраняет redirect semantics", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
    });

    await SignInPage({
      searchParams: Promise.resolve({
        next: "/assistant",
      }),
    });

    expect(redirectMock).toHaveBeenCalledWith("/assistant");
  });
});
