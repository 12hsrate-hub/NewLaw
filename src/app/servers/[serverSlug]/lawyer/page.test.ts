import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/lawyer-workspace/context", () => ({
  getLawyerWorkspaceRouteContext: vi.fn(),
}));

import LawyerWorkspacePage from "@/app/servers/[serverSlug]/lawyer/page";
import { getLawyerWorkspaceRouteContext } from "@/server/lawyer-workspace/context";

describe("/servers/[serverSlug]/lawyer page", () => {
  it("использует serverSlug как source of truth и рендерит foundation route", async () => {
    vi.mocked(getLawyerWorkspaceRouteContext).mockResolvedValue({
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
        slug: "blackberry",
        name: "Blackberry",
      },
      trustorCount: 1,
      selectedCharacter: {
        id: "character-1",
        fullName: "Игорь Юристов",
        passportNumber: "AA-001",
        source: "last_used",
      },
      workspaceCapabilities: {
        canOpenAssistant: true,
        canOpenDocumentsWorkspace: true,
        canOpenLawyerWorkspace: true,
        canManageCharacters: true,
        canManageTrustors: true,
        requiresServer: true,
        requiresCharacter: false,
        requiresAdvocateCharacter: false,
        blockReasons: [],
      },
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
      compatibilityHrefs: {
        trustorsHref: "/account/trustors?server=blackberry",
        charactersHref: "/account/characters?server=blackberry",
        attorneyRequestsHref: "/servers/blackberry/documents/attorney-requests",
        attorneyRequestCreateHref: "/servers/blackberry/documents/attorney-requests/new",
        agreementsHref: "/servers/blackberry/documents/legal-services-agreements",
        agreementCreateHref: "/servers/blackberry/documents/legal-services-agreements/new",
      },
    });

    const html = renderToStaticMarkup(
      await LawyerWorkspacePage({
        params: Promise.resolve({
          serverSlug: "blackberry",
        }),
      }),
    );

    expect(getLawyerWorkspaceRouteContext).toHaveBeenCalledWith({
      serverSlug: "blackberry",
      nextPath: "/servers/blackberry/lawyer",
    });
    expect(html).toContain("Адвокатский кабинет");
    expect(html).toContain("/servers/blackberry/documents/attorney-requests");
    expect(html).toContain("/servers/blackberry/documents/legal-services-agreements");
  });

  it("показывает honest not-found state для неизвестного serverSlug", async () => {
    vi.mocked(getLawyerWorkspaceRouteContext).mockResolvedValue({
      status: "server_not_found",
      account: {
        id: "account-1",
        email: "user@example.com",
        login: "tester",
        isSuperAdmin: false,
        mustChangePassword: false,
      },
      requestedServerSlug: "unknown",
    });

    const html = renderToStaticMarkup(
      await LawyerWorkspacePage({
        params: Promise.resolve({
          serverSlug: "unknown",
        }),
      }),
    );

    expect(html).toContain("Сервер не найден");
    expect(html).toContain("unknown");
  });
});
