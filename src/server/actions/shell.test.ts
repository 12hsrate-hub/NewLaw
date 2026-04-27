import { describe, expect, it, vi, beforeEach } from "vitest";

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

vi.mock("@/db/repositories/server.repository", () => ({
  getServerById: vi.fn(),
}));

vi.mock("@/server/auth/protected", () => ({
  requireProtectedAccountContext: vi.fn(),
}));

vi.mock("@/server/app-shell/context", () => ({
  getAppShellContext: vi.fn(),
}));

vi.mock("@/server/app-shell/selection", () => ({
  ActiveServerNotFoundError: class ActiveServerNotFoundError extends Error {},
  setActiveServerSelection: vi.fn(),
  setActiveCharacterSelection: vi.fn(),
}));

import {
  selectActiveCharacterAction,
  selectActiveServerAction,
} from "@/server/actions/shell";
import { getServerById } from "@/db/repositories/server.repository";
import { getAppShellContext } from "@/server/app-shell/context";
import {
  setActiveCharacterSelection,
  setActiveServerSelection,
} from "@/server/app-shell/selection";
import { requireProtectedAccountContext } from "@/server/auth/protected";

function expectRedirect(promise: Promise<unknown>, path: string) {
  return expect(promise).rejects.toThrow(`NEXT_REDIRECT:${path}`);
}

describe("shell selection actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("сохраняет active server и редиректит обратно в shell", async () => {
    vi.mocked(requireProtectedAccountContext).mockResolvedValue({
      account: {
        id: "21631886-7b4d-4be2-b6e9-95322d0dca41",
      },
    } as never);
    vi.mocked(getServerById).mockResolvedValue({
      id: "server-2",
      code: "blackberry",
      name: "Blackberry",
    } as never);

    vi.mocked(setActiveServerSelection).mockResolvedValue({} as never);

    const formData = new FormData();
    formData.set("serverId", "server-2");
    formData.set("redirectTo", "/app");

    await expectRedirect(selectActiveServerAction(formData), "/app");

    expect(setActiveServerSelection).toHaveBeenCalledWith(
      "21631886-7b4d-4be2-b6e9-95322d0dca41",
      {
        serverId: "server-2",
      },
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/app");
  });

  it("безопасно отклоняет выбор несуществующего сервера", async () => {
    vi.mocked(requireProtectedAccountContext).mockResolvedValue({
      account: {
        id: "21631886-7b4d-4be2-b6e9-95322d0dca41",
      },
    } as never);
    vi.mocked(getServerById).mockResolvedValue(null as never);

    const formData = new FormData();
    formData.set("serverId", "missing-server");
    formData.set("redirectTo", "/app");

    await expectRedirect(
      selectActiveServerAction(formData),
      "/app?status=server-not-found",
    );
  });

  it("без redirectTo у server switch использует новый fallback /servers", async () => {
    vi.mocked(requireProtectedAccountContext).mockResolvedValue({
      account: {
        id: "21631886-7b4d-4be2-b6e9-95322d0dca41",
      },
    } as never);
    vi.mocked(getServerById).mockResolvedValue({
      id: "server-2",
      code: "blackberry",
      name: "Blackberry",
    } as never);
    vi.mocked(setActiveServerSelection).mockResolvedValue({} as never);

    const formData = new FormData();
    formData.set("serverId", "server-2");

    await expectRedirect(selectActiveServerAction(formData), "/servers");
  });

  it("для primary shell корректно перенаправляет server-scoped assistant route на новый сервер", async () => {
    vi.mocked(requireProtectedAccountContext).mockResolvedValue({
      account: {
        id: "21631886-7b4d-4be2-b6e9-95322d0dca41",
      },
    } as never);
    vi.mocked(getServerById).mockResolvedValue({
      id: "server-3",
      code: "rainbow",
      name: "Rainbow",
    } as never);
    vi.mocked(setActiveServerSelection).mockResolvedValue({} as never);

    const formData = new FormData();
    formData.set("serverId", "server-3");
    formData.set("redirectTo", "/assistant/blackberry");

    await expectRedirect(selectActiveServerAction(formData), "/assistant/rainbow");

    expect(revalidatePathMock).toHaveBeenCalledWith("/assistant/blackberry");
    expect(revalidatePathMock).toHaveBeenCalledWith("/assistant/rainbow");
    expect(revalidatePathMock).toHaveBeenCalledWith("/app");
  });

  it("в account path сохраняет path и обновляет server query", async () => {
    vi.mocked(requireProtectedAccountContext).mockResolvedValue({
      account: {
        id: "21631886-7b4d-4be2-b6e9-95322d0dca41",
      },
    } as never);
    vi.mocked(getServerById).mockResolvedValue({
      id: "server-3",
      code: "rainbow",
      name: "Rainbow",
    } as never);
    vi.mocked(setActiveServerSelection).mockResolvedValue({} as never);

    const formData = new FormData();
    formData.set("serverId", "server-3");
    formData.set("redirectTo", "/account/characters?server=blackberry&status=active");

    await expectRedirect(
      selectActiveServerAction(formData),
      "/account/characters?status=active&server=rainbow",
    );
  });

  it("сохраняет active character только внутри текущего active server", async () => {
    vi.mocked(getAppShellContext).mockResolvedValue({
      account: {
        id: "21631886-7b4d-4be2-b6e9-95322d0dca41",
      },
      activeServer: {
        id: "server-1",
      },
    } as never);
    vi.mocked(setActiveCharacterSelection).mockResolvedValue({} as never);

    const formData = new FormData();
    formData.set("serverId", "server-1");
    formData.set("characterId", "character-1");
    formData.set("redirectTo", "/app/security");

    await expectRedirect(selectActiveCharacterAction(formData), "/app/security");

    expect(setActiveCharacterSelection).toHaveBeenCalledWith(
      "21631886-7b4d-4be2-b6e9-95322d0dca41",
      {
        serverId: "server-1",
        characterId: "character-1",
      },
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/app/security");
    expect(revalidatePathMock).toHaveBeenCalledWith("/app");
  });

  it("не даёт выбрать персонажа другого сервера даже при подмене formData", async () => {
    vi.mocked(getAppShellContext).mockResolvedValue({
      account: {
        id: "21631886-7b4d-4be2-b6e9-95322d0dca41",
      },
      activeServer: {
        id: "server-1",
      },
    } as never);

    const formData = new FormData();
    formData.set("serverId", "server-2");
    formData.set("characterId", "character-9");
    formData.set("redirectTo", "/app");

    await expectRedirect(
      selectActiveCharacterAction(formData),
      "/app?status=character-selection-error",
    );

    expect(setActiveCharacterSelection).not.toHaveBeenCalled();
  });

  it("без redirectTo у character switch использует account characters fallback", async () => {
    vi.mocked(getAppShellContext).mockResolvedValue({
      account: {
        id: "21631886-7b4d-4be2-b6e9-95322d0dca41",
      },
      activeServer: {
        id: "server-1",
      },
    } as never);
    vi.mocked(setActiveCharacterSelection).mockResolvedValue({} as never);

    const formData = new FormData();
    formData.set("serverId", "server-1");
    formData.set("characterId", "character-1");

    await expectRedirect(
      selectActiveCharacterAction(formData),
      "/account/characters",
    );
  });
});
