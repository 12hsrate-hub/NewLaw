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

vi.mock("@/server/characters/access-requests", () => ({
  CharacterAccessRequestAlreadyExistsError: class CharacterAccessRequestAlreadyExistsError extends Error {},
  CharacterAccessRequestAlreadyGrantedError: class CharacterAccessRequestAlreadyGrantedError extends Error {},
  CharacterAccessRequestCharacterNotFoundError: class CharacterAccessRequestCharacterNotFoundError extends Error {},
  createCharacterAccessRequest: vi.fn(),
}));

vi.mock("@/server/app-shell/selection", () => ({
  setActiveServerSelection: vi.fn(),
  setActiveCharacterSelection: vi.fn(),
}));

vi.mock("@/server/character-signatures/service", () => ({
  CharacterSignatureAccessDeniedError: class CharacterSignatureAccessDeniedError extends Error {},
  CharacterSignatureDimensionsError: class CharacterSignatureDimensionsError extends Error {},
  CharacterSignatureFileTooLargeError: class CharacterSignatureFileTooLargeError extends Error {},
  CharacterSignatureInvalidFormatError: class CharacterSignatureInvalidFormatError extends Error {},
  CharacterSignatureMissingFileError: class CharacterSignatureMissingFileError extends Error {},
  CharacterSignatureStorageUnavailableError: class CharacterSignatureStorageUnavailableError extends Error {},
  uploadCharacterSignatureForCharacter: vi.fn(),
  detachActiveCharacterSignatureForCharacter: vi.fn(),
}));

import {
  createCharacterAction,
  createCharacterAccessRequestAction,
  removeActiveCharacterSignatureAction,
  uploadCharacterSignatureAction,
  updateCharacterAction,
} from "@/server/actions/characters";
import {
  CharacterAccessRequestAlreadyExistsError,
  CharacterAccessRequestAlreadyGrantedError,
  CharacterAccessRequestCharacterNotFoundError,
  createCharacterAccessRequest,
} from "@/server/characters/access-requests";
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
import {
  CharacterSignatureAccessDeniedError,
  uploadCharacterSignatureForCharacter,
  detachActiveCharacterSignatureForCharacter,
} from "@/server/character-signatures/service";

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

  it("создает персонажа вручную с безопасными значениями и делает его активным для текущего сервера", async () => {
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

  it("создает персонажа без чтения self-service roles и access flags", async () => {
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

  it("при редактировании игнорирует self-service roles и access flags", async () => {
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

  it("игнорирует подменённые role/access значения из формы и всё равно создаёт персонажа безопасно", async () => {
    vi.mocked(createCharacterManually).mockResolvedValue({
      id: "character-safe",
    } as never);
    vi.mocked(setActiveServerSelection).mockResolvedValue({} as never);
    vi.mocked(setActiveCharacterSelection).mockResolvedValue({} as never);
    vi.mocked(countCharactersByServer).mockResolvedValue(1 as never);

    const formData = new FormData();
    formData.set("serverId", "server-1");
    formData.set("fullName", "Alice Stone");
    formData.set("passportNumber", "A-001");
    formData.append("roleKeys", "root");
    formData.append("accessFlags", "god_mode");
    formData.set("redirectTo", "/app");

    await expectRedirect(createCharacterAction(formData), "/app?status=character-created");
    expect(createCharacterManually).toHaveBeenCalledWith({
      accountId: "21631886-7b4d-4be2-b6e9-95322d0dca41",
      serverId: "server-1",
      fullName: "Alice Stone",
      nickname: "",
      passportNumber: "A-001",
      isProfileComplete: false,
      profileDataJson: null,
    });
  });

  it("создаёт заявку на адвокатский доступ через account zone", async () => {
    vi.mocked(createCharacterAccessRequest).mockResolvedValue({
      id: "request-1",
    } as never);

    const formData = new FormData();
    formData.set("characterId", "character-1");
    formData.set("requestType", "advocate_access");
    formData.set("requestComment", "Нужен адвокатский доступ");
    formData.set("redirectTo", "/account/characters?server=blackberry");

    await expectRedirect(
      createCharacterAccessRequestAction(formData),
      "/account/characters?server=blackberry&status=character-access-request-created",
    );

    expect(createCharacterAccessRequest).toHaveBeenCalledWith({
      accountId: "21631886-7b4d-4be2-b6e9-95322d0dca41",
      characterId: "character-1",
      requestType: "advocate_access",
      requestComment: "Нужен адвокатский доступ",
    });
  });

  it("не даёт создать дубль pending-заявки", async () => {
    vi.mocked(createCharacterAccessRequest).mockRejectedValue(
      new CharacterAccessRequestAlreadyExistsError(),
    );

    const formData = new FormData();
    formData.set("characterId", "character-1");
    formData.set("requestType", "advocate_access");
    formData.set("redirectTo", "/account/characters?server=blackberry");

    await expectRedirect(
      createCharacterAccessRequestAction(formData),
      "/account/characters?server=blackberry&status=character-access-request-pending-exists",
    );
  });

  it("не даёт создавать заявку, если advocate уже выдан", async () => {
    vi.mocked(createCharacterAccessRequest).mockRejectedValue(
      new CharacterAccessRequestAlreadyGrantedError(),
    );

    const formData = new FormData();
    formData.set("characterId", "character-1");
    formData.set("requestType", "advocate_access");
    formData.set("redirectTo", "/account/characters?server=blackberry");

    await expectRedirect(
      createCharacterAccessRequestAction(formData),
      "/account/characters?server=blackberry&status=character-access-request-already-granted",
    );
  });

  it("безопасно отклоняет заявку на чужого или отсутствующего персонажа", async () => {
    vi.mocked(createCharacterAccessRequest).mockRejectedValue(
      new CharacterAccessRequestCharacterNotFoundError(),
    );

    const formData = new FormData();
    formData.set("characterId", "character-404");
    formData.set("requestType", "advocate_access");
    formData.set("redirectTo", "/account/characters?server=blackberry");

    await expectRedirect(
      createCharacterAccessRequestAction(formData),
      "/account/characters?server=blackberry&status=character-access-request-not-found",
    );
  });

  it("загружает подпись персонажа и возвращает warning status для не-png варианта", async () => {
    vi.mocked(uploadCharacterSignatureForCharacter).mockResolvedValue({
      signature: {
        id: "signature-1",
      },
      warning: "Для лучшего отображения в документах рекомендуется использовать PNG с прозрачным фоном.",
      snapshot: {
        signatureId: "signature-1",
        storagePath: "servers/server-1/characters/character-1/signatures/signature-1.jpg",
        mimeType: "image/jpeg",
        width: 600,
        height: 200,
        fileSize: 120000,
      },
    } as never);

    const formData = new FormData();
    formData.set("characterId", "character-1");
    formData.set("redirectTo", "/account/characters?server=blackberry");
    formData.set(
      "signatureFile",
      new File([new Uint8Array([1, 2, 3])], "signature.jpg", {
        type: "image/jpeg",
      }),
    );

    await expectRedirect(
      uploadCharacterSignatureAction(formData),
      "/account/characters?server=blackberry&status=character-signature-uploaded-warning",
    );

    expect(uploadCharacterSignatureForCharacter).toHaveBeenCalledWith({
      accountId: "21631886-7b4d-4be2-b6e9-95322d0dca41",
      characterId: "character-1",
      file: expect.any(File),
    });
  });

  it("безопасно отвязывает активную подпись персонажа", async () => {
    vi.mocked(detachActiveCharacterSignatureForCharacter).mockResolvedValue({} as never);

    const formData = new FormData();
    formData.set("characterId", "character-1");
    formData.set("redirectTo", "/account/characters?server=blackberry");

    await expectRedirect(
      removeActiveCharacterSignatureAction(formData),
      "/account/characters?server=blackberry&status=character-signature-removed",
    );

    expect(detachActiveCharacterSignatureForCharacter).toHaveBeenCalledWith({
      accountId: "21631886-7b4d-4be2-b6e9-95322d0dca41",
      characterId: "character-1",
    });
  });

  it("не даёт менять подпись чужого персонажа", async () => {
    vi.mocked(detachActiveCharacterSignatureForCharacter).mockRejectedValue(
      new CharacterSignatureAccessDeniedError(),
    );

    const formData = new FormData();
    formData.set("characterId", "character-404");
    formData.set("redirectTo", "/account/characters?server=blackberry");

    await expectRedirect(
      removeActiveCharacterSignatureAction(formData),
      "/account/characters?server=blackberry&status=character-signature-access-denied",
    );
  });
});
