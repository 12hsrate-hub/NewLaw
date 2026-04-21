import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/document-area/context", () => ({
  buildCharactersBridgePath: vi.fn(() => "/app"),
  getServerDocumentsRouteContext: vi.fn(),
}));

import OgpComplaintEditorFoundationPage from "@/app/servers/[serverSlug]/documents/ogp-complaints/[documentId]/page";
import { getServerDocumentsRouteContext } from "@/server/document-area/context";

describe("/servers/[serverSlug]/documents/ogp-complaints/[documentId] page", () => {
  it("существует как future editor foundation route без fake persistence", async () => {
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
      await OgpComplaintEditorFoundationPage({
        params: Promise.resolve({
          serverSlug: "blackberry",
          documentId: "doc-123",
        }),
      }),
    );

    expect(html).toContain("Future editor route");
    expect(html).toContain("owner-account route foundation");
    expect(html).toContain("doc-123");
  });
});
