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

vi.mock("@/components/product/auth/sign-up-form", () => ({
  SignUpForm: ({ nextPath }: { nextPath: string }) => <div>{`sign-up-form:${nextPath}`}</div>,
}));

import SignUpPage from "@/app/sign-up/page";
import { getCurrentUser } from "@/server/auth/helpers";

describe("/sign-up page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("использует workspace split framing для регистрации", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const html = renderToStaticMarkup(
      await SignUpPage({
        searchParams: Promise.resolve({
          next: "/",
        }),
      }),
    );

    expect(html).toContain('data-tone="workspace"');
    expect(html).toContain('data-variant="split"');
    expect(html).toContain("sign-up-form:/");
    expect(html).toContain("Аккаунт для юридической работы по серверам");
  });

  it("для уже авторизованного пользователя сохраняет redirect semantics", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
    });

    await SignUpPage({
      searchParams: Promise.resolve({
        next: "/assistant",
      }),
    });

    expect(redirectMock).toHaveBeenCalledWith("/assistant");
  });
});
