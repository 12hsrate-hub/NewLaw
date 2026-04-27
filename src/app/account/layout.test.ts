import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { usePathnameMock, useSearchParamsMock } = vi.hoisted(() => ({
  usePathnameMock: vi.fn(),
  useSearchParamsMock: vi.fn(),
}));

vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/navigation")>();

  return {
    ...actual,
    usePathname: usePathnameMock,
    useSearchParams: useSearchParamsMock,
  };
});

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
    usePathnameMock.mockReturnValue("/account");
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
    vi.mocked(getPrimaryShellContext).mockResolvedValue({
      viewer: {
        isAuthenticated: true,
        accountLogin: "user",
        accountEmail: "user@example.com",
        isSuperAdmin: false,
      },
      currentPath: "/account",
      availableServers: [
        {
          id: "server-1",
          name: "Blackberry",
          slug: "blackberry",
        },
      ],
      activeServer: {
        id: "server-1",
        name: "Blackberry",
        slug: "blackberry",
      },
      navigation: {
        documentsHref: "/servers/blackberry/documents",
        lawyerWorkspaceHref: "/servers/blackberry/lawyer",
        internalHref: null,
      },
    });
  });

  it("рендерит account nav как зону настроек и совместимых обзорных разделов", async () => {
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

    expect(html).toContain("Навигация аккаунта");
    expect(html).toContain("Lawyer5RP");
    expect(html).toContain('data-variant="wide"');
    expect(html).toContain("Аккаунт");
    expect(html).toContain("Здесь находятся настройки аккаунта, безопасность, доступы и служебные обзорные разделы.");
    expect(html).toContain('href="/assistant"');
    expect(html).toContain('href="/servers"');
    expect(html).toContain('href="/account"');
    expect(html).toContain('href="/account/security"');
    expect(html).toContain('href="/account/characters"');
    expect(html).toContain('href="/account/documents"');
    expect(html).toContain('href="/account/trustors"');
    expect(html).toContain('href="/servers/blackberry/documents"');
    expect(html).toContain('href="/servers/blackberry/lawyer"');
    expect(html).toContain(">Переключить<");
    expect(html).not.toContain("Кабинет адвоката");
    expect(html).not.toContain("Личный кабинет");
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
      availableServers: [
        {
          id: "server-1",
          name: "Blackberry",
          slug: "blackberry",
        },
      ],
      activeServer: {
        id: "server-1",
        name: "Blackberry",
        slug: "blackberry",
      },
      navigation: {
        documentsHref: "/servers/blackberry/documents",
        lawyerWorkspaceHref: "/servers/blackberry/lawyer",
        internalHref: "/internal",
      },
    });

    const html = renderToStaticMarkup(
      await AccountLayout({ children: createElement("div", null, "Child content") }),
    );

    expect(html).toContain('href="/internal/access-requests"');
    expect(html).toContain('href="/internal"');
    expect(html).toContain('data-variant="wide"');
    expect(html).toContain("Заявки на доступ");
    expect(html).toContain("Служебная зона");
  });
});
