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

vi.mock("@/server/precedent-corpus/discovery-import", () => ({
  PrecedentSourceIndexMissingError: class PrecedentSourceIndexMissingError extends Error {},
  PrecedentSourceTopicMissingError: class PrecedentSourceTopicMissingError extends Error {},
  PrecedentImportNoPostsError: class PrecedentImportNoPostsError extends Error {},
  PrecedentImportExcludedError: class PrecedentImportExcludedError extends Error {},
  PrecedentImportRunConflictError: class PrecedentImportRunConflictError extends Error {},
  runPrecedentSourceDiscovery: vi.fn(),
  runPrecedentSourceTopicImport: vi.fn(),
}));

vi.mock("@/server/precedent-corpus/foundation", () => ({
  PrecedentImportRunConflictError: class PrecedentImportRunConflictError extends Error {},
}));

import {
  runPrecedentSourceDiscoveryAction,
  runPrecedentSourceTopicImportAction,
} from "@/server/actions/precedent-corpus";
import { requireSuperAdminAccountContext } from "@/server/auth/protected";
import {
  PrecedentImportExcludedError,
  PrecedentImportNoPostsError,
  PrecedentSourceTopicMissingError,
  runPrecedentSourceDiscovery,
  runPrecedentSourceTopicImport,
} from "@/server/precedent-corpus/discovery-import";
import { PrecedentImportRunConflictError } from "@/server/precedent-corpus/foundation";

function expectRedirect(promise: Promise<unknown>, path: string) {
  return expect(promise).rejects.toThrow(`NEXT_REDIRECT:${path}`);
}

describe("precedent corpus actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireSuperAdminAccountContext).mockResolvedValue({
      account: { id: "account-1", isSuperAdmin: true },
    } as never);
  });

  it("precedent discovery доступен только через super_admin guard", async () => {
    const formData = new FormData();
    formData.set("sourceIndexId", "source-1");

    vi.mocked(runPrecedentSourceDiscovery).mockResolvedValue({ candidateCount: 1 } as never);

    await expectRedirect(
      runPrecedentSourceDiscoveryAction(formData),
      "/app/admin-laws?status=precedent-discovery-success",
    );

    expect(requireSuperAdminAccountContext).toHaveBeenCalledWith("/app/admin-laws");
  });

  it("precedent import доступен только через super_admin guard", async () => {
    const formData = new FormData();
    formData.set("sourceTopicId", "source-topic-1");

    vi.mocked(runPrecedentSourceTopicImport).mockResolvedValue({
      createdVersions: 1,
    } as never);

    await expectRedirect(
      runPrecedentSourceTopicImportAction(formData),
      "/app/admin-laws?status=precedent-import-created",
    );
  });

  it("корректно обрабатывает conflict и no-posts ветки precedent pipeline", async () => {
    const discoveryFormData = new FormData();
    discoveryFormData.set("sourceIndexId", "source-1");
    vi.mocked(runPrecedentSourceDiscovery).mockRejectedValue(new PrecedentImportRunConflictError());

    await expectRedirect(
      runPrecedentSourceDiscoveryAction(discoveryFormData),
      "/app/admin-laws?status=precedent-discovery-running",
    );

    const importFormData = new FormData();
    importFormData.set("sourceTopicId", "source-topic-1");
    vi.mocked(runPrecedentSourceTopicImport).mockRejectedValue(new PrecedentImportNoPostsError());

    await expectRedirect(
      runPrecedentSourceTopicImportAction(importFormData),
      "/app/admin-laws?status=precedent-import-no-posts",
    );
  });

  it("корректно отражает not-found и excluded ошибки precedent import", async () => {
    const notFoundFormData = new FormData();
    notFoundFormData.set("sourceTopicId", "missing-topic");
    vi.mocked(runPrecedentSourceTopicImport).mockRejectedValue(
      new PrecedentSourceTopicMissingError(),
    );

    await expectRedirect(
      runPrecedentSourceTopicImportAction(notFoundFormData),
      "/app/admin-laws?status=precedent-source-topic-not-found",
    );

    const excludedFormData = new FormData();
    excludedFormData.set("sourceTopicId", "excluded-topic");
    vi.mocked(runPrecedentSourceTopicImport).mockRejectedValue(
      new PrecedentImportExcludedError(),
    );

    await expectRedirect(
      runPrecedentSourceTopicImportAction(excludedFormData),
      "/app/admin-laws?status=precedent-import-excluded",
    );
  });
});
