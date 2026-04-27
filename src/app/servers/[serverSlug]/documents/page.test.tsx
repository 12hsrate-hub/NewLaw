import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/document-area/context", () => ({
  buildCharactersBridgePath: vi.fn((serverCode: string) => `/account/characters?server=${serverCode}#create-character-${serverCode}`),
  getServerDocumentsRouteContext: vi.fn(),
}));

import ServerDocumentsPage from "@/app/servers/[serverSlug]/documents/page";
import {
  buildCharactersBridgePath,
  getServerDocumentsRouteContext,
} from "@/server/document-area/context";

describe("/servers/[serverSlug]/documents page", () => {
  it("использует serverSlug как source of truth и рендерит server-scoped hub", async () => {
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
          isProfileComplete: true,
          canUseRepresentative: true,
        },
      ],
      selectedCharacter: {
        id: "character-1",
        fullName: "Игорь Юристов",
        passportNumber: "AA-001",
        isProfileComplete: true,
        canUseRepresentative: true,
        source: "last_used",
      },
      trustorRegistry: [],
      documentEntryCapabilities: {
        canCreateSelfComplaint: true,
        canCreateClaims: true,
        canCreateAttorneyRequest: false,
        canCreateLegalServicesAgreement: false,
        requiresServer: true,
        requiresCharacter: true,
        requiresAdvocateCharacter: false,
        blockReasons: ["trustor_required_temporarily"],
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
      ogpComplaintDocumentCount: 2,
      claimsDocumentCount: 0,
      attorneyRequestDocumentCount: 4,
      legalServicesAgreementDocumentCount: 2,
    });

    const html = renderToStaticMarkup(
      await ServerDocumentsPage({
        params: Promise.resolve({
          serverSlug: "blackberry",
        }),
      }),
    );

    expect(getServerDocumentsRouteContext).toHaveBeenCalledWith({
      serverSlug: "blackberry",
      nextPath: "/servers/blackberry/documents",
    });
    expect(html).toContain(
      "Здесь собраны общие документы по выбранному серверу. Адвокатские сценарии и работа с доверителями открываются из отдельного адвокатского кабинета.",
    );
    expect(html).toContain("Жалобы в ОГП");
    expect(html).toContain("Иски");
    expect(html).toContain("Адвокатские документы");
    expect(html).toContain("/servers/blackberry/lawyer");
    expect(html).not.toContain("Создать договор");
    expect(html).not.toContain("Создать запрос");
    expect(html).toContain("В текущей версии для этого действия нужен сохранённый доверитель.");
    expect(html).toContain("/servers/blackberry/documents/claims");
  });

  it("без персонажей оставляет documents hub доступным и показывает helper-state", async () => {
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
      documentEntryCapabilities: {
        canCreateSelfComplaint: false,
        canCreateClaims: false,
        canCreateAttorneyRequest: false,
        canCreateLegalServicesAgreement: false,
        requiresServer: true,
        requiresCharacter: true,
        requiresAdvocateCharacter: false,
        blockReasons: ["character_required"],
      },
      workspaceCapabilities: {
        canOpenAssistant: true,
        canOpenDocumentsWorkspace: true,
        canOpenLawyerWorkspace: false,
        canManageCharacters: true,
        canManageTrustors: true,
        requiresServer: true,
        requiresCharacter: false,
        requiresAdvocateCharacter: false,
        blockReasons: ["character_required"],
      },
      ogpComplaintDocumentCount: 0,
      claimsDocumentCount: 0,
      attorneyRequestDocumentCount: 0,
      legalServicesAgreementDocumentCount: 0,
    });

    const html = renderToStaticMarkup(
      await ServerDocumentsPage({
        params: Promise.resolve({
          serverSlug: "blackberry",
        }),
      }),
    );

    expect(html).toContain("Документы сервера");
    expect(html).toContain("Персонаж пока не выбран");
    expect(html).toContain("Чтобы начать жалобу, сначала нужен персонаж на этом сервере.");
    expect(html).toContain("Для адвокатских документов сначала нужен персонаж на этом сервере.");
    expect(html).toContain("/account/characters?server=blackberry#create-character-blackberry");
    expect(buildCharactersBridgePath).toHaveBeenCalledWith("blackberry");
  });

  it("показывает честный not-found state для неизвестного serverSlug", async () => {
    vi.mocked(getServerDocumentsRouteContext).mockResolvedValue({
      status: "server_not_found",
      account: {
        id: "account-1",
        email: "user@example.com",
        login: "tester",
        isSuperAdmin: false,
        mustChangePassword: false,
      },
      requestedServerSlug: "unknown",
      servers: [],
    });

    const html = renderToStaticMarkup(
      await ServerDocumentsPage({
        params: Promise.resolve({
          serverSlug: "unknown",
        }),
      }),
    );

    expect(html).toContain("Сервер не найден");
    expect(html).toContain("unknown");
  });
});
