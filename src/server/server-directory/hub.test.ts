import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db/repositories/character.repository", () => ({
  getCharactersByServer: vi.fn(),
}));

vi.mock("@/db/repositories/server.repository", () => ({
  getServerDirectoryServerByCode: vi.fn(),
}));

vi.mock("@/db/repositories/user-server-state.repository", () => ({
  getUserServerStates: vi.fn(),
}));

vi.mock("@/server/auth/protected", () => ({
  requireProtectedAccountContext: vi.fn(),
}));

import { getCharactersByServer } from "@/db/repositories/character.repository";
import { getServerDirectoryServerByCode } from "@/db/repositories/server.repository";
import { getUserServerStates } from "@/db/repositories/user-server-state.repository";
import { requireProtectedAccountContext } from "@/server/auth/protected";
import { getProtectedServerHubContext } from "@/server/server-directory/hub";

describe("server hub context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("требует auth и передаёт корректный nextPath", async () => {
    const redirectError = new Error("redirect");
    vi.mocked(requireProtectedAccountContext).mockRejectedValue(redirectError);

    await expect(
      getProtectedServerHubContext({
        serverSlug: "blackberry",
        nextPath: "/servers/blackberry",
      }),
    ).rejects.toBe(redirectError);

    expect(requireProtectedAccountContext).toHaveBeenCalledWith(
      "/servers/blackberry",
      undefined,
      {
        allowMustChangePassword: true,
      },
    );
  });

  it("возвращает honest server_not_found для неизвестного serverSlug", async () => {
    vi.mocked(requireProtectedAccountContext).mockResolvedValue({
      user: {
        id: "user-1",
        email: "user@example.com",
      },
      account: {
        id: "account-1",
        email: "user@example.com",
        login: "tester",
        isSuperAdmin: false,
        mustChangePassword: false,
      },
    } as never);
    vi.mocked(getServerDirectoryServerByCode).mockResolvedValue(null);

    const result = await getProtectedServerHubContext({
      serverSlug: "unknown",
      nextPath: "/servers/unknown",
    });

    expect(result).toEqual({
      status: "server_not_found",
      viewer: {
        accountId: "account-1",
        email: "user@example.com",
        login: "tester",
      },
      requestedServerSlug: "unknown",
    });
  });

  it("возвращает honest server_unavailable для неактивного сервера", async () => {
    vi.mocked(requireProtectedAccountContext).mockResolvedValue({
      user: {
        id: "user-1",
        email: "user@example.com",
      },
      account: {
        id: "account-1",
        email: "user@example.com",
        login: "tester",
        isSuperAdmin: false,
        mustChangePassword: false,
      },
    } as never);
    vi.mocked(getServerDirectoryServerByCode).mockResolvedValue({
      id: "server-1",
      code: "legacy",
      name: "Legacy",
      isActive: false,
      laws: [],
    } as never);

    const result = await getProtectedServerHubContext({
      serverSlug: "legacy",
      nextPath: "/servers/legacy",
    });

    expect(result).toEqual({
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
    expect(getCharactersByServer).not.toHaveBeenCalled();
  });

  it("использует только serverSlug и не зависит от active shell server", async () => {
    vi.mocked(requireProtectedAccountContext).mockResolvedValue({
      user: {
        id: "user-1",
        email: "user@example.com",
      },
      account: {
        id: "account-1",
        email: "user@example.com",
        login: "tester",
        isSuperAdmin: false,
        mustChangePassword: false,
      },
    } as never);
    vi.mocked(getServerDirectoryServerByCode).mockResolvedValue({
      id: "server-1",
      code: "blackberry",
      name: "Blackberry",
      isActive: true,
      laws: [
        {
          lawKind: "primary",
          isExcluded: false,
          classificationOverride: null,
          currentVersionId: "version-1",
          _count: {
            versions: 1,
          },
        },
      ],
    } as never);
    vi.mocked(getCharactersByServer).mockResolvedValue([
      {
        id: "character-1",
        serverId: "server-1",
        fullName: "Игорь Юристов",
        passportNumber: "AA-001",
      },
    ] as never);
    vi.mocked(getUserServerStates).mockResolvedValue([
      {
        serverId: "other-server",
        activeCharacterId: "foreign-character",
        lastSelectedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ] as never);

    const result = await getProtectedServerHubContext({
      serverSlug: "blackberry",
      nextPath: "/servers/blackberry",
    });

    expect(result).toEqual({
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
      selectedCharacterSummary: {
        id: "character-1",
        fullName: "Игорь Юристов",
        passportNumber: "AA-001",
        source: "first_available",
      },
    });
  });

  it("не ломается без персонажей и честно возвращает needs_character", async () => {
    vi.mocked(requireProtectedAccountContext).mockResolvedValue({
      user: {
        id: "user-1",
        email: "user@example.com",
      },
      account: {
        id: "account-1",
        email: "user@example.com",
        login: "tester",
        isSuperAdmin: false,
        mustChangePassword: false,
      },
    } as never);
    vi.mocked(getServerDirectoryServerByCode).mockResolvedValue({
      id: "server-1",
      code: "blackberry",
      name: "Blackberry",
      isActive: true,
      laws: [],
    } as never);
    vi.mocked(getCharactersByServer).mockResolvedValue([]);
    vi.mocked(getUserServerStates).mockResolvedValue([]);

    const result = await getProtectedServerHubContext({
      serverSlug: "blackberry",
      nextPath: "/servers/blackberry",
    });

    expect(result).toEqual({
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
      assistantStatus: "no_corpus",
      documentsAvailabilityForViewer: "needs_character",
      selectedCharacterSummary: null,
    });
  });
});
