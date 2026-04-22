import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/server-directory/context", () => ({
  getPublicServerDirectoryContext: vi.fn(),
}));

import ServersDirectoryPage from "@/app/servers/page";
import { getPublicServerDirectoryContext } from "@/server/server-directory/context";

describe("/servers page", () => {
  it("доступен гостю и честно показывает requires_auth для documents", async () => {
    vi.mocked(getPublicServerDirectoryContext).mockResolvedValue({
      viewer: {
        isAuthenticated: false,
        accountId: null,
      },
      servers: [
        {
          id: "server-1",
          code: "blackberry",
          slug: "blackberry",
          name: "Blackberry",
          directoryAvailability: "active",
          assistantStatus: "current_corpus_ready",
          documentsAvailabilityForViewer: "requires_auth",
          availableModules: ["assistant", "documents"],
        },
      ],
    });

    const html = renderToStaticMarkup(await ServersDirectoryPage());

    expect(getPublicServerDirectoryContext).toHaveBeenCalledWith();
    expect(html).toContain("Публичный каталог серверов");
    expect(html).toContain("Blackberry");
    expect(html).toContain("blackberry");
    expect(html).toContain("Assistant ready");
    expect(html).toContain("Нужен вход");
    expect(html).toContain("/assistant/blackberry");
    expect(html).not.toContain("/servers/blackberry/documents");
    expect(html).not.toContain("raw import failures");
    expect(html).not.toContain("ogpComplaintDocumentCount");
  });

  it("для авторизованного viewer различает available и needs_character", async () => {
    vi.mocked(getPublicServerDirectoryContext).mockResolvedValue({
      viewer: {
        isAuthenticated: true,
        accountId: "account-1",
      },
      servers: [
        {
          id: "server-1",
          code: "blackberry",
          slug: "blackberry",
          name: "Blackberry",
          directoryAvailability: "active",
          assistantStatus: "current_corpus_ready",
          documentsAvailabilityForViewer: "available",
          availableModules: ["assistant", "documents"],
        },
        {
          id: "server-2",
          code: "alta",
          slug: "alta",
          name: "Alta",
          directoryAvailability: "unavailable",
          assistantStatus: "assistant_disabled",
          documentsAvailabilityForViewer: "needs_character",
          availableModules: ["assistant", "documents"],
        },
      ],
    });

    const html = renderToStaticMarkup(await ServersDirectoryPage());

    expect(html).toContain("/servers/blackberry/documents");
    expect(html).toContain("Documents доступны");
    expect(html).toContain("Нужен персонаж");
    expect(html).toContain("Недоступен");
    expect(html).toContain("Assistant disabled");
    expect(html).not.toContain("discovery failure");
  });

  it("показывает честный empty state, если серверов пока нет", async () => {
    vi.mocked(getPublicServerDirectoryContext).mockResolvedValue({
      viewer: {
        isAuthenticated: false,
        accountId: null,
      },
      servers: [],
    });

    const html = renderToStaticMarkup(await ServersDirectoryPage());

    expect(html).toContain("Серверы пока не добавлены");
  });
});
