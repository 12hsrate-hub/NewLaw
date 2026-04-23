import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/document-area/context", () => ({
  buildCharactersBridgePath: vi.fn((serverCode: string) => `/account/characters?server=${serverCode}#create-character-${serverCode}`),
  getServerDocumentsRouteContext: vi.fn(),
}));

import OgpComplaintNewPage from "@/app/servers/[serverSlug]/documents/ogp-complaints/new/page";
import {
  buildCharactersBridgePath,
  getServerDocumentsRouteContext,
} from "@/server/document-area/context";

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
          isProfileComplete: false,
          canUseRepresentative: true,
        },
      ],
      selectedCharacter: {
        id: "character-1",
        fullName: "Игорь Юристов",
        passportNumber: "AA-001",
        isProfileComplete: false,
        canUseRepresentative: true,
        source: "first_available",
      },
      trustorRegistry: [
        {
          id: "trustor-1",
          fullName: "Иван Доверителев",
          passportNumber: "AA-001",
          phone: null,
          note: "Проверенный представитель",
          isRepresentativeReady: true,
        },
      ],
      ogpComplaintDocumentCount: 0,
      claimsDocumentCount: 0,
    });

    const html = renderToStaticMarkup(
      await OgpComplaintNewPage({
        params: Promise.resolve({
          serverSlug: "blackberry",
        }),
      }),
    );

    expect(html).toContain("После первого сохранения откроется обычный редактор документа");
    expect(html).toContain("Сейчас выбран первый доступный персонаж");
    expect(html).toContain("Подача: от своего имени");
    expect(html).toContain("Доказательства");
    expect(html).toContain("Создать черновик жалобы");
  });

  it("показывает focused bridge, если на сервере нет персонажей", async () => {
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
      await OgpComplaintNewPage({
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
