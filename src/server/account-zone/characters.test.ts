import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/repositories/server.repository", () => ({
  getServers: vi.fn(),
}));

vi.mock("@/db/repositories/character.repository", () => ({
  listCharactersForAccount: vi.fn(),
}));

vi.mock("@/db/repositories/user-server-state.repository", () => ({
  getUserServerStates: vi.fn(),
}));

vi.mock("@/server/auth/protected", () => ({
  requireProtectedAccountContext: vi.fn(),
}));

import { getServers } from "@/db/repositories/server.repository";
import { listCharactersForAccount } from "@/db/repositories/character.repository";
import { getUserServerStates } from "@/db/repositories/user-server-state.repository";
import { requireProtectedAccountContext } from "@/server/auth/protected";
import { getAccountCharactersOverviewContext } from "@/server/account-zone/characters";

describe("getAccountCharactersOverviewContext", () => {
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
    expect(context.serverGroups[0].characters[0].roleKeys).toEqual(["lawyer"]);
    expect(context.serverGroups[0].characters[0].accessFlagKeys).toEqual(["advocate"]);
    expect(context.serverGroups[0].characters[0].hasProfileData).toBe(true);
    expect(context.serverGroups[0].characters[0].compactProfileSummary).toContain("2");
    expect(context.serverGroups[0].characters[0].isDefaultForServer).toBe(true);
    expect(context.serverGroups[1].server.code).toBe("rainbow");
    expect(context.serverGroups[1].characterCount).toBe(0);
    expect(context.serverGroups[1].defaultCharacterId).toBeNull();
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

    const context = await getAccountCharactersOverviewContext({
      nextPath: "/account/characters",
    });

    expect(context.serverGroups[0].defaultCharacterId).toBeNull();
    expect(context.serverGroups[0].defaultCharacterLabel).toBeNull();
    expect(context.serverGroups[0].characters[0].isDefaultForServer).toBe(false);
  });
});
