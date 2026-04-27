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

vi.mock("@/server/primary-shell/context", () => ({
  getPrimaryShellContext: vi.fn(),
}));

import ServersLayout from "@/app/servers/layout";
import { getPrimaryShellContext } from "@/server/primary-shell/context";

describe("servers layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePathnameMock.mockReturnValue("/servers");
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
  });

  it("подключает общий primary shell для server zone", async () => {
    vi.mocked(getPrimaryShellContext).mockResolvedValue({
      viewer: {
        isAuthenticated: true,
        accountLogin: "tester",
        accountEmail: "user@example.com",
        isSuperAdmin: false,
      },
      currentPath: "/servers",
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

    const html = renderToStaticMarkup(
      await ServersLayout({ children: createElement("div", null, "Servers child") }),
    );

    expect(getPrimaryShellContext).toHaveBeenCalledWith({
      currentPath: "/servers",
    });
    expect(html).toContain("Lawyer5RP");
    expect(html).toContain('href="/servers/blackberry/documents"');
    expect(html).toContain('href="/servers/blackberry/lawyer"');
    expect(html).toContain(">Переключить<");
    expect(html).toContain("Servers child");
  });
});
