import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/document-area/context", () => ({
  buildCharactersBridgePath: vi.fn((serverCode: string) => `/account/characters?server=${serverCode}#create-character-${serverCode}`),
  getServerDocumentsRouteContext: vi.fn(),
}));

import ClaimsNewPage from "@/app/servers/[serverSlug]/documents/claims/new/page";
import {
  buildCharactersBridgePath,
  getServerDocumentsRouteContext,
} from "@/server/document-area/context";

describe("/servers/[serverSlug]/documents/claims/new page", () => {
  it("рендерит создание черновика для выбранного вида документа", async () => {
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
      await ClaimsNewPage({
        params: Promise.resolve({
          serverSlug: "blackberry",
        }),
        searchParams: Promise.resolve({
          subtype: "rehabilitation",
        }),
      }),
    );

    expect(getServerDocumentsRouteContext).toHaveBeenCalledWith({
      serverSlug: "blackberry",
      nextPath: "/servers/blackberry/documents/claims/new",
    });
    expect(html).toContain("Черновик документа");
    expect(html).toContain("Вид документа: Реабилитация");
    expect(html).toContain("Создать черновик");
    expect(html).toContain("После первого сохранения вид документа и данные автора фиксируются в черновике.");
  });

  it("без выбранного вида документа остаётся на шаге выбора", async () => {
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
      trustorRegistry: [],
      ogpComplaintDocumentCount: 0,
      claimsDocumentCount: 0,
    });

    const html = renderToStaticMarkup(
      await ClaimsNewPage({
        params: Promise.resolve({
          serverSlug: "blackberry",
        }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(html).toContain("Выбор вида документа");
    expect(html).toContain("Пока вид документа не выбран. Без этого новый черновик не создаётся.");
  });

  it("показывает empty state с CTA, если на сервере нет персонажей", async () => {
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
      await ClaimsNewPage({
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
