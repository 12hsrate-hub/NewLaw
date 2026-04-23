import { describe, expect, it, vi } from "vitest";

import {
  CharacterLimitExceededError,
  CharacterNotFoundError,
  CharacterPassportConflictError,
  MAX_CHARACTERS_PER_SERVER,
  createCharacterManually,
  updateCharacterManually,
} from "@/server/characters/manual-character";

function createRepositoryMock() {
  return {
    countCharactersByServer: vi.fn(),
    findCharacterByPassport: vi.fn(),
    getCharacterByIdForAccount: vi.fn(),
    createCharacterRecord: vi.fn(),
    updateCharacterRecord: vi.fn(),
  };
}

describe("createCharacterManually", () => {
  it("блокирует создание четвертого персонажа на сервере", async () => {
    const repository = createRepositoryMock();

    repository.countCharactersByServer.mockResolvedValue(MAX_CHARACTERS_PER_SERVER);

    await expect(
      createCharacterManually(
        {
        accountId: "21631886-7b4d-4be2-b6e9-95322d0dca41",
        serverId: "server-1",
        fullName: "ivan ivanov",
        nickname: "",
        passportNumber: "pass-1",
          roleKeys: ["citizen"],
          accessFlags: [],
          isProfileComplete: false,
          profileDataJson: null,
        },
        repository,
      ),
    ).rejects.toBeInstanceOf(CharacterLimitExceededError);
  });

  it("блокирует дублирование паспорта внутри аккаунта и сервера", async () => {
    const repository = createRepositoryMock();

    repository.countCharactersByServer.mockResolvedValue(2);
    repository.findCharacterByPassport.mockResolvedValue({
      id: "character-1",
    });

    await expect(
      createCharacterManually(
        {
        accountId: "21631886-7b4d-4be2-b6e9-95322d0dca41",
        serverId: "server-1",
        fullName: "ivan ivanov",
        nickname: "",
        passportNumber: "pass-1",
          roleKeys: ["citizen"],
          accessFlags: [],
          isProfileComplete: false,
          profileDataJson: null,
        },
        repository,
      ),
    ).rejects.toBeInstanceOf(CharacterPassportConflictError);
  });

  it("создает персонажа вручную с отдельным nickname, если он передан явно", async () => {
    const repository = createRepositoryMock();

    repository.countCharactersByServer.mockResolvedValue(1);
    repository.findCharacterByPassport.mockResolvedValue(null);
    repository.createCharacterRecord.mockResolvedValue({
      id: "character-1",
      fullName: "Ivan Ivanov",
      nickname: "ivan.ivanov",
      passportNumber: "PASS-1",
    });

    const created = await createCharacterManually(
      {
        accountId: "21631886-7b4d-4be2-b6e9-95322d0dca41",
        serverId: "server-1",
        fullName: "ivan ivanov",
        nickname: "ivan.ivanov",
        passportNumber: "pass-1",
        roleKeys: ["citizen", "citizen"],
        accessFlags: ["tester", "tester"],
        isProfileComplete: true,
        profileDataJson: {
          signature: "И. Иванов",
          note: "Полный профиль",
        },
      },
      repository,
    );

    expect(created.fullName).toBe("Ivan Ivanov");
    expect(repository.createCharacterRecord).toHaveBeenCalledWith({
      accountId: "21631886-7b4d-4be2-b6e9-95322d0dca41",
      serverId: "server-1",
      fullName: "Ivan Ivanov",
      nickname: "ivan.ivanov",
      passportNumber: "1",
      isProfileComplete: true,
      profileDataJson: {
        signature: "И. Иванов",
        note: "Полный профиль",
      },
      roleKeys: ["citizen"],
      accessFlags: ["tester"],
    });
  });

  it("разрешает создание персонажа с пустыми roles и access flags", async () => {
    const repository = createRepositoryMock();

    repository.countCharactersByServer.mockResolvedValue(0);
    repository.findCharacterByPassport.mockResolvedValue(null);
    repository.createCharacterRecord.mockResolvedValue({
      id: "character-empty",
      fullName: "Ivan Ivanov",
      nickname: "Ivan Ivanov",
      passportNumber: "PASS-77",
    });

    await createCharacterManually(
      {
        accountId: "21631886-7b4d-4be2-b6e9-95322d0dca41",
        serverId: "server-1",
        fullName: "ivan ivanov",
        nickname: "",
        passportNumber: "pass-77",
        roleKeys: [],
        accessFlags: [],
        isProfileComplete: false,
        profileDataJson: null,
      },
      repository,
    );

    expect(repository.createCharacterRecord).toHaveBeenCalledWith({
      accountId: "21631886-7b4d-4be2-b6e9-95322d0dca41",
      serverId: "server-1",
      fullName: "Ivan Ivanov",
      nickname: "Ivan Ivanov",
      passportNumber: "77",
      isProfileComplete: false,
      profileDataJson: null,
      roleKeys: [],
      accessFlags: [],
    });
  });

  it("fallback-ит nickname к normalized fullName, если nickname не передан", async () => {
    const repository = createRepositoryMock();

    repository.countCharactersByServer.mockResolvedValue(0);
    repository.findCharacterByPassport.mockResolvedValue(null);
    repository.createCharacterRecord.mockResolvedValue({
      id: "character-fallback",
      fullName: "Ivan Smirnov",
      nickname: "Ivan Smirnov",
      passportNumber: "PASS-88",
    });

    await createCharacterManually(
      {
        accountId: "21631886-7b4d-4be2-b6e9-95322d0dca41",
        serverId: "server-1",
        fullName: "ivan smirnov",
        nickname: "",
        passportNumber: "pass-88",
        roleKeys: [],
        accessFlags: [],
        isProfileComplete: false,
        profileDataJson: null,
      },
      repository,
    );

    expect(repository.createCharacterRecord).toHaveBeenCalledWith({
      accountId: "21631886-7b4d-4be2-b6e9-95322d0dca41",
      serverId: "server-1",
      fullName: "Ivan Smirnov",
      nickname: "Ivan Smirnov",
      passportNumber: "88",
      isProfileComplete: false,
      profileDataJson: null,
      roleKeys: [],
      accessFlags: [],
    });
  });
});

describe("updateCharacterManually", () => {
  it("не даёт сохранить дублирующийся паспорт при редактировании", async () => {
    const repository = createRepositoryMock();

    repository.getCharacterByIdForAccount.mockResolvedValue({
      id: "character-1",
      serverId: "server-1",
    });
    repository.findCharacterByPassport.mockResolvedValue({
      id: "character-2",
    });

    await expect(
      updateCharacterManually(
        {
        accountId: "21631886-7b4d-4be2-b6e9-95322d0dca41",
        serverId: "server-1",
        characterId: "character-1",
        fullName: "ivan ivanov",
        nickname: "",
        passportNumber: "pass-2",
          roleKeys: ["lawyer"],
          accessFlags: ["advocate"],
          isProfileComplete: false,
          profileDataJson: null,
        },
        repository,
      ),
    ).rejects.toBeInstanceOf(CharacterPassportConflictError);
  });

  it("не редактирует несуществующего персонажа", async () => {
    const repository = createRepositoryMock();

    repository.getCharacterByIdForAccount.mockResolvedValue(null);

    await expect(
      updateCharacterManually(
        {
        accountId: "21631886-7b4d-4be2-b6e9-95322d0dca41",
        serverId: "server-1",
        characterId: "missing-character",
        fullName: "ivan ivanov",
        nickname: "",
        passportNumber: "pass-2",
          roleKeys: ["lawyer"],
          accessFlags: ["advocate"],
          isProfileComplete: false,
          profileDataJson: null,
        },
        repository,
      ),
    ).rejects.toBeInstanceOf(CharacterNotFoundError);
  });

  it("обновляет персонажа вручную с нормализацией полей", async () => {
    const repository = createRepositoryMock();

    repository.getCharacterByIdForAccount.mockResolvedValue({
      id: "character-1",
      serverId: "server-1",
    });
    repository.findCharacterByPassport.mockResolvedValue(null);
    repository.updateCharacterRecord.mockResolvedValue({
      id: "character-1",
      fullName: "Ivan Petrov",
    });

    await updateCharacterManually(
      {
        accountId: "21631886-7b4d-4be2-b6e9-95322d0dca41",
        serverId: "server-1",
        characterId: "character-1",
        fullName: "ivan petrov",
        nickname: "petrov.law",
        passportNumber: "pass-9",
        roleKeys: ["lawyer", "lawyer"],
        accessFlags: ["advocate", "tester", "tester"],
        isProfileComplete: true,
        profileDataJson: {
          signature: "И. Петров",
          note: "Account editor updated",
        },
      },
      repository,
    );

    expect(repository.updateCharacterRecord).toHaveBeenCalledWith({
      accountId: "21631886-7b4d-4be2-b6e9-95322d0dca41",
      serverId: "server-1",
      characterId: "character-1",
      fullName: "Ivan Petrov",
      nickname: "petrov.law",
      passportNumber: "9",
      isProfileComplete: true,
      profileDataJson: {
        signature: "И. Петров",
        note: "Account editor updated",
      },
      roleKeys: ["lawyer"],
      accessFlags: ["advocate", "tester"],
    });
  });
});
