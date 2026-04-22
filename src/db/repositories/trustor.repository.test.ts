import { describe, expect, it, vi } from "vitest";

import { listTrustorsForAccount } from "@/db/repositories/trustor.repository";

describe("trustor.repository", () => {
  it("возвращает только soft-delete-safe записи текущего account", async () => {
    const db = {
      trustor: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    await listTrustorsForAccount("account-1", db as never);

    expect(db.trustor.findMany).toHaveBeenCalledWith({
      where: {
        accountId: "account-1",
        deletedAt: null,
      },
      include: {
        server: true,
      },
      orderBy: [{ serverId: "asc" }, { createdAt: "asc" }],
    });
  });
});
