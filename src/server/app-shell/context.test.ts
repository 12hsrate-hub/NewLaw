import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/auth/protected", () => ({
  requireProtectedAccountContext: vi.fn(),
}));

vi.mock("@/db/repositories/server.repository", () => ({
  getServers: vi.fn(),
}));

vi.mock("@/db/repositories/user-server-state.repository", () => ({
  getUserServerStates: vi.fn(),
}));

vi.mock("@/db/repositories/character.repository", () => ({
  getCharactersByServer: vi.fn(),
}));

import { getCharactersByServer } from "@/db/repositories/character.repository";
import { getServers } from "@/db/repositories/server.repository";
import { getUserServerStates } from "@/db/repositories/user-server-state.repository";
import { getAppShellContext } from "@/server/app-shell/context";
import { requireProtectedAccountContext } from "@/server/auth/protected";

describe("app shell context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireProtectedAccountContext).mockResolvedValue({
      user: {
        id: "1b8b1ea8-a6fd-4b6e-9447-fac7da607925",
        email: "user@example.com",
      },
      account: {
        id: "1b8b1ea8-a6fd-4b6e-9447-fac7da607925",
        email: "user@example.com",
        login: "user_login",
        mustChangePassword: false,
        isSuperAdmin: false,
      },
    } as never);
  });

  it("собирает SSR shell context по сохранённому state", async () => {
    vi.mocked(getServers).mockResolvedValue([
      { id: "server-1", name: "Downtown", isActive: true, sortOrder: 1 },
      { id: "server-2", name: "La Mesa", isActive: true, sortOrder: 2 },
    ] as never);
    vi.mocked(getUserServerStates).mockResolvedValue([
      {
        serverId: "server-2",
        activeCharacterId: "character-2",
        lastSelectedAt: new Date("2026-04-20T10:00:00.000Z"),
      },
    ] as never);
    vi.mocked(getCharactersByServer).mockResolvedValue([
      {
        id: "character-2",
        serverId: "server-2",
        fullName: "John Doe",
        passportNumber: "A-002",
      },
    ] as never);

    const result = await getAppShellContext("/app");

    expect(result.activeServer?.id).toBe("server-2");
    expect(result.activeCharacter?.id).toBe("character-2");
    expect(result.currentPath).toBe("/app");
    expect(getCharactersByServer).toHaveBeenCalledWith({
      accountId: "1b8b1ea8-a6fd-4b6e-9447-fac7da607925",
      serverId: "server-2",
    });
  });

  it("использует безопасный fallback при отсутствии UserServerState", async () => {
    vi.mocked(getServers).mockResolvedValue([
      { id: "server-1", name: "Downtown", isActive: true, sortOrder: 1 },
    ] as never);
    vi.mocked(getUserServerStates).mockResolvedValue([] as never);
    vi.mocked(getCharactersByServer).mockResolvedValue([
      {
        id: "character-1",
        serverId: "server-1",
        fullName: "Alice Stone",
        passportNumber: "A-001",
      },
      {
        id: "character-2",
        serverId: "server-1",
        fullName: "Bob Stone",
        passportNumber: "A-002",
      },
    ] as never);

    const result = await getAppShellContext("/app");

    expect(result.activeServer?.id).toBe("server-1");
    expect(result.activeCharacter?.id).toBe("character-1");
  });

  it("мягко восстанавливается при битом state сервера или персонажа", async () => {
    vi.mocked(getServers).mockResolvedValue([
      { id: "server-1", name: "Downtown", isActive: true, sortOrder: 1 },
    ] as never);
    vi.mocked(getUserServerStates).mockResolvedValue([
      {
        serverId: "missing-server",
        activeCharacterId: "missing-character",
        lastSelectedAt: new Date("2026-04-20T10:00:00.000Z"),
      },
    ] as never);
    vi.mocked(getCharactersByServer).mockResolvedValue([
      {
        id: "character-1",
        serverId: "server-1",
        fullName: "Alice Stone",
        passportNumber: "A-001",
      },
    ] as never);

    const result = await getAppShellContext("/app");

    expect(result.activeServer?.id).toBe("server-1");
    expect(result.activeCharacter?.id).toBe("character-1");
  });

  it("возвращает empty state данные, если активных серверов нет", async () => {
    vi.mocked(getServers).mockResolvedValue([] as never);
    vi.mocked(getUserServerStates).mockResolvedValue([] as never);

    const result = await getAppShellContext("/app");

    expect(result.activeServer).toBeNull();
    expect(result.activeCharacter).toBeNull();
    expect(result.characters).toEqual([]);
    expect(getCharactersByServer).not.toHaveBeenCalled();
  });
});
