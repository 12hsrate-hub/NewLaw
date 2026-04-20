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

vi.mock("@/server/law-corpus/discovery-import", () => ({
  LawSourceIndexMissingError: class LawSourceIndexMissingError extends Error {},
  LawImportTargetMissingError: class LawImportTargetMissingError extends Error {},
  LawImportNoPostsError: class LawImportNoPostsError extends Error {},
  LawImportExcludedError: class LawImportExcludedError extends Error {},
  runLawSourceDiscovery: vi.fn(),
  runLawTopicImport: vi.fn(),
}));

vi.mock("@/server/law-corpus/foundation", () => ({
  LawImportRunConflictError: class LawImportRunConflictError extends Error {},
}));

import {
  runLawSourceDiscoveryAction,
  runLawTopicImportAction,
} from "@/server/actions/law-corpus";
import { requireSuperAdminAccountContext } from "@/server/auth/protected";
import {
  runLawSourceDiscovery,
  runLawTopicImport,
} from "@/server/law-corpus/discovery-import";

function expectRedirect(promise: Promise<unknown>, path: string) {
  return expect(promise).rejects.toThrow(`NEXT_REDIRECT:${path}`);
}

describe("law corpus actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireSuperAdminAccountContext).mockResolvedValue({
      account: { id: "account-1", isSuperAdmin: true },
    } as never);
  });

  it("запускает discovery только через super_admin guard", async () => {
    const formData = new FormData();
    formData.set("sourceIndexId", "source-1");

    vi.mocked(runLawSourceDiscovery).mockResolvedValue({ candidateCount: 3 } as never);

    await expectRedirect(
      runLawSourceDiscoveryAction(formData),
      "/app/admin-laws?status=law-discovery-success",
    );

    expect(requireSuperAdminAccountContext).toHaveBeenCalledWith("/app/admin-laws");
    expect(runLawSourceDiscovery).toHaveBeenCalledWith("source-1");
  });

  it("не позволяет non-super-admin запустить discovery/import", async () => {
    const formData = new FormData();
    formData.set("lawId", "law-1");

    vi.mocked(requireSuperAdminAccountContext).mockRejectedValue(
      new Error("NEXT_REDIRECT:/app/security?status=admin-access-denied"),
    );

    await expect(runLawTopicImportAction(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/app/security?status=admin-access-denied",
    );

    expect(runLawTopicImport).not.toHaveBeenCalled();
  });

  it("редиректит на unchanged status, если import не создал новую версию", async () => {
    const formData = new FormData();
    formData.set("lawId", "law-1");

    vi.mocked(runLawTopicImport).mockResolvedValue({
      createdNewVersion: false,
    } as never);

    await expectRedirect(
      runLawTopicImportAction(formData),
      "/app/admin-laws?status=law-import-unchanged",
    );
  });
});
