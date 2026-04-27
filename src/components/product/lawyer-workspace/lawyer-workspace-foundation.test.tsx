import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LawyerWorkspaceFoundation } from "@/components/product/lawyer-workspace/lawyer-workspace-foundation";

describe("lawyer workspace foundation", () => {
  it("рендерит ready state с совместимыми входами в доверителей, договоры и запросы", () => {
    const html = renderToStaticMarkup(
      <LawyerWorkspaceFoundation
        context={{
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
          trustorCount: 2,
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
        }}
      />,
    );

    expect(html).toContain("Адвокатский кабинет");
    expect(html).toContain("Сервер: Blackberry");
    expect(html).toContain("Персонаж: Игорь Юристов");
    expect(html).toContain('/account/trustors?server=blackberry');
    expect(html).toContain("/servers/blackberry/documents/attorney-requests");
    expect(html).toContain("/servers/blackberry/documents/legal-services-agreements");
    expect(html).toContain("Документы в интересах доверителя");
    expect(html).toContain("Незавершённые действия");
  });

  it("показывает blocked state без персонажа", () => {
    const html = renderToStaticMarkup(
      <LawyerWorkspaceFoundation
        context={{
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
            slug: "blackberry",
            name: "Blackberry",
          },
          trustorCount: 0,
          selectedCharacter: null,
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
          compatibilityHrefs: {
            trustorsHref: "/account/trustors?server=blackberry",
            charactersHref: "/account/characters?server=blackberry",
            attorneyRequestsHref: "/servers/blackberry/documents/attorney-requests",
            attorneyRequestCreateHref: "/servers/blackberry/documents/attorney-requests/new",
            agreementsHref: "/servers/blackberry/documents/legal-services-agreements",
            agreementCreateHref: "/servers/blackberry/documents/legal-services-agreements/new",
          },
        }}
      />,
    );

    expect(html).toContain("Сначала нужен персонаж");
    expect(html).toContain("/account/characters?server=blackberry");
  });

  it("показывает blocked state без адвокатского доступа", () => {
    const html = renderToStaticMarkup(
      <LawyerWorkspaceFoundation
        context={{
          status: "no_advocate_access",
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
          trustorCount: 0,
          selectedCharacter: {
            id: "character-1",
            fullName: "Игорь Юристов",
            passportNumber: "AA-001",
            source: "last_used",
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
            blockReasons: ["advocate_character_required", "access_request_required"],
          },
          documentEntryCapabilities: {
            canCreateSelfComplaint: true,
            canCreateClaims: true,
            canCreateAttorneyRequest: false,
            canCreateLegalServicesAgreement: false,
            requiresServer: true,
            requiresCharacter: true,
            requiresAdvocateCharacter: false,
            blockReasons: ["advocate_character_required", "access_request_required"],
          },
          compatibilityHrefs: {
            trustorsHref: "/account/trustors?server=blackberry",
            charactersHref: "/account/characters?server=blackberry",
            attorneyRequestsHref: "/servers/blackberry/documents/attorney-requests",
            attorneyRequestCreateHref: "/servers/blackberry/documents/attorney-requests/new",
            agreementsHref: "/servers/blackberry/documents/legal-services-agreements",
            agreementCreateHref: "/servers/blackberry/documents/legal-services-agreements/new",
          },
        }}
      />,
    );

    expect(html).toContain("Нужен адвокатский доступ");
    expect(html).toContain("оформляется через его заявку");
    expect(html).toContain("/account/characters?server=blackberry");
  });

  it("показывает compatibility note для доверителя, когда trustor registry ещё обязателен", () => {
    const html = renderToStaticMarkup(
      <LawyerWorkspaceFoundation
        context={{
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
          trustorCount: 0,
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
            canCreateAttorneyRequest: false,
            canCreateLegalServicesAgreement: false,
            requiresServer: true,
            requiresCharacter: true,
            requiresAdvocateCharacter: false,
            blockReasons: ["trustor_required_temporarily"],
          },
          compatibilityHrefs: {
            trustorsHref: "/account/trustors?server=blackberry",
            charactersHref: "/account/characters?server=blackberry",
            attorneyRequestsHref: "/servers/blackberry/documents/attorney-requests",
            attorneyRequestCreateHref: "/servers/blackberry/documents/attorney-requests/new",
            agreementsHref: "/servers/blackberry/documents/legal-services-agreements",
            agreementCreateHref: "/servers/blackberry/documents/legal-services-agreements/new",
          },
        }}
      />,
    );

    expect(html).toContain("В текущей версии для этого действия нужен сохранённый доверитель.");
  });
});
