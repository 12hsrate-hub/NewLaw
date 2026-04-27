import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/server-directory/hub", () => ({
  getProtectedServerHubContext: vi.fn(),
}));

import ServerHubPage from "@/app/servers/[serverSlug]/page";
import { getProtectedServerHubContext } from "@/server/server-directory/hub";

describe("/servers/[serverSlug] page", () => {
  it("при наличии доступа ведёт в отдельный адвокатский кабинет", async () => {
    vi.mocked(getProtectedServerHubContext).mockResolvedValue({
      status: "ready",
      viewer: {
        accountId: "account-1",
        email: "user@example.com",
        login: "tester",
      },
      server: {
        id: "server-1",
        code: "blackberry",
        slug: "blackberry",
        name: "Blackberry",
        directoryAvailability: "active",
      },
      assistantStatus: "current_corpus_ready",
      documentsAvailabilityForViewer: "available",
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
      selectedCharacterSummary: {
        id: "character-1",
        fullName: "Игорь Юристов",
        passportNumber: "AA-001",
        source: "last_used",
      },
    });

    const html = renderToStaticMarkup(
      await ServerHubPage({
        params: Promise.resolve({
          serverSlug: "blackberry",
        }),
      }),
    );

    expect(getProtectedServerHubContext).toHaveBeenCalledWith({
      serverSlug: "blackberry",
      nextPath: "/servers/blackberry",
    });
    expect(html).toContain("Юридический помощник");
    expect(html).toContain("Адвокатский кабинет");
    expect(html).toContain("Blackberry");
    expect(html).toContain("/assistant/blackberry");
    expect(html).toContain("/servers/blackberry/documents");
    expect(html).toContain("/servers/blackberry/lawyer");
    expect(html).toContain("Открыть адвокатский кабинет");
    expect(html).not.toContain("Claims");
    expect(html).not.toContain("OGP complaints");
  });

  it("показывает honest server_not_found state", async () => {
    vi.mocked(getProtectedServerHubContext).mockResolvedValue({
      status: "server_not_found",
      viewer: {
        accountId: "account-1",
        email: "user@example.com",
        login: "tester",
      },
      requestedServerSlug: "unknown",
    });

    const html = renderToStaticMarkup(
      await ServerHubPage({
        params: Promise.resolve({
          serverSlug: "unknown",
        }),
      }),
    );

    expect(html).toContain("Сервер не найден");
    expect(html).toContain("Вернуться к каталогу серверов");
  });

  it("показывает maintenance state и временно выключает module actions", async () => {
    vi.mocked(getProtectedServerHubContext).mockResolvedValue({
      status: "ready",
      viewer: {
        accountId: "account-1",
        email: "user@example.com",
        login: "tester",
      },
      server: {
        id: "server-1",
        code: "blackberry",
        slug: "blackberry",
        name: "Blackberry",
        directoryAvailability: "maintenance",
      },
      assistantStatus: "maintenance_mode",
      documentsAvailabilityForViewer: "unavailable",
      workspaceCapabilities: {
        canOpenAssistant: false,
        canOpenDocumentsWorkspace: true,
        canOpenLawyerWorkspace: false,
        canManageCharacters: true,
        canManageTrustors: true,
        requiresServer: true,
        requiresCharacter: false,
        requiresAdvocateCharacter: false,
        blockReasons: ["materials_unavailable", "character_required"],
      },
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
      selectedCharacterSummary: null,
    });

    const html = renderToStaticMarkup(
      await ServerHubPage({
        params: Promise.resolve({
          serverSlug: "blackberry",
        }),
      }),
    );

    expect(html).toContain("Технические работы");
    expect(html).toContain("Помощник временно недоступен");
    expect(html).toContain("Документы временно недоступны");
    expect(html).not.toContain("/assistant/blackberry");
    expect(html).not.toContain("/servers/blackberry/documents");
  });

  it("без персонажа оставляет assistant доступным и показывает needs_character для documents", async () => {
    vi.mocked(getProtectedServerHubContext).mockResolvedValue({
      status: "ready",
      viewer: {
        accountId: "account-1",
        email: "user@example.com",
        login: "tester",
      },
      server: {
        id: "server-1",
        code: "blackberry",
        slug: "blackberry",
        name: "Blackberry",
        directoryAvailability: "active",
      },
      assistantStatus: "corpus_bootstrap_incomplete",
      documentsAvailabilityForViewer: "needs_character",
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
      selectedCharacterSummary: null,
    });

    const html = renderToStaticMarkup(
      await ServerHubPage({
        params: Promise.resolve({
          serverSlug: "blackberry",
        }),
      }),
    );

    expect(html).toContain("/assistant/blackberry");
    expect(html).toContain("Нужен персонаж");
    expect(html).toContain("/servers/blackberry/documents");
    expect(html).toContain("для жалоб и исков сначала нужен персонаж");
    expect(html).toContain("Для адвокатского кабинета сначала нужен персонаж на этом сервере.");
    expect(html).toContain('/account/characters?server=blackberry"');
  });

  it("без адвокатского доступа оставляет lawyer card видимой и показывает blocked copy", async () => {
    vi.mocked(getProtectedServerHubContext).mockResolvedValue({
      status: "ready",
      viewer: {
        accountId: "account-1",
        email: "user@example.com",
        login: "tester",
      },
      server: {
        id: "server-1",
        code: "blackberry",
        slug: "blackberry",
        name: "Blackberry",
        directoryAvailability: "active",
      },
      assistantStatus: "current_corpus_ready",
      documentsAvailabilityForViewer: "available",
      workspaceCapabilities: {
        canOpenAssistant: true,
        canOpenDocumentsWorkspace: true,
        canOpenLawyerWorkspace: false,
        canManageCharacters: true,
        canManageTrustors: true,
        requiresServer: true,
        requiresCharacter: false,
        requiresAdvocateCharacter: false,
        blockReasons: ["advocate_character_required"],
      },
      documentEntryCapabilities: {
        canCreateSelfComplaint: true,
        canCreateClaims: true,
        canCreateAttorneyRequest: false,
        canCreateLegalServicesAgreement: false,
        requiresServer: true,
        requiresCharacter: true,
        requiresAdvocateCharacter: false,
        blockReasons: ["advocate_character_required"],
      },
      selectedCharacterSummary: {
        id: "character-1",
        fullName: "Игорь Юристов",
        passportNumber: "AA-001",
        source: "last_used",
      },
    });

    const html = renderToStaticMarkup(
      await ServerHubPage({
        params: Promise.resolve({
          serverSlug: "blackberry",
        }),
      }),
    );

    expect(html).toContain("Адвокатский кабинет");
    expect(html).toContain("Для адвокатского кабинета нужен персонаж с адвокатским доступом.");
    expect(html).toContain('/account/characters?server=blackberry"');
    expect(html).not.toContain("/servers/blackberry/lawyer");
  });

  it("показывает honest server_unavailable state для недоступного сервера", async () => {
    vi.mocked(getProtectedServerHubContext).mockResolvedValue({
      status: "server_unavailable",
      viewer: {
        accountId: "account-1",
        email: "user@example.com",
        login: "tester",
      },
      server: {
        id: "server-1",
        code: "legacy",
        slug: "legacy",
        name: "Legacy",
        directoryAvailability: "unavailable",
      },
    });

    const html = renderToStaticMarkup(
      await ServerHubPage({
        params: Promise.resolve({
          serverSlug: "legacy",
        }),
      }),
    );

    expect(html).toContain("недоступен");
    expect(html).toContain("Legacy");
    expect(html).toContain("/servers");
  });
});
