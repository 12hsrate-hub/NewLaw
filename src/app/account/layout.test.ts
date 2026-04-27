import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/auth/protected", () => ({
  requireProtectedAccountContext: vi.fn(),
}));

vi.mock("@/server/primary-shell/context", () => ({
  getPrimaryShellContext: vi.fn(),
}));

import AccountLayout from "@/app/account/layout";
import { requireProtectedAccountContext } from "@/server/auth/protected";
import { getPrimaryShellContext } from "@/server/primary-shell/context";

describe("account layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPrimaryShellContext).mockResolvedValue({
      viewer: {
        isAuthenticated: true,
        accountLogin: "user",
        accountEmail: "user@example.com",
        isSuperAdmin: false,
      },
      currentPath: "/account",
      activeServer: {
        id: "server-1",
        name: "Blackberry",
        slug: "blackberry",
      },
      navigation: {
        documentsHref: "/servers/blackberry/documents",
        internalHref: null,
      },
    });
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
    expect(html).toContain("Lawyer5RP");
    expect(html).toContain('href="/assistant"');
    expect(html).toContain('href="/servers"');
    expect(html).toContain('href="/account"');
    expect(html).toContain('href="/account/security"');
    expect(html).toContain('href="/account/characters"');
    expect(html).toContain('href="/account/documents"');
    expect(html).toContain('href="/account/trustors"');
    expect(html).toContain('href="/servers/blackberry/documents"');
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
    vi.mocked(getPrimaryShellContext).mockResolvedValue({
      viewer: {
        isAuthenticated: true,
        accountLogin: "admin",
        accountEmail: "admin@example.com",
        isSuperAdmin: true,
      },
      currentPath: "/account",
      activeServer: {
        id: "server-1",
        name: "Blackberry",
        slug: "blackberry",
      },
      navigation: {
        documentsHref: "/servers/blackberry/documents",
        internalHref: "/internal",
      },
    });

    const html = renderToStaticMarkup(
      await AccountLayout({ children: createElement("div", null, "Child content") }),
    );

    expect(html).toContain('href="/internal/access-requests"');
    expect(html).toContain('href="/internal"');
    expect(html).toContain("Заявки на доступ");
    expect(html).toContain("Служебная зона");
  });
});
