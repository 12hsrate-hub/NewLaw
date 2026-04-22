import { describe, expect, it, vi } from "vitest";

import {
  createTrustorRecord,
  getTrustorByIdForAccount,
  listTrustorsForAccount,
  softDeleteTrustorRecord,
  updateTrustorRecord,
} from "@/db/repositories/trustor.repository";

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

  it("ищет trustor только внутри текущего account и без deletedAt", async () => {
    const db = {
      trustor: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };

    await getTrustorByIdForAccount(
      {
        accountId: "account-1",
        trustorId: "trustor-1",
      },
      db as never,
    );

    expect(db.trustor.findFirst).toHaveBeenCalledWith({
      where: {
        id: "trustor-1",
        accountId: "account-1",
        deletedAt: null,
      },
    });
  });

  it("создаёт trustor record c nullable phone/note", async () => {
    const db = {
      trustor: {
        create: vi.fn().mockResolvedValue({ id: "trustor-1" }),
      },
    };

    await createTrustorRecord(
      {
        accountId: "account-1",
        serverId: "server-1",
        fullName: "Иван Доверителев",
        passportNumber: "AA-001",
        phone: null,
        note: "Проверенный представитель",
      },
      db as never,
    );

    expect(db.trustor.create).toHaveBeenCalledWith({
      data: {
        accountId: "account-1",
        serverId: "server-1",
        fullName: "Иван Доверителев",
        passportNumber: "AA-001",
        phone: null,
        note: "Проверенный представитель",
      },
    });
  });

  it("обновляет trustor record и делает soft delete через deletedAt", async () => {
    const db = {
      trustor: {
        update: vi.fn().mockResolvedValue({ id: "trustor-1" }),
      },
    };

    await updateTrustorRecord(
      {
        trustorId: "trustor-1",
        fullName: "Пётр Представителев",
        passportNumber: "BB-002",
        phone: "+7 999 000-00-00",
        note: null,
      },
      db as never,
    );

    expect(db.trustor.update).toHaveBeenNthCalledWith(1, {
      where: {
        id: "trustor-1",
      },
      data: {
        fullName: "Пётр Представителев",
        passportNumber: "BB-002",
        phone: "+7 999 000-00-00",
        note: null,
      },
    });

    await softDeleteTrustorRecord(
      {
        trustorId: "trustor-1",
      },
      db as never,
    );

    expect(db.trustor.update).toHaveBeenNthCalledWith(2, {
      where: {
        id: "trustor-1",
      },
      data: {
        deletedAt: expect.any(Date),
      },
    });
  });
});
