import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/document-area/context", () => ({
  buildCharactersBridgePath: vi.fn((serverCode: string) => `/account/characters?server=${serverCode}#create-character-${serverCode}`),
  getServerDocumentsRouteContext: vi.fn(),
}));

import LegalServicesAgreementNewPage from "@/app/servers/[serverSlug]/documents/legal-services-agreements/new/page";
import {
  buildCharactersBridgePath,
  getServerDocumentsRouteContext,
} from "@/server/document-area/context";

describe("/servers/[serverSlug]/documents/legal-services-agreements/new page", () => {
  it("рендерит create-entry с trustor binding", async () => {
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
          fullName: "Dom Perignon",
          passportNumber: "240434",
          isProfileComplete: true,
          canUseRepresentative: true,
          canCreateAttorneyRequest: true,
          hasActiveSignature: true,
        },
      ],
      selectedCharacter: {
        id: "character-1",
        fullName: "Dom Perignon",
        passportNumber: "240434",
        isProfileComplete: true,
        canUseRepresentative: true,
        canCreateAttorneyRequest: true,
        hasActiveSignature: true,
        source: "first_available",
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
      ogpComplaintDocumentCount: 0,
      claimsDocumentCount: 0,
      attorneyRequestDocumentCount: 0,
      legalServicesAgreementDocumentCount: 0,
    });

    const html = renderToStaticMarkup(
      await LegalServicesAgreementNewPage({
        params: Promise.resolve({
          serverSlug: "blackberry",
        }),
        searchParams: Promise.resolve({
          status: "draft-created",
        }),
      }),
    );

    expect(getServerDocumentsRouteContext).toHaveBeenCalledWith({
      serverSlug: "blackberry",
      nextPath: "/servers/blackberry/documents/legal-services-agreements/new",
    });
    expect(html).toContain("Новый договор на оказание юридических услуг");
    expect(html).toContain("Черновик договора");
    expect(html).toContain("Nick Name");
  });

  it("показывает empty state, если на сервере нет персонажей", async () => {
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
      attorneyRequestDocumentCount: 0,
      legalServicesAgreementDocumentCount: 0,
    });

    const html = renderToStaticMarkup(
      await LegalServicesAgreementNewPage({
        params: Promise.resolve({
          serverSlug: "blackberry",
        }),
      }),
    );

    expect(html).toContain("нет персонажей");
    expect(html).toContain("/account/characters?server=blackberry#create-character-blackberry");
    expect(buildCharactersBridgePath).toHaveBeenCalledWith("blackberry");
  });
});
