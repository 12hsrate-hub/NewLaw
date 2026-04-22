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

vi.mock("@/server/precedent-corpus/current-review", () => ({
  PrecedentVersionReviewTargetMissingError: class PrecedentVersionReviewTargetMissingError extends Error {},
  PrecedentVersionReviewInvalidStatusError: class PrecedentVersionReviewInvalidStatusError extends Error {},
  PrecedentValidityRequiresCurrentVersionError: class PrecedentValidityRequiresCurrentVersionError extends Error {},
  PrecedentRollbackTargetMissingError: class PrecedentRollbackTargetMissingError extends Error {},
  PrecedentRollbackInvalidStatusError: class PrecedentRollbackInvalidStatusError extends Error {},
  confirmImportedDraftPrecedentVersionAsCurrent: vi.fn(),
  updateReviewedPrecedentValidityStatus: vi.fn(),
  rollbackPrecedentCurrentVersion: vi.fn(),
}));

vi.mock("@/server/precedent-corpus/foundation", () => ({
  PrecedentImportRunConflictError: class PrecedentImportRunConflictError extends Error {},
}));

import {
  confirmCurrentPrecedentVersionAction,
  rollbackPrecedentCurrentVersionAction,
  runPrecedentSourceDiscoveryAction,
  runPrecedentSourceTopicImportAction,
  updatePrecedentValidityStatusAction,
} from "@/server/actions/precedent-corpus";
import { requireSuperAdminAccountContext } from "@/server/auth/protected";
import {
  confirmImportedDraftPrecedentVersionAsCurrent,
  rollbackPrecedentCurrentVersion,
  updateReviewedPrecedentValidityStatus,
} from "@/server/precedent-corpus/current-review";
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
      "/internal/laws?status=precedent-discovery-success",
    );

    expect(requireSuperAdminAccountContext).toHaveBeenCalledWith("/internal/laws");
    expect(revalidatePathMock).toHaveBeenCalledWith("/internal/laws");
  });

  it("precedent import доступен только через super_admin guard", async () => {
    const formData = new FormData();
    formData.set("sourceTopicId", "source-topic-1");

    vi.mocked(runPrecedentSourceTopicImport).mockResolvedValue({
      createdVersions: 1,
    } as never);

    await expectRedirect(
      runPrecedentSourceTopicImportAction(formData),
      "/internal/laws?status=precedent-import-created",
    );
  });

  it("корректно обрабатывает conflict и no-posts ветки precedent pipeline", async () => {
    const discoveryFormData = new FormData();
    discoveryFormData.set("sourceIndexId", "source-1");
    vi.mocked(runPrecedentSourceDiscovery).mockRejectedValue(new PrecedentImportRunConflictError());

    await expectRedirect(
      runPrecedentSourceDiscoveryAction(discoveryFormData),
      "/internal/laws?status=precedent-discovery-running",
    );

    const importFormData = new FormData();
    importFormData.set("sourceTopicId", "source-topic-1");
    vi.mocked(runPrecedentSourceTopicImport).mockRejectedValue(new PrecedentImportNoPostsError());

    await expectRedirect(
      runPrecedentSourceTopicImportAction(importFormData),
      "/internal/laws?status=precedent-import-no-posts",
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
      "/internal/laws?status=precedent-source-topic-not-found",
    );

    const excludedFormData = new FormData();
    excludedFormData.set("sourceTopicId", "excluded-topic");
    vi.mocked(runPrecedentSourceTopicImport).mockRejectedValue(
      new PrecedentImportExcludedError(),
    );

    await expectRedirect(
      runPrecedentSourceTopicImportAction(excludedFormData),
      "/internal/laws?status=precedent-import-excluded",
    );
  });

  it("подтверждает imported_draft precedent version как current только через super_admin guard", async () => {
    const formData = new FormData();
    formData.set("precedentVersionId", "precedent-version-draft");

    vi.mocked(confirmImportedDraftPrecedentVersionAsCurrent).mockResolvedValue({
      precedentVersionId: "precedent-version-draft",
      status: "current",
    } as never);

    await expectRedirect(
      confirmCurrentPrecedentVersionAction(formData),
      "/internal/laws?status=precedent-version-confirmed",
    );

    expect(confirmImportedDraftPrecedentVersionAsCurrent).toHaveBeenCalledWith({
      precedentVersionId: "precedent-version-draft",
      confirmedByAccountId: "account-1",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/internal/laws");
  });

  it("обновляет precedent validity status только через super_admin guard", async () => {
    const formData = new FormData();
    formData.set("precedentId", "precedent-1");
    formData.set("validityStatus", "limited");

    vi.mocked(updateReviewedPrecedentValidityStatus).mockResolvedValue({
      id: "precedent-1",
      validityStatus: "limited",
    } as never);

    await expectRedirect(
      updatePrecedentValidityStatusAction(formData),
      "/internal/laws?status=precedent-validity-updated",
    );

    expect(updateReviewedPrecedentValidityStatus).toHaveBeenCalledWith({
      precedentId: "precedent-1",
      validityStatus: "limited",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/internal/laws");
  });

  it("выполняет precedent rollback только через super_admin guard", async () => {
    const formData = new FormData();
    formData.set("precedentVersionId", "precedent-version-old-current");

    vi.mocked(rollbackPrecedentCurrentVersion).mockResolvedValue({
      precedentVersionId: "precedent-version-old-current",
      status: "current",
    } as never);

    await expectRedirect(
      rollbackPrecedentCurrentVersionAction(formData),
      "/internal/laws?status=precedent-version-rolled-back",
    );

    expect(rollbackPrecedentCurrentVersion).toHaveBeenCalledWith({
      precedentVersionId: "precedent-version-old-current",
      confirmedByAccountId: "account-1",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/internal/laws");
  });
});
