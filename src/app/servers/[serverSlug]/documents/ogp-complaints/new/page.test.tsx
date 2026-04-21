import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/document-area/context", () => ({
  buildCharactersBridgePath: vi.fn(() => "/app"),
  getServerDocumentsRouteContext: vi.fn(),
}));

import OgpComplaintNewPage from "@/app/servers/[serverSlug]/documents/ogp-complaints/new/page";
import { getServerDocumentsRouteContext } from "@/server/document-area/context";

describe("/servers/[serverSlug]/documents/ogp-complaints/new page", () => {
  it("существует как pre-draft entry foundation и показывает server + character context", async () => {
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
        },
      ],
      selectedCharacter: {
        id: "character-1",
        fullName: "Игорь Юристов",
        passportNumber: "AA-001",
        source: "first_available",
      },
      ogpComplaintDocumentCount: 0,
    });

    const html = renderToStaticMarkup(
      await OgpComplaintNewPage({
        params: Promise.resolve({
          serverSlug: "blackberry",
        }),
      }),
    );

    expect(html).toContain("Первое сохранение уже создаёт реальный persisted");
    expect(html).toContain("UX-default персонаж: Игорь Юристов");
    expect(html).toContain("можно сменить");
    expect(html).toContain("Создать persisted draft");
  });
});
