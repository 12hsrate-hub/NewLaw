import { describe, expect, it, vi } from "vitest";

import {
  CharacterAccessRequestAlreadyExistsError,
  CharacterAccessRequestAlreadyGrantedError,
  CharacterAccessRequestCharacterNotFoundError,
  createCharacterAccessRequest,
} from "@/server/characters/access-requests";

function createDependencies() {
  return {
    getCharacterByIdForAccount: vi.fn(),
    findPendingCharacterAccessRequest: vi.fn(),
    createCharacterAccessRequestRecord: vi.fn(),
  };
}

describe("createCharacterAccessRequest", () => {
  it("создаёт заявку только на своего персонажа и выводит serverId из найденного персонажа", async () => {
    const dependencies = createDependencies();

    dependencies.getCharacterByIdForAccount.mockResolvedValue({
      id: "character-1",
      accountId: "11111111-1111-1111-1111-111111111111",
      serverId: "blackberry",
      accessFlags: [],
    });
    dependencies.findPendingCharacterAccessRequest.mockResolvedValue(null);
    dependencies.createCharacterAccessRequestRecord.mockResolvedValue({
      id: "request-1",
      accountId: "11111111-1111-1111-1111-111111111111",
      serverId: "blackberry",
      characterId: "character-1",
      requestType: "advocate_access",
      requestComment: "Нужен доступ адвоката",
      status: "pending",
    });

    const result = await createCharacterAccessRequest(
      {
        accountId: "11111111-1111-1111-1111-111111111111",
        characterId: "character-1",
        requestType: "advocate_access",
        requestComment: "Нужен доступ адвоката",
      },
      dependencies as never,
    );

    expect(dependencies.createCharacterAccessRequestRecord).toHaveBeenCalledWith({
      accountId: "11111111-1111-1111-1111-111111111111",
      serverId: "blackberry",
      characterId: "character-1",
      requestType: "advocate_access",
      requestComment: "Нужен доступ адвоката",
    });
    expect(result).toEqual({
      id: "request-1",
      accountId: "11111111-1111-1111-1111-111111111111",
      serverId: "blackberry",
      characterId: "character-1",
      requestType: "advocate_access",
      requestComment: "Нужен доступ адвоката",
      status: "pending",
    });
  });

  it("не создаёт заявку на чужого или soft-deleted персонажа", async () => {
    const dependencies = createDependencies();

    dependencies.getCharacterByIdForAccount.mockResolvedValue(null);

    await expect(
      createCharacterAccessRequest(
        {
          accountId: "11111111-1111-1111-1111-111111111111",
          characterId: "character-foreign",
          requestType: "advocate_access",
          requestComment: "Проверка",
        },
        dependencies as never,
      ),
    ).rejects.toBeInstanceOf(CharacterAccessRequestCharacterNotFoundError);

    expect(dependencies.findPendingCharacterAccessRequest).not.toHaveBeenCalled();
    expect(dependencies.createCharacterAccessRequestRecord).not.toHaveBeenCalled();
  });

  it("не создаёт дубль pending-заявки на тот же characterId и requestType", async () => {
    const dependencies = createDependencies();

    dependencies.getCharacterByIdForAccount.mockResolvedValue({
      id: "character-1",
      accountId: "11111111-1111-1111-1111-111111111111",
      serverId: "blackberry",
      accessFlags: [],
    });
    dependencies.findPendingCharacterAccessRequest.mockResolvedValue({
      id: "request-existing",
      status: "pending",
    });

    await expect(
      createCharacterAccessRequest(
        {
          accountId: "11111111-1111-1111-1111-111111111111",
          characterId: "character-1",
          requestType: "advocate_access",
          requestComment: "Дубликат",
        },
        dependencies as never,
      ),
    ).rejects.toBeInstanceOf(CharacterAccessRequestAlreadyExistsError);

    expect(dependencies.createCharacterAccessRequestRecord).not.toHaveBeenCalled();
  });

  it("не создаёт заявку, если у персонажа уже есть advocate", async () => {
    const dependencies = createDependencies();

    dependencies.getCharacterByIdForAccount.mockResolvedValue({
      id: "character-1",
      accountId: "11111111-1111-1111-1111-111111111111",
      serverId: "blackberry",
      accessFlags: [{ flagKey: "advocate" }],
    });

    await expect(
      createCharacterAccessRequest(
        {
          accountId: "11111111-1111-1111-1111-111111111111",
          characterId: "character-1",
          requestType: "advocate_access",
          requestComment: "Уже адвокат",
        },
        dependencies as never,
      ),
    ).rejects.toBeInstanceOf(CharacterAccessRequestAlreadyGrantedError);

    expect(dependencies.findPendingCharacterAccessRequest).not.toHaveBeenCalled();
    expect(dependencies.createCharacterAccessRequestRecord).not.toHaveBeenCalled();
  });

  it("пустой requestComment сохраняет как null", async () => {
    const dependencies = createDependencies();

    dependencies.getCharacterByIdForAccount.mockResolvedValue({
      id: "character-1",
      accountId: "11111111-1111-1111-1111-111111111111",
      serverId: "blackberry",
      accessFlags: [],
    });
    dependencies.findPendingCharacterAccessRequest.mockResolvedValue(null);
    dependencies.createCharacterAccessRequestRecord.mockResolvedValue({
      id: "request-1",
      requestComment: null,
      status: "pending",
    });

    await createCharacterAccessRequest(
      {
        accountId: "11111111-1111-1111-1111-111111111111",
        characterId: "character-1",
        requestType: "advocate_access",
        requestComment: "   ",
      },
      dependencies as never,
    );

    expect(dependencies.createCharacterAccessRequestRecord).toHaveBeenCalledWith({
      accountId: "11111111-1111-1111-1111-111111111111",
      serverId: "blackberry",
      characterId: "character-1",
      requestType: "advocate_access",
      requestComment: null,
    });
  });
});
