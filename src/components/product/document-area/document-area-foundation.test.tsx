import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ServerDocumentsHub } from "@/components/product/document-area/document-area-foundation";

describe("ServerDocumentsHub", () => {
  it("оставляет general documents primary и ведёт в адвокатский кабинет при готовом адвокатском доступе", () => {
    const html = renderToStaticMarkup(
      <ServerDocumentsHub
        attorneyRequestDocumentCount={3}
        documentEntryCapabilities={{
          canCreateSelfComplaint: true,
          canCreateClaims: true,
          canCreateAttorneyRequest: true,
          canCreateLegalServicesAgreement: true,
          requiresServer: true,
          requiresCharacter: true,
          requiresAdvocateCharacter: false,
          blockReasons: [],
        }}
        legalServicesAgreementDocumentCount={2}
        ogpComplaintDocumentCount={5}
        selectedCharacter={{
          id: "character-1",
          fullName: "Игорь Юристов",
          passportNumber: "AA-001",
          source: "last_used",
        }}
        server={{
          code: "blackberry",
          name: "Blackberry",
        }}
        workspaceCapabilities={{
          canOpenAssistant: true,
          canOpenDocumentsWorkspace: true,
          canOpenLawyerWorkspace: true,
          canManageCharacters: true,
          canManageTrustors: true,
          requiresServer: true,
          requiresCharacter: false,
          requiresAdvocateCharacter: false,
          blockReasons: [],
        }}
      />,
    );

    expect(html).toContain("Жалобы в ОГП");
    expect(html).toContain("Иски");
    expect(html).toContain("Адвокатские документы");
    expect(html).toContain("/servers/blackberry/lawyer");
    expect(html).not.toContain("Создать договор");
    expect(html).not.toContain("Создать запрос");
  });

  it("без персонажа показывает helper-state внутри documents hub", () => {
    const html = renderToStaticMarkup(
      <ServerDocumentsHub
        bridgeHref="/account/characters?server=blackberry#create-character-blackberry"
        documentEntryCapabilities={{
          canCreateSelfComplaint: false,
          canCreateClaims: false,
          canCreateAttorneyRequest: false,
          canCreateLegalServicesAgreement: false,
          requiresServer: true,
          requiresCharacter: true,
          requiresAdvocateCharacter: false,
          blockReasons: ["character_required"],
        }}
        selectedCharacter={null}
        server={{
          code: "blackberry",
          name: "Blackberry",
        }}
        workspaceCapabilities={{
          canOpenAssistant: true,
          canOpenDocumentsWorkspace: true,
          canOpenLawyerWorkspace: false,
          canManageCharacters: true,
          canManageTrustors: true,
          requiresServer: true,
          requiresCharacter: false,
          requiresAdvocateCharacter: false,
          blockReasons: ["character_required"],
        }}
      />,
    );

    expect(html).toContain("Персонаж пока не выбран");
    expect(html).toContain("Чтобы начать жалобу, сначала нужен персонаж на этом сервере.");
    expect(html).toContain("Для адвокатских документов сначала нужен персонаж на этом сервере.");
    expect(html).toContain("/account/characters?server=blackberry#create-character-blackberry");
  });

  it("без адвокатского доступа показывает следующий шаг без технических терминов", () => {
    const html = renderToStaticMarkup(
      <ServerDocumentsHub
        bridgeHref="/account/characters?server=blackberry"
        documentEntryCapabilities={{
          canCreateSelfComplaint: true,
          canCreateClaims: true,
          canCreateAttorneyRequest: false,
          canCreateLegalServicesAgreement: false,
          requiresServer: true,
          requiresCharacter: true,
          requiresAdvocateCharacter: false,
          blockReasons: ["advocate_character_required", "access_request_required"],
        }}
        selectedCharacter={{
          id: "character-1",
          fullName: "Игорь Юристов",
          passportNumber: "AA-001",
          source: "last_used",
        }}
        server={{
          code: "blackberry",
          name: "Blackberry",
        }}
        workspaceCapabilities={{
          canOpenAssistant: true,
          canOpenDocumentsWorkspace: true,
          canOpenLawyerWorkspace: false,
          canManageCharacters: true,
          canManageTrustors: true,
          requiresServer: true,
          requiresCharacter: false,
          requiresAdvocateCharacter: false,
          blockReasons: ["advocate_character_required", "access_request_required"],
        }}
      />,
    );

    expect(html).toContain("Для адвокатских документов нужен персонаж с адвокатским доступом.");
    expect(html).toContain("доступ оформляется через его заявку");
    expect(html).toContain("/account/characters?server=blackberry");
  });

  it("показывает compatibility note про доверителя, не выдавая его за финальное правило", () => {
    const html = renderToStaticMarkup(
      <ServerDocumentsHub
        documentEntryCapabilities={{
          canCreateSelfComplaint: true,
          canCreateClaims: true,
          canCreateAttorneyRequest: false,
          canCreateLegalServicesAgreement: false,
          requiresServer: true,
          requiresCharacter: true,
          requiresAdvocateCharacter: false,
          blockReasons: ["trustor_required_temporarily"],
        }}
        selectedCharacter={{
          id: "character-1",
          fullName: "Игорь Юристов",
          passportNumber: "AA-001",
          source: "last_used",
        }}
        server={{
          code: "blackberry",
          name: "Blackberry",
        }}
        workspaceCapabilities={{
          canOpenAssistant: true,
          canOpenDocumentsWorkspace: true,
          canOpenLawyerWorkspace: true,
          canManageCharacters: true,
          canManageTrustors: true,
          requiresServer: true,
          requiresCharacter: false,
          requiresAdvocateCharacter: false,
          blockReasons: [],
        }}
      />,
    );

    expect(html).toContain("В текущей версии для этого действия нужен сохранённый доверитель.");
    expect(html).toContain("Адвокатские документы");
  });
});
