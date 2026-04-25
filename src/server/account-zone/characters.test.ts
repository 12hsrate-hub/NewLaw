import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db/repositories/server.repository", () => ({
  getServers: vi.fn(),
}));

vi.mock("@/db/repositories/character.repository", () => ({
  listCharactersForAccount: vi.fn(),
}));

vi.mock("@/db/repositories/character-access-request.repository", () => ({
  listCharacterAccessRequestsForAccount: vi.fn(),
}));

vi.mock("@/db/repositories/user-server-state.repository", () => ({
  getUserServerStates: vi.fn(),
}));

vi.mock("@/server/auth/protected", () => ({
  requireProtectedAccountContext: vi.fn(),
}));

vi.mock("@/server/character-signatures/service", () => ({
  createCharacterSignaturePreviewUrl: vi.fn(),
}));

import { getServers } from "@/db/repositories/server.repository";
import { listCharactersForAccount } from "@/db/repositories/character.repository";
import { listCharacterAccessRequestsForAccount } from "@/db/repositories/character-access-request.repository";
import { getUserServerStates } from "@/db/repositories/user-server-state.repository";
import { requireProtectedAccountContext } from "@/server/auth/protected";
import { createCharacterSignaturePreviewUrl } from "@/server/character-signatures/service";
import { getAccountCharactersOverviewContext } from "@/server/account-zone/characters";

describe("getAccountCharactersOverviewContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createCharacterSignaturePreviewUrl).mockResolvedValue("https://example.com/signature.png");
  });

  it("строит account-wide overview по серверам и показывает default character только как informational state", async () => {
    vi.mocked(requireProtectedAccountContext).mockResolvedValue({
      user: {
        id: "user-1",
        email: "user@example.com",
      },
      account: {
        id: "account-1",
        email: "user@example.com",
        login: "tester",
        mustChangePassword: false,
      },
    } as never);
    vi.mocked(getServers).mockResolvedValue([
      {
        id: "server-1",
        code: "blackberry",
        name: "Blackberry",
      },
      {
        id: "server-2",
        code: "rainbow",
        name: "Rainbow",
      },
    ] as never);
    vi.mocked(listCharactersForAccount).mockResolvedValue([
      {
        id: "character-1",
        accountId: "account-1",
        serverId: "server-1",
        fullName: "Игорь Юристов",
        nickname: "Игорь Юристов",
        passportNumber: "AA-001",
        isProfileComplete: true,
        profileDataJson: {
          title: "адвокат",
          signature: "И. Юристов",
        },
        roles: [{ roleKey: "lawyer" }],
        accessFlags: [{ flagKey: "advocate" }],
      },
    ] as never);
    vi.mocked(getUserServerStates).mockResolvedValue([
      {
        serverId: "server-1",
        activeCharacterId: "character-1",
      },
      {
        serverId: "server-2",
        activeCharacterId: null,
      },
    ] as never);
    vi.mocked(listCharacterAccessRequestsForAccount).mockResolvedValue([
      {
        id: "request-1",
        accountId: "account-1",
        serverId: "server-1",
        characterId: "character-1",
        requestType: "advocate_access",
        status: "pending",
        requestComment: "Нужен адвокатский доступ",
        reviewComment: null,
        reviewedByAccountId: null,
        reviewedAt: null,
        createdAt: new Date("2026-04-24T10:00:00.000Z"),
        updatedAt: new Date("2026-04-24T10:00:00.000Z"),
      },
    ] as never);

    const context = await getAccountCharactersOverviewContext({
      nextPath: "/account/characters",
      focusedServerCode: "blackberry",
    });

    expect(requireProtectedAccountContext).toHaveBeenCalledWith(
      "/account/characters",
      undefined,
      {
        allowMustChangePassword: true,
      },
    );
    expect(context.focusedServerCode).toBe("blackberry");
    expect(context.serverGroups).toHaveLength(2);
    expect(context.serverGroups[0].server.code).toBe("blackberry");
    expect(context.serverGroups[0].isFocused).toBe(true);
    expect(context.serverGroups[0].characterCount).toBe(1);
    expect(context.serverGroups[0].defaultCharacterId).toBe("character-1");
    expect(context.serverGroups[0].defaultCharacterLabel).toContain("Игорь Юристов");
    expect(context.serverGroups[0].createBridgeHref).toBe(
      "/account/characters?server=blackberry#create-character-blackberry",
    );
    expect(context.serverGroups[0].focusHref).toBe("/account/characters?server=blackberry");
    expect(context.serverGroups[0].characters[0].roleKeys).toEqual(["lawyer"]);
    expect(context.serverGroups[0].characters[0].accessFlagKeys).toEqual(["advocate"]);
    expect(context.serverGroups[0].characters[0].hasProfileData).toBe(true);
    expect(context.serverGroups[0].characters[0].compactProfileSummary).toContain("2");
    expect(context.serverGroups[0].characters[0].profileSignature).toBe("И. Юристов");
    expect(context.serverGroups[0].characters[0].profileNote).toBeNull();
    expect(context.serverGroups[0].characters[0].isDefaultForServer).toBe(true);
    expect(context.serverGroups[0].characters[0].advocateAccessRequest).toEqual({
      canSubmit: false,
      requestType: "advocate_access",
      status: "granted",
      requestComment: null,
      reviewComment: null,
      createdAt: null,
    });
    expect(context.serverGroups[1].server.code).toBe("rainbow");
    expect(context.serverGroups[1].characterCount).toBe(0);
    expect(context.serverGroups[1].defaultCharacterId).toBeNull();
    expect(context.serverGroups[1].createBridgeHref).toBe(
      "/account/characters?server=rainbow#create-character-rainbow",
    );
  });

  it("не зависит от active shell server и мягко переживает битый activeCharacterId", async () => {
    vi.mocked(requireProtectedAccountContext).mockResolvedValue({
      user: {
        id: "user-1",
        email: "user@example.com",
      },
      account: {
        id: "account-1",
        email: "user@example.com",
        login: "tester",
        mustChangePassword: false,
      },
    } as never);
    vi.mocked(getServers).mockResolvedValue([
      {
        id: "server-1",
        code: "blackberry",
        name: "Blackberry",
      },
    ] as never);
    vi.mocked(listCharactersForAccount).mockResolvedValue([
      {
        id: "character-1",
        accountId: "account-1",
        serverId: "server-1",
        fullName: "Павел Тестов",
        nickname: "Павел Тестов",
        passportNumber: "AA-002",
        isProfileComplete: false,
        profileDataJson: null,
        roles: [],
        accessFlags: [],
      },
    ] as never);
    vi.mocked(getUserServerStates).mockResolvedValue([
      {
        serverId: "server-1",
        activeCharacterId: "missing-character",
      },
    ] as never);
    vi.mocked(listCharacterAccessRequestsForAccount).mockResolvedValue([
      {
        id: "request-2",
        accountId: "account-1",
        serverId: "server-1",
        characterId: "character-1",
        requestType: "advocate_access",
        status: "rejected",
        requestComment: "Пробная заявка",
        reviewComment: "Недостаточно данных",
        reviewedByAccountId: "admin-1",
        reviewedAt: new Date("2026-04-24T11:00:00.000Z"),
        createdAt: new Date("2026-04-24T10:00:00.000Z"),
        updatedAt: new Date("2026-04-24T11:00:00.000Z"),
      },
    ] as never);

    const context = await getAccountCharactersOverviewContext({
      nextPath: "/account/characters",
    });

    expect(context.serverGroups[0].defaultCharacterId).toBeNull();
    expect(context.serverGroups[0].defaultCharacterLabel).toBeNull();
    expect(context.serverGroups[0].characters[0].isDefaultForServer).toBe(false);
    expect(context.serverGroups[0].characters[0].advocateAccessRequest).toEqual({
      canSubmit: true,
      requestType: "advocate_access",
      status: "rejected",
      requestComment: "Пробная заявка",
      reviewComment: "Недостаточно данных",
      createdAt: "2026-04-24T10:00:00.000Z",
    });
  });

  it("логирует и пробрасывает ошибку, если не загружаются обязательные character data", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    vi.mocked(requireProtectedAccountContext).mockResolvedValue({
      user: {
        id: "user-1",
        email: "user@example.com",
      },
      account: {
        id: "account-1",
        email: "user@example.com",
        login: "tester",
        mustChangePassword: false,
      },
    } as never);
    vi.mocked(getServers).mockRejectedValue(new Error("server query failed"));

    await expect(
      getAccountCharactersOverviewContext({
        nextPath: "/account/characters",
      }),
    ).rejects.toThrow("server query failed");

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "ACCOUNT_CHARACTERS_REQUIRED_DATA_LOAD_FAILED",
      expect.objectContaining({
        accountId: "account-1",
        message: "server query failed",
      }),
    );

    consoleErrorSpy.mockRestore();
  });

  it("не роняет overview, если preview активной подписи временно недоступен", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    vi.mocked(requireProtectedAccountContext).mockResolvedValue({
      user: {
        id: "user-1",
        email: "user@example.com",
      },
      account: {
        id: "account-1",
        email: "user@example.com",
        login: "tester",
        mustChangePassword: false,
      },
    } as never);
    vi.mocked(getServers).mockResolvedValue([
      {
        id: "server-1",
        code: "blackberry",
        name: "Blackberry",
      },
    ] as never);
    vi.mocked(listCharactersForAccount).mockResolvedValue([
      {
        id: "character-1",
        accountId: "account-1",
        serverId: "server-1",
        fullName: "Игорь Юристов",
        nickname: "Игорь Юристов",
        passportNumber: "AA-001",
        isProfileComplete: true,
        profileDataJson: null,
        roles: [{ roleKey: "lawyer" }],
        accessFlags: [{ flagKey: "advocate" }],
        activeSignature: {
          id: "signature-1",
          characterId: "character-1",
          storagePath: "signatures/sig-1.png",
          mimeType: "image/png",
          width: 400,
          height: 120,
          fileSize: 1024,
          createdAt: new Date("2026-04-24T10:00:00.000Z"),
          updatedAt: new Date("2026-04-24T10:00:00.000Z"),
        },
      },
    ] as never);
    vi.mocked(getUserServerStates).mockResolvedValue([] as never);
    vi.mocked(listCharacterAccessRequestsForAccount).mockResolvedValue([] as never);
    vi.mocked(createCharacterSignaturePreviewUrl).mockRejectedValue(
      new Error("storage unavailable"),
    );

    const context = await getAccountCharactersOverviewContext({
      nextPath: "/account/characters",
    });

    expect(context.serverGroups[0].characters[0].activeSignature).toEqual(
      expect.objectContaining({
        id: "signature-1",
        previewUrl: null,
      }),
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "ACCOUNT_CHARACTERS_SIGNATURE_PREVIEW_FAILED",
      expect.objectContaining({
        accountId: "account-1",
        characterId: "character-1",
        message: "storage unavailable",
      }),
    );

    consoleErrorSpy.mockRestore();
  });
});
