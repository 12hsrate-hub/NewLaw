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

vi.mock("@/server/trustors/manual-trustor", () => ({
  TrustorNotFoundError: class TrustorNotFoundError extends Error {},
  createTrustorManually: vi.fn(),
  updateTrustorManually: vi.fn(),
  softDeleteTrustorManually: vi.fn(),
}));

import {
  createTrustorAction,
  softDeleteTrustorAction,
  updateTrustorAction,
} from "@/server/actions/trustors";
import { requireProtectedAccountContext } from "@/server/auth/protected";
import {
  createTrustorManually,
  softDeleteTrustorManually,
  TrustorNotFoundError,
  updateTrustorManually,
} from "@/server/trustors/manual-trustor";

function expectRedirect(promise: Promise<unknown>, path: string) {
  return expect(promise).rejects.toThrow(`NEXT_REDIRECT:${path}`);
}

describe("trustor actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(requireProtectedAccountContext).mockResolvedValue({
      account: {
        id: "21631886-7b4d-4be2-b6e9-95322d0dca41",
      },
    } as never);
  });

  it("создаёт trustor в focused server group account zone", async () => {
    vi.mocked(createTrustorManually).mockResolvedValue({
      id: "trustor-1",
    } as never);

    const formData = new FormData();
    formData.set("serverId", "server-1");
    formData.set("fullName", "Иван Доверителев");
    formData.set("passportNumber", "AA-001");
    formData.set("phone", "+7 900 000-00-00");
    formData.set("note", "Проверенный представитель");
    formData.set("redirectTo", "/account/trustors?server=blackberry");

    await expectRedirect(
      createTrustorAction(formData),
      "/account/trustors?server=blackberry&status=trustor-created",
    );

    expect(createTrustorManually).toHaveBeenCalledWith({
      accountId: "21631886-7b4d-4be2-b6e9-95322d0dca41",
      serverId: "server-1",
      fullName: "Иван Доверителев",
      passportNumber: "AA-001",
      phone: "+7 900 000-00-00",
      note: "Проверенный представитель",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/account/trustors?server=blackberry");
  });

  it("редактирует trustor card в рамках owner account и server group", async () => {
    vi.mocked(updateTrustorManually).mockResolvedValue({
      id: "trustor-1",
    } as never);

    const formData = new FormData();
    formData.set("serverId", "server-1");
    formData.set("trustorId", "trustor-1");
    formData.set("fullName", "Пётр Представителев");
    formData.set("passportNumber", "BB-002");
    formData.set("phone", "");
    formData.set("note", "Обновлённая карточка");
    formData.set("redirectTo", "/account/trustors?server=blackberry");

    await expectRedirect(
      updateTrustorAction(formData),
      "/account/trustors?server=blackberry&status=trustor-updated",
    );

    expect(updateTrustorManually).toHaveBeenCalledWith({
      accountId: "21631886-7b4d-4be2-b6e9-95322d0dca41",
      serverId: "server-1",
      trustorId: "trustor-1",
      fullName: "Пётр Представителев",
      passportNumber: "BB-002",
      phone: "",
      note: "Обновлённая карточка",
    });
  });

  it("делает soft delete trustor card и возвращает в ту же focused group", async () => {
    vi.mocked(softDeleteTrustorManually).mockResolvedValue(undefined);

    const formData = new FormData();
    formData.set("trustorId", "trustor-1");
    formData.set("redirectTo", "/account/trustors?server=blackberry");

    await expectRedirect(
      softDeleteTrustorAction(formData),
      "/account/trustors?server=blackberry&status=trustor-deleted",
    );

    expect(softDeleteTrustorManually).toHaveBeenCalledWith({
      accountId: "21631886-7b4d-4be2-b6e9-95322d0dca41",
      trustorId: "trustor-1",
    });
  });

  it("честно показывает trustor-not-found для edit/delete чужой карточки", async () => {
    vi.mocked(updateTrustorManually).mockRejectedValue(new TrustorNotFoundError());
    vi.mocked(softDeleteTrustorManually).mockRejectedValue(new TrustorNotFoundError());

    const editFormData = new FormData();
    editFormData.set("serverId", "server-1");
    editFormData.set("trustorId", "missing-trustor");
    editFormData.set("fullName", "Иван");
    editFormData.set("passportNumber", "AA-001");
    editFormData.set("phone", "");
    editFormData.set("note", "");
    editFormData.set("redirectTo", "/account/trustors?server=blackberry");

    await expectRedirect(
      updateTrustorAction(editFormData),
      "/account/trustors?server=blackberry&status=trustor-not-found",
    );

    const deleteFormData = new FormData();
    deleteFormData.set("trustorId", "missing-trustor");
    deleteFormData.set("redirectTo", "/account/trustors?server=blackberry");

    await expectRedirect(
      softDeleteTrustorAction(deleteFormData),
      "/account/trustors?server=blackberry&status=trustor-not-found",
    );
  });

  it("не даёт создать полностью пустую trustor card", async () => {
    vi.mocked(createTrustorManually).mockRejectedValue(new Error("validation"));

    const formData = new FormData();
    formData.set("serverId", "server-1");
    formData.set("fullName", "   ");
    formData.set("passportNumber", "   ");
    formData.set("phone", "   ");
    formData.set("note", "   ");
    formData.set("redirectTo", "/account/trustors?server=blackberry");

    await expectRedirect(
      createTrustorAction(formData),
      "/account/trustors?server=blackberry&status=trustor-create-error",
    );

    expect(createTrustorManually).toHaveBeenCalledWith({
      accountId: "21631886-7b4d-4be2-b6e9-95322d0dca41",
      serverId: "server-1",
      fullName: "   ",
      passportNumber: "   ",
      phone: "   ",
      note: "   ",
    });
  });
});
