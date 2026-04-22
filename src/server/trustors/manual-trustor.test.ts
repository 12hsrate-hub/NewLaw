import { describe, expect, it, vi } from "vitest";

import {
  createTrustorManually,
  softDeleteTrustorManually,
  TrustorNotFoundError,
  updateTrustorManually,
} from "@/server/trustors/manual-trustor";

function createRepositoryMock() {
  return {
    getTrustorByIdForAccount: vi.fn(),
    createTrustorRecord: vi.fn(),
    updateTrustorRecord: vi.fn(),
    softDeleteTrustorRecord: vi.fn(),
  };
}

describe("createTrustorManually", () => {
  it("создаёт trustor card с нормализацией identity fields и optional metadata", async () => {
    const repository = createRepositoryMock();

    repository.createTrustorRecord.mockResolvedValue({
      id: "trustor-1",
    });

    await createTrustorManually(
      {
        accountId: "21631886-7b4d-4be2-b6e9-95322d0dca41",
        serverId: "server-1",
        fullName: "  иван   доверителев ",
        passportNumber: " aa-001 ",
        phone: "  +7 900 000-00-00 ",
        note: "  Проверенный представитель  ",
      },
      repository,
    );

    expect(repository.createTrustorRecord).toHaveBeenCalledWith({
      accountId: "21631886-7b4d-4be2-b6e9-95322d0dca41",
      serverId: "server-1",
      fullName: "Иван Доверителев",
      passportNumber: "AA-001",
      phone: "+7 900 000-00-00",
      note: "Проверенный представитель",
    });
  });

  it("не создаёт полностью пустую trustor card", async () => {
    const repository = createRepositoryMock();

    await expect(
      createTrustorManually(
        {
          accountId: "21631886-7b4d-4be2-b6e9-95322d0dca41",
          serverId: "server-1",
          fullName: "   ",
          passportNumber: "   ",
          phone: "   ",
          note: "   ",
        },
        repository,
      ),
    ).rejects.toThrow();

    expect(repository.createTrustorRecord).not.toHaveBeenCalled();
  });
});

describe("updateTrustorManually", () => {
  it("обновляет trustor только внутри owner account и server group", async () => {
    const repository = createRepositoryMock();

    repository.getTrustorByIdForAccount.mockResolvedValue({
      id: "trustor-1",
      serverId: "server-1",
    });

    await updateTrustorManually(
      {
        accountId: "21631886-7b4d-4be2-b6e9-95322d0dca41",
        serverId: "server-1",
        trustorId: "trustor-1",
        fullName: "  пётр представителев ",
        passportNumber: " bb-002 ",
        phone: "",
        note: "  Обновлённая карточка  ",
      },
      repository,
    );

    expect(repository.updateTrustorRecord).toHaveBeenCalledWith({
      trustorId: "trustor-1",
      fullName: "Пётр Представителев",
      passportNumber: "BB-002",
      phone: null,
      note: "Обновлённая карточка",
    });
  });

  it("не обновляет отсутствующую или чужую trustor card", async () => {
    const repository = createRepositoryMock();

    repository.getTrustorByIdForAccount.mockResolvedValue(null);

    await expect(
      updateTrustorManually(
        {
          accountId: "21631886-7b4d-4be2-b6e9-95322d0dca41",
          serverId: "server-1",
          trustorId: "missing-trustor",
          fullName: "Иван",
          passportNumber: "AA-001",
          phone: "",
          note: "",
        },
        repository,
      ),
    ).rejects.toBeInstanceOf(TrustorNotFoundError);
  });
});

describe("softDeleteTrustorManually", () => {
  it("делает safe soft delete только для owner-owned trustor", async () => {
    const repository = createRepositoryMock();

    repository.getTrustorByIdForAccount.mockResolvedValue({
      id: "trustor-1",
      serverId: "server-1",
    });
    repository.softDeleteTrustorRecord.mockResolvedValue(undefined);

    await softDeleteTrustorManually(
      {
        accountId: "21631886-7b4d-4be2-b6e9-95322d0dca41",
        trustorId: "trustor-1",
      },
      repository,
    );

    expect(repository.softDeleteTrustorRecord).toHaveBeenCalledWith({
      trustorId: "trustor-1",
    });
  });

  it("не удаляет trustor card, если она не принадлежит owner account", async () => {
    const repository = createRepositoryMock();

    repository.getTrustorByIdForAccount.mockResolvedValue(null);

    await expect(
      softDeleteTrustorManually(
        {
          accountId: "21631886-7b4d-4be2-b6e9-95322d0dca41",
          trustorId: "missing-trustor",
        },
        repository,
      ),
    ).rejects.toBeInstanceOf(TrustorNotFoundError);
  });
});
