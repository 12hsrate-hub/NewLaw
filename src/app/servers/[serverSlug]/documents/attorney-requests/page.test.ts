import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/document-area/context", () => ({
  getAttorneyRequestFamilyRouteContext: vi.fn(),
}));

import AttorneyRequestFamilyPage from "@/app/servers/[serverSlug]/documents/attorney-requests/page";
import { getAttorneyRequestFamilyRouteContext } from "@/server/document-area/context";

describe("/servers/[serverSlug]/documents/attorney-requests page", () => {
  it("сохраняет direct attorney-request route рабочим", async () => {
    vi.mocked(getAttorneyRequestFamilyRouteContext).mockResolvedValue({
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
        fullName: "Dom Perignon",
        passportNumber: "240434",
        isProfileComplete: true,
        canUseRepresentative: true,
        canCreateAttorneyRequest: true,
        hasActiveSignature: true,
        source: "last_used",
      },
      trustorRegistry: [
        {
          id: "trustor-1",
          fullName: "Nick Name",
          passportNumber: "00000",
          phone: "1234567",
          icEmail: "test@sa.gov",
          note: null,
          isRepresentativeReady: true,
        },
      ],
      documents: [
        {
          id: "attorney-request-1",
          title: "Адвокатский запрос",
          documentType: "attorney_request",
          status: "draft",
          filingMode: null,
          subtype: null,
          appealNumber: null,
          objectFullName: null,
          objectOrganization: null,
          agreementNumber: null,
          trustorName: "Nick Name",
          server: {
            id: "server-1",
            code: "blackberry",
            name: "Blackberry",
          },
          authorSnapshot: {
            fullName: "Dom Perignon",
            passportNumber: "240434",
          },
          dataHealth: "ok",
          workingNotesPreview: "",
          generatedAt: null,
          publicationUrl: null,
          isSiteForumSynced: false,
          forumSyncState: null,
          forumThreadId: null,
          forumPostId: null,
          forumLastPublishedAt: null,
          forumLastSyncError: null,
          isModifiedAfterGeneration: false,
          snapshotCapturedAt: "2026-04-24T09:00:00.000Z",
          updatedAt: "2026-04-24T09:00:00.000Z",
          createdAt: "2026-04-24T09:00:00.000Z",
        },
      ],
      documentEntryCapabilities: {
        canCreateSelfComplaint: true,
        canCreateClaims: true,
        canCreateAttorneyRequest: true,
        canCreateLegalServicesAgreement: true,
        requiresServer: true,
        requiresCharacter: true,
        requiresAdvocateCharacter: false,
        blockReasons: [],
      },
    });

    const html = renderToStaticMarkup(
      await AttorneyRequestFamilyPage({
        params: Promise.resolve({
          serverSlug: "blackberry",
        }),
      }),
    );

    expect(getAttorneyRequestFamilyRouteContext).toHaveBeenCalledWith({
      serverSlug: "blackberry",
      nextPath: "/servers/blackberry/documents/attorney-requests",
    });
    expect(html).toContain("Адвокатские запросы");
    expect(html).toContain("запрос фиксируется за конкретным доверителем");
    expect(html).toContain("Nick Name");
  });
});
