import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/repositories/character.repository", () => ({
  getCharactersByServer: vi.fn(),
}));

vi.mock("@/db/repositories/server.repository", () => ({
  getServerByCode: vi.fn(),
  getServers: vi.fn(),
}));

vi.mock("@/db/repositories/user-server-state.repository", () => ({
  getUserServerStates: vi.fn(),
}));

vi.mock("@/server/auth/protected", () => ({
  requireProtectedAccountContext: vi.fn(),
}));

import { getCharactersByServer } from "@/db/repositories/character.repository";
import { getServerByCode, getServers } from "@/db/repositories/server.repository";
import { getUserServerStates } from "@/db/repositories/user-server-state.repository";
import {
  buildCharactersBridgePath,
  getAccountDocumentsOverviewContext,
  getServerDocumentsRouteContext,
} from "@/server/document-area/context";
import { requireProtectedAccountContext } from "@/server/auth/protected";

describe("document area context", () => {
  it("строит account documents overview как cross-server агрегатор", async () => {
    vi.mocked(requireProtectedAccountContext).mockResolvedValue({
      user: {
        id: "user-1",
        email: "user@example.com",
      },
      account: {
        id: "00000000-0000-0000-0000-000000000001",
        email: "user@example.com",
        login: "tester",
        pendingEmail: null,
        pendingEmailRequestedAt: null,
        isSuperAdmin: false,
        mustChangePassword: false,
        mustChangePasswordReason: null,
        passwordChangedAt: null,
        createdAt: new Date("2026-04-21T10:00:00.000Z"),
        updatedAt: new Date("2026-04-21T10:00:00.000Z"),
      },
    });
    vi.mocked(getServers).mockResolvedValue([
      {
        id: "server-1",
        code: "blackberry",
        name: "Blackberry",
        isActive: true,
        sortOrder: 1,
        createdAt: new Date("2026-04-21T10:00:00.000Z"),
        updatedAt: new Date("2026-04-21T10:00:00.000Z"),
      },
      {
        id: "server-2",
        code: "lime",
        name: "Lime",
        isActive: true,
        sortOrder: 2,
        createdAt: new Date("2026-04-21T10:00:00.000Z"),
        updatedAt: new Date("2026-04-21T10:00:00.000Z"),
      },
    ]);
    vi.mocked(getUserServerStates).mockResolvedValue([
      {
        id: "state-1",
        accountId: "00000000-0000-0000-0000-000000000001",
        serverId: "server-1",
        activeCharacterId: "character-2",
        lastSelectedAt: new Date("2026-04-21T10:00:00.000Z"),
        createdAt: new Date("2026-04-21T10:00:00.000Z"),
        updatedAt: new Date("2026-04-21T10:00:00.000Z"),
      },
    ]);
    vi.mocked(getCharactersByServer)
      .mockResolvedValueOnce([
        {
          id: "character-1",
          accountId: "00000000-0000-0000-0000-000000000001",
          serverId: "server-1",
          fullName: "Павел Тестов",
          nickname: "Павел Тестов",
          passportNumber: "AA-001",
          isProfileComplete: true,
          profileDataJson: null,
          deletedAt: null,
          createdAt: new Date("2026-04-21T10:00:00.000Z"),
          updatedAt: new Date("2026-04-21T10:00:00.000Z"),
          roles: [],
          accessFlags: [],
        },
        {
          id: "character-2",
          accountId: "00000000-0000-0000-0000-000000000001",
          serverId: "server-1",
          fullName: "Игорь Юристов",
          nickname: "Игорь Юристов",
          passportNumber: "AA-002",
          isProfileComplete: true,
          profileDataJson: null,
          deletedAt: null,
          createdAt: new Date("2026-04-21T10:00:00.000Z"),
          updatedAt: new Date("2026-04-21T10:00:00.000Z"),
          roles: [],
          accessFlags: [],
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await getAccountDocumentsOverviewContext("/account/documents");

    expect(requireProtectedAccountContext).toHaveBeenCalledWith(
      "/account/documents",
      undefined,
      { allowMustChangePassword: true },
    );
    expect(result.servers).toEqual([
      expect.objectContaining({
        code: "blackberry",
        characterCount: 2,
        selectedCharacterId: "character-2",
        selectedCharacterName: "Игорь Юристов",
        selectedCharacterSource: "last_used",
      }),
      expect.objectContaining({
        code: "lime",
        characterCount: 0,
        selectedCharacterId: null,
        selectedCharacterSource: "none",
      }),
    ]);
  });

  it("берёт server context только из route slug и возвращает ready state с last-used character", async () => {
    vi.mocked(requireProtectedAccountContext).mockResolvedValue({
      user: {
        id: "user-1",
        email: "user@example.com",
      },
      account: {
        id: "00000000-0000-0000-0000-000000000001",
        email: "user@example.com",
        login: "tester",
        pendingEmail: null,
        pendingEmailRequestedAt: null,
        isSuperAdmin: false,
        mustChangePassword: false,
        mustChangePasswordReason: null,
        passwordChangedAt: null,
        createdAt: new Date("2026-04-21T10:00:00.000Z"),
        updatedAt: new Date("2026-04-21T10:00:00.000Z"),
      },
    });
    vi.mocked(getServers).mockResolvedValue([
      {
        id: "server-1",
        code: "blackberry",
        name: "Blackberry",
        isActive: true,
        sortOrder: 1,
        createdAt: new Date("2026-04-21T10:00:00.000Z"),
        updatedAt: new Date("2026-04-21T10:00:00.000Z"),
      },
    ]);
    vi.mocked(getServerByCode).mockResolvedValue({
      id: "server-1",
      code: "blackberry",
      name: "Blackberry",
      isActive: true,
      sortOrder: 1,
      createdAt: new Date("2026-04-21T10:00:00.000Z"),
      updatedAt: new Date("2026-04-21T10:00:00.000Z"),
    });
    vi.mocked(getUserServerStates).mockResolvedValue([
      {
        id: "state-1",
        accountId: "00000000-0000-0000-0000-000000000001",
        serverId: "server-1",
        activeCharacterId: "character-2",
        lastSelectedAt: new Date("2026-04-21T10:00:00.000Z"),
        createdAt: new Date("2026-04-21T10:00:00.000Z"),
        updatedAt: new Date("2026-04-21T10:00:00.000Z"),
      },
    ]);
    vi.mocked(getCharactersByServer)
      .mockResolvedValueOnce([
        {
          id: "character-1",
          accountId: "00000000-0000-0000-0000-000000000001",
          serverId: "server-1",
          fullName: "Павел Тестов",
          nickname: "Павел Тестов",
          passportNumber: "AA-001",
          isProfileComplete: true,
          profileDataJson: null,
          deletedAt: null,
          createdAt: new Date("2026-04-21T10:00:00.000Z"),
          updatedAt: new Date("2026-04-21T10:00:00.000Z"),
          roles: [],
          accessFlags: [],
        },
        {
          id: "character-2",
          accountId: "00000000-0000-0000-0000-000000000001",
          serverId: "server-1",
          fullName: "Игорь Юристов",
          nickname: "Игорь Юристов",
          passportNumber: "AA-002",
          isProfileComplete: true,
          profileDataJson: null,
          deletedAt: null,
          createdAt: new Date("2026-04-21T10:00:00.000Z"),
          updatedAt: new Date("2026-04-21T10:00:00.000Z"),
          roles: [],
          accessFlags: [],
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "character-1",
          accountId: "00000000-0000-0000-0000-000000000001",
          serverId: "server-1",
          fullName: "Павел Тестов",
          nickname: "Павел Тестов",
          passportNumber: "AA-001",
          isProfileComplete: true,
          profileDataJson: null,
          deletedAt: null,
          createdAt: new Date("2026-04-21T10:00:00.000Z"),
          updatedAt: new Date("2026-04-21T10:00:00.000Z"),
          roles: [],
          accessFlags: [],
        },
        {
          id: "character-2",
          accountId: "00000000-0000-0000-0000-000000000001",
          serverId: "server-1",
          fullName: "Игорь Юристов",
          nickname: "Игорь Юристов",
          passportNumber: "AA-002",
          isProfileComplete: true,
          profileDataJson: null,
          deletedAt: null,
          createdAt: new Date("2026-04-21T10:00:00.000Z"),
          updatedAt: new Date("2026-04-21T10:00:00.000Z"),
          roles: [],
          accessFlags: [],
        },
      ]);

    const result = await getServerDocumentsRouteContext({
      serverSlug: "blackberry",
      nextPath: "/servers/blackberry/documents",
    });

    expect(getServerByCode).toHaveBeenCalledWith("blackberry");
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.server.code).toBe("blackberry");
      expect(result.selectedCharacter).toEqual(
        expect.objectContaining({
          id: "character-2",
          fullName: "Игорь Юристов",
          source: "last_used",
        }),
      );
    }
  });

  it("возвращает no_characters state, если на сервере нет персонажей", async () => {
    vi.mocked(requireProtectedAccountContext).mockResolvedValue({
      user: {
        id: "user-1",
        email: "user@example.com",
      },
      account: {
        id: "00000000-0000-0000-0000-000000000001",
        email: "user@example.com",
        login: "tester",
        pendingEmail: null,
        pendingEmailRequestedAt: null,
        isSuperAdmin: false,
        mustChangePassword: false,
        mustChangePasswordReason: null,
        passwordChangedAt: null,
        createdAt: new Date("2026-04-21T10:00:00.000Z"),
        updatedAt: new Date("2026-04-21T10:00:00.000Z"),
      },
    });
    vi.mocked(getServers).mockResolvedValue([
      {
        id: "server-1",
        code: "blackberry",
        name: "Blackberry",
        isActive: true,
        sortOrder: 1,
        createdAt: new Date("2026-04-21T10:00:00.000Z"),
        updatedAt: new Date("2026-04-21T10:00:00.000Z"),
      },
    ]);
    vi.mocked(getServerByCode).mockResolvedValue({
      id: "server-1",
      code: "blackberry",
      name: "Blackberry",
      isActive: true,
      sortOrder: 1,
      createdAt: new Date("2026-04-21T10:00:00.000Z"),
      updatedAt: new Date("2026-04-21T10:00:00.000Z"),
    });
    vi.mocked(getUserServerStates).mockResolvedValue([]);
    vi.mocked(getCharactersByServer).mockResolvedValue([]);

    const result = await getServerDocumentsRouteContext({
      serverSlug: "blackberry",
      nextPath: "/servers/blackberry/documents",
    });

    expect(result.status).toBe("no_characters");
    expect(buildCharactersBridgePath()).toBe("/app");
  });
});
