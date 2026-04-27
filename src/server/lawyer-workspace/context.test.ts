import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db/repositories/character.repository", () => ({
  getCharactersByServer: vi.fn(),
}));

vi.mock("@/db/repositories/server.repository", () => ({
  getServerByCode: vi.fn(),
}));

vi.mock("@/db/repositories/trustor.repository", () => ({
  listTrustorsForAccountAndServer: vi.fn(),
}));

vi.mock("@/db/repositories/user-server-state.repository", () => ({
  getUserServerStates: vi.fn(),
}));

vi.mock("@/server/auth/protected", () => ({
  requireProtectedAccountContext: vi.fn(),
}));

import { getCharactersByServer } from "@/db/repositories/character.repository";
import { getServerByCode } from "@/db/repositories/server.repository";
import { listTrustorsForAccountAndServer } from "@/db/repositories/trustor.repository";
import { getUserServerStates } from "@/db/repositories/user-server-state.repository";
import { requireProtectedAccountContext } from "@/server/auth/protected";
import { getLawyerWorkspaceRouteContext } from "@/server/lawyer-workspace/context";

describe("lawyer workspace context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    vi.mocked(getServerByCode).mockResolvedValue({
      id: "server-1",
      code: "blackberry",
      name: "Blackberry",
    } as never);
    vi.mocked(getUserServerStates).mockResolvedValue([]);
    vi.mocked(listTrustorsForAccountAndServer).mockResolvedValue([]);
  });

  it("возвращает server_not_found для неизвестного serverSlug", async () => {
    vi.mocked(getServerByCode).mockResolvedValue(null);

    const result = await getLawyerWorkspaceRouteContext({
      serverSlug: "unknown",
      nextPath: "/servers/unknown/lawyer",
    });

    expect(result).toEqual({
      status: "server_not_found",
      account: {
        id: "account-1",
        email: "user@example.com",
        login: "tester",
        isSuperAdmin: false,
        mustChangePassword: false,
      },
      requestedServerSlug: "unknown",
    });
  });

  it("возвращает no_characters без персонажей на сервере", async () => {
    vi.mocked(getCharactersByServer).mockResolvedValue([]);

    const result = await getLawyerWorkspaceRouteContext({
      serverSlug: "blackberry",
      nextPath: "/servers/blackberry/lawyer",
    });

    expect(result.status).toBe("no_characters");
    expect(result).toMatchObject({
      server: {
        code: "blackberry",
        slug: "blackberry",
      },
      trustorCount: 0,
      compatibilityHrefs: {
        trustorsHref: "/account/trustors?server=blackberry",
        charactersHref: "/account/characters?server=blackberry",
      },
    });
  });

  it("возвращает no_advocate_access, если выбранный персонаж не имеет адвокатского доступа", async () => {
    vi.mocked(getCharactersByServer).mockResolvedValue([
      {
        id: "character-1",
        serverId: "server-1",
        fullName: "Игорь Юристов",
        passportNumber: "AA-001",
        accessFlags: [],
        roles: [],
      },
    ] as never);

    const result = await getLawyerWorkspaceRouteContext({
      serverSlug: "blackberry",
      nextPath: "/servers/blackberry/lawyer",
    });

    expect(result.status).toBe("no_advocate_access");
    if (result.status !== "no_advocate_access") {
      throw new Error("Expected no_advocate_access status");
    }
    expect(result.workspaceCapabilities.blockReasons).toContain("advocate_character_required");
    expect(result.workspaceCapabilities.blockReasons).toContain("access_request_required");
  });

  it("возвращает ready и compatibility hrefs для адвокатского персонажа", async () => {
    vi.mocked(getCharactersByServer).mockResolvedValue([
      {
        id: "character-1",
        serverId: "server-1",
        fullName: "Игорь Юристов",
        passportNumber: "AA-001",
        accessFlags: [{ flagKey: "advocate" }],
        roles: [{ roleKey: "lawyer" }],
      },
    ] as never);
    vi.mocked(listTrustorsForAccountAndServer).mockResolvedValue([
      {
        id: "trustor-1",
      },
    ] as never);

    const result = await getLawyerWorkspaceRouteContext({
      serverSlug: "blackberry",
      nextPath: "/servers/blackberry/lawyer",
    });

    expect(result.status).toBe("ready");
    if (result.status !== "ready") {
      throw new Error("Expected ready status");
    }
    expect(result.selectedCharacter).toMatchObject({
      fullName: "Игорь Юристов",
    });
    expect(result.documentEntryCapabilities.canCreateAttorneyRequest).toBe(true);
    expect(result.documentEntryCapabilities.canCreateLegalServicesAgreement).toBe(true);
    expect(result.compatibilityHrefs.attorneyRequestsHref).toBe(
      "/servers/blackberry/documents/attorney-requests",
    );
    expect(result.compatibilityHrefs.agreementCreateHref).toBe(
      "/servers/blackberry/documents/legal-services-agreements/new",
    );
  });
});
