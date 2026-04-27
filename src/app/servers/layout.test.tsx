import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/primary-shell/context", () => ({
  getPrimaryShellContext: vi.fn(),
}));

import ServersLayout from "@/app/servers/layout";
import { getPrimaryShellContext } from "@/server/primary-shell/context";

describe("servers layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    const html = renderToStaticMarkup(
      await ServersLayout({ children: createElement("div", null, "Servers child") }),
    );

    expect(getPrimaryShellContext).toHaveBeenCalledWith({
      currentPath: "/servers",
    });
    expect(html).toContain("Lawyer5RP");
    expect(html).toContain('href="/servers/blackberry/documents"');
    expect(html).toContain("Servers child");
  });
});
