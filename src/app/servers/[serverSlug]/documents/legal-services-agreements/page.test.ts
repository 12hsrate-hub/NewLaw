import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/document-area/context", () => ({
  getLegalServicesAgreementFamilyRouteContext: vi.fn(),
}));

import LegalServicesAgreementFamilyPage from "@/app/servers/[serverSlug]/documents/legal-services-agreements/page";
import { getLegalServicesAgreementFamilyRouteContext } from "@/server/document-area/context";

describe("/servers/[serverSlug]/documents/legal-services-agreements page", () => {
  it("рендерит persisted family внутри server documents area", async () => {
    vi.mocked(getLegalServicesAgreementFamilyRouteContext).mockResolvedValue({
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
          id: "agreement-1",
          title: "Договор на оказание юридических услуг",
          documentType: "legal_services_agreement",
          status: "draft",
          filingMode: null,
          subtype: null,
          appealNumber: null,
          objectFullName: null,
          objectOrganization: null,
          agreementNumber: "LS-0011",
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
    });

    const html = renderToStaticMarkup(
      await LegalServicesAgreementFamilyPage({
        params: Promise.resolve({
          serverSlug: "blackberry",
        }),
      }),
    );

    expect(getLegalServicesAgreementFamilyRouteContext).toHaveBeenCalledWith({
      serverSlug: "blackberry",
      nextPath: "/servers/blackberry/documents/legal-services-agreements",
    });
    expect(html).toContain("Договоры на оказание юридических услуг");
    expect(html).toContain("страницы выгружаются отдельно как PNG");
    expect(html).toContain("Nick Name");
    expect(html).toContain("LS-0011");
  });
});
