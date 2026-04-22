import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/server-directory/hub", () => ({
  getProtectedServerHubContext: vi.fn(),
}));

import ServerHubPage from "@/app/servers/[serverSlug]/page";
import { getProtectedServerHubContext } from "@/server/server-directory/hub";

describe("/servers/[serverSlug] page", () => {
  it("использует только serverSlug из URL и рендерит две top-level cards", async () => {
    vi.mocked(getProtectedServerHubContext).mockResolvedValue({
      status: "ready",
      viewer: {
        accountId: "account-1",
        email: "user@example.com",
        login: "tester",
      },
      server: {
        id: "server-1",
        code: "blackberry",
        slug: "blackberry",
        name: "Blackberry",
        directoryAvailability: "active",
      },
      assistantStatus: "current_corpus_ready",
      documentsAvailabilityForViewer: "available",
      selectedCharacterSummary: {
        id: "character-1",
        fullName: "Игорь Юристов",
        passportNumber: "AA-001",
        source: "last_used",
      },
    });

    const html = renderToStaticMarkup(
      await ServerHubPage({
        params: Promise.resolve({
          serverSlug: "blackberry",
        }),
      }),
    );

    expect(getProtectedServerHubContext).toHaveBeenCalledWith({
      serverSlug: "blackberry",
      nextPath: "/servers/blackberry",
    });
    expect(html).toContain("Server Hub");
    expect(html).toContain("Blackberry");
    expect(html).toContain("/assistant/blackberry");
    expect(html).toContain("/servers/blackberry/documents");
    expect(html).not.toContain("Claims");
    expect(html).not.toContain("OGP complaints");
  });

  it("показывает honest server_not_found state", async () => {
    vi.mocked(getProtectedServerHubContext).mockResolvedValue({
      status: "server_not_found",
      viewer: {
        accountId: "account-1",
        email: "user@example.com",
        login: "tester",
      },
      requestedServerSlug: "unknown",
    });

    const html = renderToStaticMarkup(
      await ServerHubPage({
        params: Promise.resolve({
          serverSlug: "unknown",
        }),
      }),
    );

    expect(html).toContain("Сервер не найден");
    expect(html).toContain("unknown");
  });

  it("показывает maintenance state и временно выключает module actions", async () => {
    vi.mocked(getProtectedServerHubContext).mockResolvedValue({
      status: "ready",
      viewer: {
        accountId: "account-1",
        email: "user@example.com",
        login: "tester",
      },
      server: {
        id: "server-1",
        code: "blackberry",
        slug: "blackberry",
        name: "Blackberry",
        directoryAvailability: "maintenance",
      },
      assistantStatus: "maintenance_mode",
      documentsAvailabilityForViewer: "unavailable",
      selectedCharacterSummary: null,
    });

    const html = renderToStaticMarkup(
      await ServerHubPage({
        params: Promise.resolve({
          serverSlug: "blackberry",
        }),
      }),
    );

    expect(html).toContain("Server maintenance");
    expect(html).toContain("Assistant временно недоступен");
    expect(html).toContain("Documents временно недоступны");
    expect(html).not.toContain("/assistant/blackberry");
    expect(html).not.toContain("/servers/blackberry/documents");
  });

  it("без персонажа оставляет assistant доступным и показывает needs_character для documents", async () => {
    vi.mocked(getProtectedServerHubContext).mockResolvedValue({
      status: "ready",
      viewer: {
        accountId: "account-1",
        email: "user@example.com",
        login: "tester",
      },
      server: {
        id: "server-1",
        code: "blackberry",
        slug: "blackberry",
        name: "Blackberry",
        directoryAvailability: "active",
      },
      assistantStatus: "corpus_bootstrap_incomplete",
      documentsAvailabilityForViewer: "needs_character",
      selectedCharacterSummary: null,
    });

    const html = renderToStaticMarkup(
      await ServerHubPage({
        params: Promise.resolve({
          serverSlug: "blackberry",
        }),
      }),
    );

    expect(html).toContain("/assistant/blackberry");
    expect(html).toContain("Нужен персонаж");
    expect(html).toContain("/app");
    expect(html).not.toContain("/servers/blackberry/documents");
  });

  it("показывает honest server_unavailable state для недоступного сервера", async () => {
    vi.mocked(getProtectedServerHubContext).mockResolvedValue({
      status: "server_unavailable",
      viewer: {
        accountId: "account-1",
        email: "user@example.com",
        login: "tester",
      },
      server: {
        id: "server-1",
        code: "legacy",
        slug: "legacy",
        name: "Legacy",
        directoryAvailability: "unavailable",
      },
    });

    const html = renderToStaticMarkup(
      await ServerHubPage({
        params: Promise.resolve({
          serverSlug: "legacy",
        }),
      }),
    );

    expect(html).toContain("недоступен");
    expect(html).toContain("Legacy");
    expect(html).toContain("/servers");
  });
});
