import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db/repositories/character.repository", () => ({
  countCharactersByServer: vi.fn(),
}));

vi.mock("@/db/repositories/server.repository", () => ({
  listServerDirectoryServers: vi.fn(),
}));

vi.mock("@/server/auth/account", () => ({
  syncAccountFromSupabaseUser: vi.fn(),
}));

vi.mock("@/server/auth/helpers", () => ({
  getCurrentUser: vi.fn(),
}));

import { countCharactersByServer } from "@/db/repositories/character.repository";
import { listServerDirectoryServers } from "@/db/repositories/server.repository";
import { syncAccountFromSupabaseUser } from "@/server/auth/account";
import { getCurrentUser } from "@/server/auth/helpers";
import { getPublicServerDirectoryContext, resolveAssistantStatus } from "@/server/server-directory/context";

describe("public server directory context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("для гостя помечает documents как requires_auth и не считает персонажей", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    vi.mocked(listServerDirectoryServers).mockResolvedValue([
      {
        id: "server-1",
        code: "blackberry",
        name: "Blackberry",
        isActive: true,
        sortOrder: 1,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        laws: [],
      },
    ]);

    const result = await getPublicServerDirectoryContext();

    expect(result.viewer).toEqual({
      isAuthenticated: false,
      accountId: null,
    });
    expect(result.servers).toEqual([
      {
        id: "server-1",
        code: "blackberry",
        slug: "blackberry",
        name: "Blackberry",
        directoryAvailability: "active",
        assistantStatus: "no_corpus",
        documentsAvailabilityForViewer: "requires_auth",
        availableModules: ["assistant", "documents"],
      },
    ]);
    expect(syncAccountFromSupabaseUser).not.toHaveBeenCalled();
    expect(countCharactersByServer).not.toHaveBeenCalled();
  });

  it("для авторизованного viewer различает available и needs_character и не зависит от shell state", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "account-1",
      email: "user@example.com",
    });
    vi.mocked(syncAccountFromSupabaseUser).mockResolvedValue({
      id: "account-1",
      email: "user@example.com",
      login: "tester",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      pendingEmail: null,
      pendingEmailRequestedAt: null,
      mustChangePassword: false,
      mustChangePasswordReason: null,
      passwordChangedAt: null,
      isSuperAdmin: false,
    });
    vi.mocked(listServerDirectoryServers).mockResolvedValue([
      {
        id: "server-1",
        code: "blackberry",
        name: "Blackberry",
        isActive: true,
        sortOrder: 1,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
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
      },
      {
        id: "server-2",
        code: "alta",
        name: "Alta",
        isActive: true,
        sortOrder: 2,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        laws: [
          {
            lawKind: "primary",
            isExcluded: false,
            classificationOverride: null,
            currentVersionId: null,
            _count: {
              versions: 1,
            },
          },
        ],
      },
    ]);
    vi.mocked(countCharactersByServer)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);

    const result = await getPublicServerDirectoryContext();

    expect(result.viewer).toEqual({
      isAuthenticated: true,
      accountId: "account-1",
    });
    expect(result.servers).toEqual([
      {
        id: "server-1",
        code: "blackberry",
        slug: "blackberry",
        name: "Blackberry",
        directoryAvailability: "active",
        assistantStatus: "current_corpus_ready",
        documentsAvailabilityForViewer: "available",
        availableModules: ["assistant", "documents"],
      },
      {
        id: "server-2",
        code: "alta",
        slug: "alta",
        name: "Alta",
        directoryAvailability: "active",
        assistantStatus: "corpus_bootstrap_incomplete",
        documentsAvailabilityForViewer: "needs_character",
        availableModules: ["assistant", "documents"],
      },
    ]);
    expect(countCharactersByServer).toHaveBeenNthCalledWith(1, {
      accountId: "account-1",
      serverId: "server-1",
    });
    expect(countCharactersByServer).toHaveBeenNthCalledWith(2, {
      accountId: "account-1",
      serverId: "server-2",
    });
  });

  it("оставляет недоступный сервер видимым в directory", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "account-1",
      email: "user@example.com",
    });
    vi.mocked(syncAccountFromSupabaseUser).mockResolvedValue({
      id: "account-1",
      email: "user@example.com",
      login: "tester",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      pendingEmail: null,
      pendingEmailRequestedAt: null,
      mustChangePassword: false,
      mustChangePasswordReason: null,
      passwordChangedAt: null,
      isSuperAdmin: false,
    });
    vi.mocked(listServerDirectoryServers).mockResolvedValue([
      {
        id: "server-3",
        code: "legacy",
        name: "Legacy",
        isActive: false,
        sortOrder: 3,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
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
      },
    ]);

    const result = await getPublicServerDirectoryContext();

    expect(result.servers).toEqual([
      {
        id: "server-3",
        code: "legacy",
        slug: "legacy",
        name: "Legacy",
        directoryAvailability: "unavailable",
        assistantStatus: "assistant_disabled",
        documentsAvailabilityForViewer: "unavailable",
        availableModules: ["assistant", "documents"],
      },
    ]);
    expect(countCharactersByServer).not.toHaveBeenCalled();
  });

  it("assistant status helper маппит partial corpus в limited state", () => {
    expect(
      resolveAssistantStatus({
        isActive: true,
        laws: [
          {
            lawKind: "primary",
            isExcluded: false,
            classificationOverride: null,
            currentVersionId: null,
            _count: {
              versions: 1,
            },
          },
        ],
      }),
    ).toBe("corpus_bootstrap_incomplete");
  });
});
