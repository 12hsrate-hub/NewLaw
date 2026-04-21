import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/document-area/context", () => ({
  buildCharactersBridgePath: vi.fn(() => "/app"),
  getServerDocumentsRouteContext: vi.fn(),
}));

import ClaimsNewPage from "@/app/servers/[serverSlug]/documents/claims/new/page";
import { getServerDocumentsRouteContext } from "@/server/document-area/context";

describe("/servers/[serverSlug]/documents/claims/new page", () => {
  it("рендерит обязательный subtype choice для claims family", async () => {
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
    expect(html).toContain("Claims create entry");
    expect(html).toContain("Subtype: Rehabilitation");
    expect(html).toContain("Создать persisted claim draft");
    expect(html).toContain("После первого сохранения работа продолжается");
  });

  it("без subtype остаётся на foundation-level subtype choice", async () => {
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

    expect(html).toContain("Выбор subtype");
    expect(html).toContain("Subtype choice обязателен");
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
    expect(html).toContain("/app");
  });
});
