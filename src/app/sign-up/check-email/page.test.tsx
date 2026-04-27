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
  CheckEmailCard: ({ flow, nextPath }: { flow: string; nextPath?: string }) => (
    <div>{`check-email-card:${flow}:${nextPath ?? ""}`}</div>
  ),
}));

import CheckEmailPage from "@/app/sign-up/check-email/page";
import { getCurrentUser } from "@/server/auth/helpers";

describe("/sign-up/check-email page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("использует workspace readable framing для проверки почты", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const html = renderToStaticMarkup(
      await CheckEmailPage({
        searchParams: Promise.resolve({
          next: "/servers",
        }),
      }),
    );

    expect(html).toContain('data-tone="workspace"');
    expect(html).toContain('data-variant="readable"');
    expect(html).toContain("check-email-card:signup:/servers");
  });

  it("для уже авторизованного пользователя сохраняет redirect semantics", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
    });

    await CheckEmailPage({
      searchParams: Promise.resolve({
        next: "/assistant",
      }),
    });

    expect(redirectMock).toHaveBeenCalledWith("/assistant");
  });
});
