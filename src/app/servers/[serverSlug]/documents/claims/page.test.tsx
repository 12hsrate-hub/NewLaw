import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/document-area/context", () => ({
  getClaimsFamilyRouteContext: vi.fn(),
}));

import ClaimsFamilyPage from "@/app/servers/[serverSlug]/documents/claims/page";
import { getClaimsFamilyRouteContext } from "@/server/document-area/context";

describe("/servers/[serverSlug]/documents/claims page", () => {
  it("показывает раздел исков рядом с другими документами сервера", async () => {
    vi.mocked(getClaimsFamilyRouteContext).mockResolvedValue({
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
          id: "claim-1",
          title: "Документ по реабилитации",
          documentType: "rehabilitation",
          status: "draft",
          filingMode: "self",
          subtype: "rehabilitation",
          appealNumber: null,
          objectFullName: null,
          objectOrganization: null,
          server: {
            id: "server-1",
            code: "blackberry",
            name: "Blackberry",
          },
          authorSnapshot: {
            fullName: "Игорь Юристов",
            passportNumber: "AA-001",
          },
          dataHealth: "ok",
          workingNotesPreview: "Черновые заметки",
          generatedAt: null,
          publicationUrl: null,
          isSiteForumSynced: false,
          forumSyncState: null,
          forumThreadId: null,
          forumPostId: null,
          forumLastPublishedAt: null,
          forumLastSyncError: null,
          isModifiedAfterGeneration: false,
          snapshotCapturedAt: "2026-04-22T00:00:00.000Z",
          updatedAt: "2026-04-22T00:00:00.000Z",
          createdAt: "2026-04-22T00:00:00.000Z",
        },
      ],
    });

    const html = renderToStaticMarkup(
      await ClaimsFamilyPage({
        params: Promise.resolve({
          serverSlug: "blackberry",
        }),
      }),
    );

    expect(getClaimsFamilyRouteContext).toHaveBeenCalledWith({
      serverSlug: "blackberry",
      nextPath: "/servers/blackberry/documents/claims",
    });
    expect(html).toContain("Иски");
    expect(html).toContain("Rehabilitation");
    expect(html).toContain("Документ по реабилитации");
    expect(html).toContain("Здесь отображаются сохранённые документы из раздела исков.");
  });
});
