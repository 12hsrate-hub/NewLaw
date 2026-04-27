import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/primary-shell/context", () => ({
  getPrimaryShellContext: vi.fn(),
}));

import AssistantLayout from "@/app/assistant/layout";
import { getPrimaryShellContext } from "@/server/primary-shell/context";

describe("assistant layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("подключает общий primary shell для assistant zone", async () => {
    vi.mocked(getPrimaryShellContext).mockResolvedValue({
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
    });

    const html = renderToStaticMarkup(
      await AssistantLayout({ children: createElement("div", null, "Assistant child") }),
    );

    expect(getPrimaryShellContext).toHaveBeenCalledWith({
      currentPath: "/assistant",
    });
    expect(html).toContain("Lawyer5RP");
    expect(html).toContain('href="/assistant"');
    expect(html).toContain("Assistant child");
  });
});
