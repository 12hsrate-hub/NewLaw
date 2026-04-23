import { beforeEach, describe, expect, it, vi } from "vitest";

const { redirectMock, revalidatePathMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
  revalidatePathMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next/dist/client/components/redirect-error", () => ({
  isRedirectError: (error: unknown) =>
    error instanceof Error && error.message.startsWith("NEXT_REDIRECT:"),
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/server/auth/protected", () => ({
  requireProtectedAccountContext: vi.fn(),
}));

vi.mock("@/db/repositories/character.repository", () => ({
  countCharactersByServer: vi.fn(),
}));

vi.mock("@/db/repositories/user-server-state.repository", () => ({
  setInitialDefaultCharacterIfMissing: vi.fn(),
}));

vi.mock("@/server/characters/manual-character", () => ({
  CharacterLimitExceededError: class CharacterLimitExceededError extends Error {},
  CharacterNotFoundError: class CharacterNotFoundError extends Error {},
  CharacterPassportConflictError: class CharacterPassportConflictError extends Error {},
  createCharacterManually: vi.fn(),
  updateCharacterManually: vi.fn(),
}));

vi.mock("@/server/app-shell/selection", () => ({
  setActiveServerSelection: vi.fn(),
  setActiveCharacterSelection: vi.fn(),
}));

import {
  createCharacterAction,
  updateCharacterAction,
} from "@/server/actions/characters";
import {
  CharacterLimitExceededError,
  CharacterNotFoundError,
  CharacterPassportConflictError,
  createCharacterManually,
  updateCharacterManually,
} from "@/server/characters/manual-character";
import {
  setActiveCharacterSelection,
  setActiveServerSelection,
} from "@/server/app-shell/selection";
import { requireProtectedAccountContext } from "@/server/auth/protected";
import { countCharactersByServer } from "@/db/repositories/character.repository";
import { setInitialDefaultCharacterIfMissing } from "@/db/repositories/user-server-state.repository";

function expectRedirect(promise: Promise<unknown>, path: string) {
  return expect(promise).rejects.toThrow(`NEXT_REDIRECT:${path}`);
}

describe("character actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(requireProtectedAccountContext).mockResolvedValue({
      account: {
        id: "21631886-7b4d-4be2-b6e9-95322d0dca41",
      },
    } as never);
  });

  it("создает персонажа вручную и делает его активным для текущего сервера", async () => {
    vi.mocked(createCharacterManually).mockResolvedValue({
      id: "character-1",
    } as never);
    vi.mocked(setActiveServerSelection).mockResolvedValue({} as never);
    vi.mocked(setActiveCharacterSelection).mockResolvedValue({} as never);
    vi.mocked(countCharactersByServer).mockResolvedValue(1 as never);

    const formData = new FormData();
    formData.set("serverId", "server-1");
    formData.set("fullName", "Alice Stone");
    formData.set("passportNumber", "A-001");
    formData.append("roleKeys", "lawyer");
    formData.append("accessFlags", "advocate");
    formData.append("accessFlags", "tester");
    formData.set("redirectTo", "/app");

    await expectRedirect(createCharacterAction(formData), "/app?status=character-created");

    expect(createCharacterManually).toHaveBeenCalledWith({
      accountId: "21631886-7b4d-4be2-b6e9-95322d0dca41",
      serverId: "server-1",
      fullName: "Alice Stone",
      nickname: "",
      passportNumber: "A-001",
      roleKeys: ["lawyer"],
      accessFlags: ["advocate", "tester"],
      isProfileComplete: false,
      profileDataJson: null,
    });
    expect(setActiveServerSelection).toHaveBeenCalledWith(
      "21631886-7b4d-4be2-b6e9-95322d0dca41",
      {
        serverId: "server-1",
      },
    );
    expect(setActiveCharacterSelection).toHaveBeenCalledWith(
      "21631886-7b4d-4be2-b6e9-95322d0dca41",
      {
        serverId: "server-1",
        characterId: "character-1",
      },
    );
    expect(setInitialDefaultCharacterIfMissing).not.toHaveBeenCalled();
  });

  it("корректно показывает лимит персонажей", async () => {
    vi.mocked(createCharacterManually).mockRejectedValue(new CharacterLimitExceededError());

    const formData = new FormData();
    formData.set("serverId", "server-1");
    formData.set("fullName", "Alice Stone");
    formData.set("passportNumber", "A-001");
    formData.set("redirectTo", "/app");

    await expectRedirect(createCharacterAction(formData), "/app?status=character-limit");
  });

  it("корректно показывает конфликт паспорта при создании", async () => {
    vi.mocked(createCharacterManually).mockRejectedValue(new CharacterPassportConflictError());

    const formData = new FormData();
    formData.set("serverId", "server-1");
    formData.set("fullName", "Alice Stone");
    formData.set("passportNumber", "A-001");
    formData.set("redirectTo", "/app");

    await expectRedirect(createCharacterAction(formData), "/app?status=passport-conflict");
  });

  it("создает персонажа с пустыми roles и access flags, если они не выбраны", async () => {
    vi.mocked(createCharacterManually).mockResolvedValue({
      id: "character-2",
    } as never);
    vi.mocked(setActiveServerSelection).mockResolvedValue({} as never);
    vi.mocked(setActiveCharacterSelection).mockResolvedValue({} as never);
    vi.mocked(countCharactersByServer).mockResolvedValue(1 as never);

    const formData = new FormData();
    formData.set("serverId", "server-1");
    formData.set("fullName", "Bob Stone");
    formData.set("passportNumber", "B-001");
    formData.set("redirectTo", "/app");

    await expectRedirect(createCharacterAction(formData), "/app?status=character-created");

    expect(createCharacterManually).toHaveBeenCalledWith({
      accountId: "21631886-7b4d-4be2-b6e9-95322d0dca41",
      serverId: "server-1",
      fullName: "Bob Stone",
      nickname: "",
      passportNumber: "B-001",
      roleKeys: [],
      accessFlags: [],
      isProfileComplete: false,
      profileDataJson: null,
    });
  });

  it("в account zone не меняет active selection молча и возвращает пользователя в focused group", async () => {
    vi.mocked(createCharacterManually).mockResolvedValue({
      id: "character-3",
    } as never);
    vi.mocked(countCharactersByServer).mockResolvedValue(2 as never);

    const formData = new FormData();
    formData.set("serverId", "server-1");
    formData.set("fullName", "Alice Stone");
    formData.set("nickname", "alice.stone");
    formData.set("passportNumber", "A-010");
    formData.set("position", "Адвокат");
    formData.set("address", "Дом 10");
    formData.set("phone", "1234567");
    formData.set("icEmail", "alice.stone@example.com");
    formData.set("passportImageUrl", "https://example.com/passport.png");
    formData.set("profileSignature", "А. Стоун");
    formData.set("profileNote", "Профиль для server group");
    formData.set("selectionBehavior", "account_zone");
    formData.set("redirectTo", "/account/characters?server=blackberry");

    await expectRedirect(
      createCharacterAction(formData),
      "/account/characters?server=blackberry&status=character-created",
    );

    expect(createCharacterManually).toHaveBeenCalledWith({
      accountId: "21631886-7b4d-4be2-b6e9-95322d0dca41",
      serverId: "server-1",
      fullName: "Alice Stone",
      nickname: "alice.stone",
      passportNumber: "A-010",
      roleKeys: [],
      accessFlags: [],
      isProfileComplete: true,
      profileDataJson: {
        position: "Адвокат",
        address: "Дом 10",
        phone: "123-45-67",
        icEmail: "alice.stone@example.com",
        passportImageUrl: "https://example.com/passport.png",
        signature: "А. Стоун",
        note: "Профиль для server group",
      },
    });
    expect(setActiveServerSelection).not.toHaveBeenCalled();
    expect(setActiveCharacterSelection).not.toHaveBeenCalled();
    expect(setInitialDefaultCharacterIfMissing).not.toHaveBeenCalled();
  });

  it("в account zone безопасно выставляет default только для первого персонажа на сервере", async () => {
    vi.mocked(createCharacterManually).mockResolvedValue({
      id: "character-first",
    } as never);
    vi.mocked(countCharactersByServer).mockResolvedValue(1 as never);
    vi.mocked(setInitialDefaultCharacterIfMissing).mockResolvedValue({} as never);

    const formData = new FormData();
    formData.set("serverId", "server-1");
    formData.set("fullName", "First Person");
    formData.set("nickname", "first.person");
    formData.set("passportNumber", "F-001");
    formData.set("selectionBehavior", "account_zone");
    formData.set("redirectTo", "/account/characters?server=blackberry");

    await expectRedirect(
      createCharacterAction(formData),
      "/account/characters?server=blackberry&status=character-created",
    );

    expect(setInitialDefaultCharacterIfMissing).toHaveBeenCalledWith({
      accountId: "21631886-7b4d-4be2-b6e9-95322d0dca41",
      serverId: "server-1",
      characterId: "character-first",
    });
    expect(setActiveServerSelection).not.toHaveBeenCalled();
    expect(setActiveCharacterSelection).not.toHaveBeenCalled();
  });

  it("сохраняет выбранные roles и access flags при редактировании своего персонажа", async () => {
    vi.mocked(updateCharacterManually).mockResolvedValue({
      id: "character-1",
    } as never);

    const formData = new FormData();
    formData.set("serverId", "server-1");
    formData.set("characterId", "character-1");
    formData.set("fullName", "Alice Stone");
    formData.set("nickname", "alice.stone.updated");
    formData.set("passportNumber", "A-777");
    formData.append("roleKeys", "lawyer");
    formData.append("accessFlags", "advocate");
    formData.append("accessFlags", "tester");
    formData.set("redirectTo", "/app");

    await expectRedirect(updateCharacterAction(formData), "/app?status=character-updated");

    expect(updateCharacterManually).toHaveBeenCalledWith({
      accountId: "21631886-7b4d-4be2-b6e9-95322d0dca41",
      serverId: "server-1",
      characterId: "character-1",
      fullName: "Alice Stone",
      nickname: "alice.stone.updated",
      passportNumber: "A-777",
      roleKeys: ["lawyer"],
      accessFlags: ["advocate", "tester"],
      isProfileComplete: false,
      profileDataJson: null,
    });
    expect(setActiveServerSelection).not.toHaveBeenCalled();
    expect(setActiveCharacterSelection).not.toHaveBeenCalled();
  });

  it("безопасно отклоняет попытку редактировать чужого или отсутствующего персонажа", async () => {
    vi.mocked(updateCharacterManually).mockRejectedValue(new CharacterNotFoundError());

    const formData = new FormData();
    formData.set("serverId", "server-1");
    formData.set("characterId", "character-404");
    formData.set("fullName", "Alice Stone");
    formData.set("passportNumber", "A-777");
    formData.set("redirectTo", "/app");

    await expectRedirect(updateCharacterAction(formData), "/app?status=character-not-found");
  });

  it("безопасно отклоняет мусорные role/access значения из формы", async () => {
    const formData = new FormData();
    formData.set("serverId", "server-1");
    formData.set("fullName", "Alice Stone");
    formData.set("passportNumber", "A-001");
    formData.append("roleKeys", "root");
    formData.append("accessFlags", "god_mode");
    formData.set("redirectTo", "/app");

    await expectRedirect(createCharacterAction(formData), "/app?status=character-create-error");
    expect(createCharacterManually).not.toHaveBeenCalled();
  });
});
