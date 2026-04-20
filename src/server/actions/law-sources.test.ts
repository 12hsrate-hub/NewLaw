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
  requireSuperAdminAccountContext: vi.fn(),
}));

vi.mock("@/server/law-corpus/source-management", () => ({
  LawSourceIndexDuplicateError: class LawSourceIndexDuplicateError extends Error {},
  LawSourceIndexLimitExceededError: class LawSourceIndexLimitExceededError extends Error {},
  LawSourceIndexNotFoundError: class LawSourceIndexNotFoundError extends Error {},
  LawSourceServerNotFoundError: class LawSourceServerNotFoundError extends Error {},
  addLawSourceIndexForServer: vi.fn(),
  setLawSourceIndexEnabledState: vi.fn(),
}));

import {
  createLawSourceIndexAction,
  toggleLawSourceIndexAction,
} from "@/server/actions/law-sources";
import { requireSuperAdminAccountContext } from "@/server/auth/protected";
import {
  LawSourceIndexDuplicateError,
  addLawSourceIndexForServer,
  setLawSourceIndexEnabledState,
} from "@/server/law-corpus/source-management";

function expectRedirect(promise: Promise<unknown>, path: string) {
  return expect(promise).rejects.toThrow(`NEXT_REDIRECT:${path}`);
}

describe("law source actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireSuperAdminAccountContext).mockResolvedValue({
      account: { id: "account-1", isSuperAdmin: true },
    } as never);
  });

  it("доступны только через super_admin guard", async () => {
    const formData = new FormData();
    formData.set("serverId", "server-1");
    formData.set("indexUrl", "https://forum.gta5rp.com/forums/laws");

    vi.mocked(addLawSourceIndexForServer).mockResolvedValue({ id: "source-1" } as never);

    await expectRedirect(createLawSourceIndexAction(formData), "/app/admin-laws?status=law-source-created");

    expect(requireSuperAdminAccountContext).toHaveBeenCalledWith("/app/admin-laws");
  });

  it("не позволяет не-super_admin дойти до source management actions", async () => {
    const formData = new FormData();
    formData.set("serverId", "server-1");
    formData.set("indexUrl", "https://forum.gta5rp.com/forums/laws");

    vi.mocked(requireSuperAdminAccountContext).mockRejectedValue(
      new Error("NEXT_REDIRECT:/app/security?status=admin-access-denied"),
    );

    await expect(
      createLawSourceIndexAction(formData),
    ).rejects.toThrow("NEXT_REDIRECT:/app/security?status=admin-access-denied");

    expect(addLawSourceIndexForServer).not.toHaveBeenCalled();
  });

  it("безопасно отклоняет invalid source URL", async () => {
    const formData = new FormData();
    formData.set("serverId", "server-1");
    formData.set("indexUrl", "https://example.com/laws");

    await expectRedirect(
      createLawSourceIndexAction(formData),
      "/app/admin-laws?status=law-source-create-error",
    );

    expect(addLawSourceIndexForServer).not.toHaveBeenCalled();
  });

  it("корректно обрабатывает duplicate source foundation", async () => {
    const formData = new FormData();
    formData.set("serverId", "server-1");
    formData.set("indexUrl", "https://forum.gta5rp.com/forums/laws");

    vi.mocked(addLawSourceIndexForServer).mockRejectedValue(new LawSourceIndexDuplicateError());

    await expectRedirect(
      createLawSourceIndexAction(formData),
      "/app/admin-laws?status=law-source-duplicate",
    );
  });

  it("обновляет enabled state для существующего source index", async () => {
    const formData = new FormData();
    formData.set("sourceIndexId", "source-1");
    formData.set("isEnabled", "false");

    vi.mocked(setLawSourceIndexEnabledState).mockResolvedValue({ id: "source-1" } as never);

    await expectRedirect(
      toggleLawSourceIndexAction(formData),
      "/app/admin-laws?status=law-source-updated",
    );

    expect(setLawSourceIndexEnabledState).toHaveBeenCalledWith({
      sourceIndexId: "source-1",
      isEnabled: false,
    });
  });
});
