import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

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

import { PrimaryHeader } from "@/components/product/shell/primary-header";

describe("primary header", () => {
  it("показывает ordinary navigation и гостевой вход для public zones", () => {
    usePathnameMock.mockReturnValue("/assistant");
    useSearchParamsMock.mockReturnValue(new URLSearchParams());

    const html = renderToStaticMarkup(
      <PrimaryHeader
        context={{
          viewer: {
            isAuthenticated: false,
            accountLogin: null,
            accountEmail: null,
            isSuperAdmin: false,
          },
          currentPath: "/assistant",
          availableServers: [],
          activeServer: {
            id: null,
            name: null,
            slug: null,
          },
          navigation: {
            documentsHref: null,
            lawyerWorkspaceHref: null,
            internalHref: null,
          },
        }}
      />,
    );

    expect(html).toContain("Lawyer");
    expect(html).toContain(">5<");
    expect(html).toContain("RP");
    expect(html).toContain("<svg");
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/assistant"');
    expect(html).toContain('href="/servers"');
    expect(html).toContain('href="/account"');
    expect(html).toContain("Не выбран");
    expect(html).toContain('href="/sign-in?next=%2Fassistant"');
    expect(html).not.toContain("Переключить");
    expect(html).not.toContain("Служебная зона");
  });

  it("для авторизованного viewer показывает switcher, active server и служебную ссылку для super_admin", () => {
    usePathnameMock.mockReturnValue("/account");
    useSearchParamsMock.mockReturnValue(new URLSearchParams());

    const html = renderToStaticMarkup(
      <PrimaryHeader
        context={{
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
            {
              id: "server-2",
              name: "Rainbow",
              slug: "rainbow",
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
        }}
      />,
    );

    expect(html).toContain("Аккаунт");
    expect(html).toContain("admin");
    expect(html).toContain("Blackberry");
    expect(html).toContain(">Сервер<");
    expect(html).toContain(">Переключить<");
    expect(html).not.toContain("Текущий выбор влияет на серверные разделы и документы.");
    expect(html).toContain('name="serverId"');
    expect(html).toContain('value="/account"');
    expect(html).toContain('href="/servers/blackberry/documents"');
    expect(html).toContain('href="/servers/blackberry/lawyer"');
    expect(html).toContain("Кабинет");
    expect(html).toContain('href="/internal"');
    expect(html).toContain("Служебная зона");
  });

  it("показывает disabled state, если у пользователя нет доступных серверов", () => {
    usePathnameMock.mockReturnValue("/servers");
    useSearchParamsMock.mockReturnValue(new URLSearchParams());

    const html = renderToStaticMarkup(
      <PrimaryHeader
        context={{
          viewer: {
            isAuthenticated: true,
            accountLogin: "user",
            accountEmail: "user@example.com",
            isSuperAdmin: false,
          },
          currentPath: "/servers",
          availableServers: [],
          activeServer: {
            id: null,
            name: null,
            slug: null,
          },
          navigation: {
            documentsHref: null,
            lawyerWorkspaceHref: null,
            internalHref: null,
          },
        }}
      />,
    );

    expect(html).toContain(">Переключить<");
    expect(html).not.toContain("Пока нет доступных серверов для переключения.");
    expect(html).toContain("Серверов пока нет");
    expect(html).toContain("disabled");
  });
});
