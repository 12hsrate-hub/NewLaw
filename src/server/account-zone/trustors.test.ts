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

import { listTrustorsForAccount } from "@/db/repositories/trustor.repository";
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
        passportNumber: "AA-001",
        phone: "+7 900 000-00-00",
        note: "Проверенный представитель",
      },
      {
        id: "trustor-2",
        accountId: "account-1",
        serverId: "server-1",
        fullName: "   ",
        passportNumber: "   ",
        phone: null,
        note: null,
      },
    ] as never);

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
});
