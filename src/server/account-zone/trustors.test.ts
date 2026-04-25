import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/auth/protected", () => ({
  requireProtectedAccountContext: vi.fn(),
}));

vi.mock("@/db/repositories/server.repository", () => ({
  getServers: vi.fn(),
}));

vi.mock("@/db/repositories/trustor.repository", () => ({
  listTrustorsForAccount: vi.fn(),
}));

vi.mock("@/db/repositories/document.repository", () => ({
  listAttorneyRequestDocumentsByAccount: vi.fn(),
}));

import { listTrustorsForAccount } from "@/db/repositories/trustor.repository";
import { listAttorneyRequestDocumentsByAccount } from "@/db/repositories/document.repository";
import { getServers } from "@/db/repositories/server.repository";
import { requireProtectedAccountContext } from "@/server/auth/protected";
import { getAccountTrustorsOverviewContext } from "@/server/account-zone/trustors";

describe("account-zone trustors", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(requireProtectedAccountContext).mockResolvedValue({
      account: {
        id: "account-1",
        email: "user@example.com",
        login: "tester",
      },
    } as never);
  });

  it("логирует и пробрасывает ошибку, если не загружаются обязательные trustor data", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    vi.mocked(getServers).mockRejectedValue(new Error("server query failed"));
    vi.mocked(listTrustorsForAccount).mockResolvedValue([] as never);

    await expect(
      getAccountTrustorsOverviewContext({
        nextPath: "/account/trustors",
      }),
    ).rejects.toThrow("server query failed");

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "ACCOUNT_TRUSTORS_REQUIRED_DATA_LOAD_FAILED",
      expect.objectContaining({
        accountId: "account-1",
        message: "server query failed",
      }),
    );

    consoleErrorSpy.mockRestore();
  });

  it("строит grouped-by-server overview с focus route и честными empty states", async () => {
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
    vi.mocked(listTrustorsForAccount).mockResolvedValue([
      {
        id: "trustor-1",
        accountId: "account-1",
        serverId: "server-1",
        fullName: "Иван Доверителев",
        passportNumber: "001",
        phone: "123-45-67",
        icEmail: "trustor@example.com",
        passportImageUrl: "https://example.com/trustor-passport.png",
        note: "Проверенный представитель",
      },
      {
        id: "trustor-2",
        accountId: "account-1",
        serverId: "server-1",
        fullName: "   ",
        passportNumber: "   ",
        phone: null,
        icEmail: null,
        passportImageUrl: null,
        note: null,
      },
    ] as never);
    vi.mocked(listAttorneyRequestDocumentsByAccount).mockResolvedValue([] as never);

    const result = await getAccountTrustorsOverviewContext({
      nextPath: "/account/trustors",
      focusedServerCode: "blackberry",
    });

    expect(requireProtectedAccountContext).toHaveBeenCalledWith(
      "/account/trustors",
      undefined,
      {
        allowMustChangePassword: true,
      },
    );
    expect(listTrustorsForAccount).toHaveBeenCalledWith("account-1");
    expect(result.focusedServerCode).toBe("blackberry");
    expect(result.serverGroups[0]?.server.code).toBe("blackberry");
    expect(result.serverGroups[0]?.isFocused).toBe(true);
    expect(result.serverGroups[0]?.focusHref).toBe("/account/trustors?server=blackberry");
    expect(result.serverGroups[0]?.createBridgeHref).toBe(
      "/account/trustors?server=blackberry#create-trustor-blackberry",
    );
    expect(result.serverGroups[0]?.trustorCount).toBe(2);
    expect(result.serverGroups[0]?.trustors[0]?.isRepresentativeReady).toBe(true);
    expect(result.serverGroups[0]?.trustors[1]?.isRepresentativeReady).toBe(false);
    expect(result.serverGroups[1]?.server.code).toBe("rainbow");
    expect(result.serverGroups[1]?.trustorCount).toBe(0);
  });

  it("не падает, если ancillary-загрузка адвокатских запросов временно недоступна", async () => {
    vi.mocked(getServers).mockResolvedValue([
      {
        id: "server-1",
        code: "blackberry",
        name: "Blackberry",
      },
    ] as never);
    vi.mocked(listTrustorsForAccount).mockResolvedValue([
      {
        id: "trustor-1",
        accountId: "account-1",
        serverId: "server-1",
        fullName: "Иван Доверителев",
        passportNumber: "001",
        phone: "123-45-67",
        icEmail: "trustor@example.com",
        passportImageUrl: null,
        note: null,
      },
    ] as never);
    vi.mocked(listAttorneyRequestDocumentsByAccount).mockRejectedValue(
      new Error("temporary document query failure"),
    );

    const result = await getAccountTrustorsOverviewContext({
      nextPath: "/account/trustors",
    });

    expect(result.serverGroups[0]?.trustors[0]?.attorneyRequests).toEqual([]);
  });
});
