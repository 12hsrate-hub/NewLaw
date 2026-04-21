import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/document-area/context", () => ({
  buildCharactersBridgePath: vi.fn(() => "/app"),
  getServerDocumentsRouteContext: vi.fn(),
}));

import ServerDocumentsPage from "@/app/servers/[serverSlug]/documents/page";
import { getServerDocumentsRouteContext } from "@/server/document-area/context";

describe("/servers/[serverSlug]/documents page", () => {
  it("использует serverSlug как source of truth и рендерит server-scoped hub", async () => {
    vi.mocked(getServerDocumentsRouteContext).mockResolvedValue({
      status: "ready",
      account: {
        id: "account-1",
        email: "user@example.com",
        login: "tester",
        isSuperAdmin: false,
        mustChangePassword: false,
      },
      server: {
        id: "server-1",
        code: "blackberry",
        name: "Blackberry",
      },
      servers: [],
      characters: [
        {
          id: "character-1",
          fullName: "Игорь Юристов",
          passportNumber: "AA-001",
          isProfileComplete: true,
          canUseRepresentative: true,
        },
      ],
      selectedCharacter: {
        id: "character-1",
        fullName: "Игорь Юристов",
        passportNumber: "AA-001",
        isProfileComplete: true,
        canUseRepresentative: true,
        source: "last_used",
      },
      ogpComplaintDocumentCount: 2,
      claimsDocumentCount: 0,
    });

    const html = renderToStaticMarkup(
      await ServerDocumentsPage({
        params: Promise.resolve({
          serverSlug: "blackberry",
        }),
      }),
    );

    expect(getServerDocumentsRouteContext).toHaveBeenCalledWith({
      serverSlug: "blackberry",
      nextPath: "/servers/blackberry/documents",
    });
    expect(html).toContain("server-scoped document hub");
    expect(html).toContain("OGP complaints");
    expect(html).toContain("Claims");
    expect(html).toContain("/servers/blackberry/documents/claims");
  });

  it("показывает empty state с CTA, если на сервере нет персонажей", async () => {
    vi.mocked(getServerDocumentsRouteContext).mockResolvedValue({
      status: "no_characters",
      account: {
        id: "account-1",
        email: "user@example.com",
        login: "tester",
        isSuperAdmin: false,
        mustChangePassword: false,
      },
      server: {
        id: "server-1",
        code: "blackberry",
        name: "Blackberry",
      },
      servers: [],
      ogpComplaintDocumentCount: 0,
      claimsDocumentCount: 0,
    });

    const html = renderToStaticMarkup(
      await ServerDocumentsPage({
        params: Promise.resolve({
          serverSlug: "blackberry",
        }),
      }),
    );

    expect(html).toContain("нет персонажей");
    expect(html).toContain("/app");
  });

  it("показывает честный not-found state для неизвестного serverSlug", async () => {
    vi.mocked(getServerDocumentsRouteContext).mockResolvedValue({
      status: "server_not_found",
      account: {
        id: "account-1",
        email: "user@example.com",
        login: "tester",
        isSuperAdmin: false,
        mustChangePassword: false,
      },
      requestedServerSlug: "unknown",
      servers: [],
    });

    const html = renderToStaticMarkup(
      await ServerDocumentsPage({
        params: Promise.resolve({
          serverSlug: "unknown",
        }),
      }),
    );

    expect(html).toContain("Сервер не найден");
    expect(html).toContain("unknown");
  });
});
