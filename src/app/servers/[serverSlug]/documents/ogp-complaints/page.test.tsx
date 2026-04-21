import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/document-area/context", () => ({
  buildCharactersBridgePath: vi.fn(() => "/app"),
  getServerDocumentsRouteContext: vi.fn(),
}));

import OgpComplaintFamilyPage from "@/app/servers/[serverSlug]/documents/ogp-complaints/page";
import { getServerDocumentsRouteContext } from "@/server/document-area/context";

describe("/servers/[serverSlug]/documents/ogp-complaints page", () => {
  it("существует как family index foundation route", async () => {
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
        source: "last_used",
      },
    });

    const html = renderToStaticMarkup(
      await OgpComplaintFamilyPage({
        params: Promise.resolve({
          serverSlug: "blackberry",
        }),
      }),
    );

    expect(html).toContain("OGP complaints");
    expect(html).toContain("family index");
  });
});
