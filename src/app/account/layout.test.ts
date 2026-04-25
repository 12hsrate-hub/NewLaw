import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/auth/protected", () => ({
  requireProtectedAccountContext: vi.fn(),
}));

import AccountLayout from "@/app/account/layout";
import { requireProtectedAccountContext } from "@/server/auth/protected";

describe("account layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("рендерит shared account subnav для overview, security, characters, documents и trustors", async () => {
    vi.mocked(requireProtectedAccountContext).mockResolvedValue({
      account: {
        id: "account-1",
        email: "user@example.com",
        login: "user",
        isSuperAdmin: false,
        mustChangePassword: false,
      },
    } as never);

    const html = renderToStaticMarkup(
      await AccountLayout({ children: createElement("div", null, "Child content") }),
    );

    expect(html).toContain("Навигация личного кабинета");
    expect(html).toContain('href="/account"');
    expect(html).toContain('href="/account/security"');
    expect(html).toContain('href="/account/characters"');
    expect(html).toContain('href="/account/documents"');
    expect(html).toContain('href="/account/trustors"');
    expect(html).not.toContain('href="/internal/access-requests"');
  });

  it("добавляет access requests в account nav для super_admin", async () => {
    vi.mocked(requireProtectedAccountContext).mockResolvedValue({
      account: {
        id: "account-1",
        email: "admin@example.com",
        login: "admin",
        isSuperAdmin: true,
        mustChangePassword: false,
      },
    } as never);

    const html = renderToStaticMarkup(
      await AccountLayout({ children: createElement("div", null, "Child content") }),
    );

    expect(html).toContain('href="/internal/access-requests"');
  });
});
