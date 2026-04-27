import { describe, expect, it } from "vitest";

import {
  buildDocumentEntryCapabilities,
  buildWorkspaceCapabilities,
} from "@/server/navigation/capabilities";

describe("navigation capabilities", () => {
  it("для гостя требует auth для protected entry points", () => {
    const workspace = buildWorkspaceCapabilities({
      isAuthenticated: false,
      hasServer: true,
      hasAssistantMaterials: true,
      hasSelectedCharacter: false,
      hasAdvocateCharacter: false,
    });
    const documentEntry = buildDocumentEntryCapabilities({
      isAuthenticated: false,
      hasServer: true,
      hasSelectedCharacter: false,
      hasAdvocateCharacter: false,
      hasTrustorRegistry: false,
      canCreateAttorneyRequestLegacy: false,
      compatibilityRequiresTrustorRegistryForLegalServicesAgreement: true,
    });

    expect(workspace.canOpenAssistant).toBe(true);
    expect(workspace.canOpenDocumentsWorkspace).toBe(false);
    expect(workspace.canOpenLawyerWorkspace).toBe(false);
    expect(workspace.canManageCharacters).toBe(false);
    expect(workspace.canManageTrustors).toBe(false);
    expect(workspace.blockReasons).toContain("auth_required");

    expect(documentEntry.canCreateSelfComplaint).toBe(false);
    expect(documentEntry.canCreateClaims).toBe(false);
    expect(documentEntry.canCreateAttorneyRequest).toBe(false);
    expect(documentEntry.canCreateLegalServicesAgreement).toBe(false);
    expect(documentEntry.blockReasons).toContain("auth_required");
  });

  it("без server context возвращает server_required", () => {
    const workspace = buildWorkspaceCapabilities({
      isAuthenticated: true,
      hasServer: false,
      hasAssistantMaterials: false,
      hasSelectedCharacter: false,
      hasAdvocateCharacter: false,
    });

    expect(workspace.canOpenAssistant).toBe(false);
    expect(workspace.canOpenDocumentsWorkspace).toBe(false);
    expect(workspace.canOpenLawyerWorkspace).toBe(false);
    expect(workspace.blockReasons).toContain("server_required");
  });

  it("documents workspace открывается без персонажа, но создание жалобы блокируется", () => {
    const workspace = buildWorkspaceCapabilities({
      isAuthenticated: true,
      hasServer: true,
      hasAssistantMaterials: true,
      hasSelectedCharacter: false,
      hasAdvocateCharacter: false,
    });
    const documentEntry = buildDocumentEntryCapabilities({
      isAuthenticated: true,
      hasServer: true,
      hasSelectedCharacter: false,
      hasAdvocateCharacter: false,
      hasTrustorRegistry: false,
      canCreateAttorneyRequestLegacy: false,
      compatibilityRequiresTrustorRegistryForLegalServicesAgreement: true,
    });

    expect(workspace.canOpenDocumentsWorkspace).toBe(true);
    expect(documentEntry.canCreateSelfComplaint).toBe(false);
    expect(documentEntry.canCreateClaims).toBe(false);
    expect(documentEntry.blockReasons).toContain("character_required");
  });

  it("выбранный персонаж разрешает жалобу от себя и иски", () => {
    const documentEntry = buildDocumentEntryCapabilities({
      isAuthenticated: true,
      hasServer: true,
      hasSelectedCharacter: true,
      hasAdvocateCharacter: false,
      hasTrustorRegistry: false,
      canCreateAttorneyRequestLegacy: false,
      compatibilityRequiresTrustorRegistryForLegalServicesAgreement: true,
    });

    expect(documentEntry.canCreateSelfComplaint).toBe(true);
    expect(documentEntry.canCreateClaims).toBe(true);
  });

  it("персонаж с advocate readiness открывает lawyer workspace", () => {
    const workspace = buildWorkspaceCapabilities({
      isAuthenticated: true,
      hasServer: true,
      hasAssistantMaterials: true,
      hasSelectedCharacter: true,
      hasAdvocateCharacter: true,
    });

    expect(workspace.canOpenLawyerWorkspace).toBe(true);
  });

  it("неадвокатский персонаж блокирует lawyer workspace через advocate_character_required", () => {
    const workspace = buildWorkspaceCapabilities({
      isAuthenticated: true,
      hasServer: true,
      hasAssistantMaterials: true,
      hasSelectedCharacter: true,
      hasAdvocateCharacter: false,
    });

    expect(workspace.canOpenLawyerWorkspace).toBe(false);
    expect(workspace.blockReasons).toContain("advocate_character_required");
  });

  it("legal services agreement без trustor registry получает compatibility blocker", () => {
    const documentEntry = buildDocumentEntryCapabilities({
      isAuthenticated: true,
      hasServer: true,
      hasSelectedCharacter: true,
      hasAdvocateCharacter: true,
      hasTrustorRegistry: false,
      canCreateAttorneyRequestLegacy: true,
      compatibilityRequiresTrustorRegistryForLegalServicesAgreement: true,
    });

    expect(documentEntry.canCreateLegalServicesAgreement).toBe(false);
    expect(documentEntry.blockReasons).toContain("trustor_required_temporarily");
  });

  it("materials unavailable добавляет assistant-related blocker", () => {
    const workspace = buildWorkspaceCapabilities({
      isAuthenticated: true,
      hasServer: true,
      hasAssistantMaterials: false,
      hasSelectedCharacter: true,
      hasAdvocateCharacter: true,
    });

    expect(workspace.canOpenAssistant).toBe(false);
    expect(workspace.blockReasons).toContain("materials_unavailable");
  });
});
