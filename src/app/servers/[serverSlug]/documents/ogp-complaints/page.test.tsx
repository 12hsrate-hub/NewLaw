import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/document-area/context", () => ({
  getOgpComplaintFamilyRouteContext: vi.fn(),
}));

import OgpComplaintFamilyPage from "@/app/servers/[serverSlug]/documents/ogp-complaints/page";
import { getOgpComplaintFamilyRouteContext } from "@/server/document-area/context";

describe("/servers/[serverSlug]/documents/ogp-complaints page", () => {
  it("показывает persisted family list по серверу", async () => {
    vi.mocked(getOgpComplaintFamilyRouteContext).mockResolvedValue({
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
      canCreateDocuments: true,
      selectedCharacter: {
        id: "character-1",
        fullName: "Игорь Юристов",
        passportNumber: "AA-001",
        isProfileComplete: true,
        canUseRepresentative: true,
        source: "last_used",
      },
      documents: [
        {
          id: "document-1",
          title: "Persisted draft",
          documentType: "ogp_complaint",
          status: "draft",
          filingMode: "self",
          appealNumber: "OGP-001",
          objectFullName: "Сотрудник Полиции",
          objectOrganization: "LSPD",
          server: {
            id: "server-1",
            code: "blackberry",
            name: "Blackberry",
          },
          authorSnapshot: {
            fullName: "Игорь Юристов",
            passportNumber: "AA-001",
          },
          workingNotesPreview: "Черновая заметка",
          generatedAt: null,
          publicationUrl: null,
          isSiteForumSynced: false,
          isModifiedAfterGeneration: false,
          snapshotCapturedAt: "2026-04-21T10:00:00.000Z",
          updatedAt: "2026-04-21T10:15:00.000Z",
          createdAt: "2026-04-21T10:00:00.000Z",
        },
      ],
    });

    const html = renderToStaticMarkup(
      await OgpComplaintFamilyPage({
        params: Promise.resolve({
          serverSlug: "blackberry",
        }),
      }),
    );

    expect(html).toContain("OGP complaints");
    expect(html).toContain("Persisted draft");
    expect(html).toContain("реальные persisted документы");
    expect(html).toContain("Appeal number: OGP-001");
  });
});
