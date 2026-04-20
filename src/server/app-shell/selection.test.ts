import { describe, expect, it, vi } from "vitest";

import {
  ActiveServerNotFoundError,
  setActiveCharacterSelection,
  setActiveServerSelection,
} from "@/server/app-shell/selection";
import { ActiveCharacterSelectionError } from "@/server/app-shell/state";

describe("app shell selection helpers", () => {
  it("сохраняет активный сервер для аккаунта", async () => {
    const repository = {
      getServerById: vi.fn().mockResolvedValue({
        id: "server-1",
      }),
      selectActiveServer: vi.fn().mockResolvedValue({
        accountId: "21631886-7b4d-4be2-b6e9-95322d0dca41",
        serverId: "server-1",
      }),
    };

    await setActiveServerSelection(
      "21631886-7b4d-4be2-b6e9-95322d0dca41",
      {
        serverId: "server-1",
      },
      repository,
    );

    expect(repository.selectActiveServer).toHaveBeenCalledWith({
      accountId: "21631886-7b4d-4be2-b6e9-95322d0dca41",
      serverId: "server-1",
    });
  });

  it("не даёт выбрать несуществующий сервер", async () => {
    const repository = {
      getServerById: vi.fn().mockResolvedValue(null),
      selectActiveServer: vi.fn(),
    };

    await expect(
      setActiveServerSelection(
        "21631886-7b4d-4be2-b6e9-95322d0dca41",
        {
          serverId: "missing-server",
        },
        repository,
      ),
    ).rejects.toBeInstanceOf(ActiveServerNotFoundError);
  });

  it("сохраняет активного персонажа только внутри выбранного сервера", async () => {
    const repository = {
      getCharactersByServer: vi.fn().mockResolvedValue([
        {
          id: "character-1",
          serverId: "server-1",
        },
      ]),
      selectActiveCharacter: vi.fn().mockResolvedValue({
        accountId: "21631886-7b4d-4be2-b6e9-95322d0dca41",
        serverId: "server-1",
        characterId: "character-1",
      }),
    };

    await setActiveCharacterSelection(
      "21631886-7b4d-4be2-b6e9-95322d0dca41",
      {
        serverId: "server-1",
        characterId: "character-1",
      },
      repository,
    );

    expect(repository.selectActiveCharacter).toHaveBeenCalledWith({
      accountId: "21631886-7b4d-4be2-b6e9-95322d0dca41",
      serverId: "server-1",
      characterId: "character-1",
    });
  });

  it("блокирует выбор персонажа из другого сервера", async () => {
    const repository = {
      getCharactersByServer: vi.fn().mockResolvedValue([
        {
          id: "character-2",
          serverId: "server-2",
        },
      ]),
      selectActiveCharacter: vi.fn(),
    };

    await expect(
      setActiveCharacterSelection(
        "21631886-7b4d-4be2-b6e9-95322d0dca41",
        {
          serverId: "server-1",
          characterId: "character-2",
        },
        repository,
      ),
    ).rejects.toBeInstanceOf(ActiveCharacterSelectionError);
  });
});
