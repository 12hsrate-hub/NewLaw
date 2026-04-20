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

vi.mock("@/server/precedent-corpus/source-management", () => ({
  PrecedentSourceIndexNotFoundError: class PrecedentSourceIndexNotFoundError extends Error {},
  PrecedentSourceTopicDuplicateError: class PrecedentSourceTopicDuplicateError extends Error {},
  PrecedentSourceTopicNotFoundError: class PrecedentSourceTopicNotFoundError extends Error {},
  addPrecedentSourceTopic: vi.fn(),
  updatePrecedentSourceTopicOverrides: vi.fn(),
}));

import {
  createPrecedentSourceTopicAction,
  updatePrecedentSourceTopicAction,
} from "@/server/actions/precedent-sources";
import { requireSuperAdminAccountContext } from "@/server/auth/protected";
import {
  PrecedentSourceTopicDuplicateError,
  addPrecedentSourceTopic,
  updatePrecedentSourceTopicOverrides,
} from "@/server/precedent-corpus/source-management";

function expectRedirect(promise: Promise<unknown>, path: string) {
  return expect(promise).rejects.toThrow(`NEXT_REDIRECT:${path}`);
}

describe("precedent source actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireSuperAdminAccountContext).mockResolvedValue({
      account: { id: "account-1", isSuperAdmin: true },
    } as never);
  });

  it("доступны только через super_admin guard", async () => {
    const formData = new FormData();
    formData.set("sourceIndexId", "source-1");
    formData.set("topicUrl", "https://forum.gta5rp.com/threads/precedent.1001/");
    formData.set("title", "Судебный прецедент");

    vi.mocked(addPrecedentSourceTopic).mockResolvedValue({ id: "topic-1" } as never);

    await expectRedirect(
      createPrecedentSourceTopicAction(formData),
      "/app/admin-laws?status=precedent-source-created",
    );

    expect(requireSuperAdminAccountContext).toHaveBeenCalledWith("/app/admin-laws");
  });

  it("не позволяет non-super-admin дойти до precedent foundation actions", async () => {
    const formData = new FormData();
    formData.set("sourceIndexId", "source-1");
    formData.set("topicUrl", "https://forum.gta5rp.com/threads/precedent.1001/");
    formData.set("title", "Судебный прецедент");

    vi.mocked(requireSuperAdminAccountContext).mockRejectedValue(
      new Error("NEXT_REDIRECT:/app/security?status=admin-access-denied"),
    );

    await expect(createPrecedentSourceTopicAction(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/app/security?status=admin-access-denied",
    );

    expect(addPrecedentSourceTopic).not.toHaveBeenCalled();
  });

  it("безопасно отклоняет invalid topic URL", async () => {
    const formData = new FormData();
    formData.set("sourceIndexId", "source-1");
    formData.set("topicUrl", "https://example.com/threads/precedent.1001/");
    formData.set("title", "Судебный прецедент");

    await expectRedirect(
      createPrecedentSourceTopicAction(formData),
      "/app/admin-laws?status=precedent-source-create-error",
    );

    expect(addPrecedentSourceTopic).not.toHaveBeenCalled();
  });

  it("корректно обрабатывает duplicate source topic foundation", async () => {
    const formData = new FormData();
    formData.set("sourceIndexId", "source-1");
    formData.set("topicUrl", "https://forum.gta5rp.com/threads/precedent.1001/");
    formData.set("title", "Судебный прецедент");

    vi.mocked(addPrecedentSourceTopic).mockRejectedValue(new PrecedentSourceTopicDuplicateError());

    await expectRedirect(
      createPrecedentSourceTopicAction(formData),
      "/app/admin-laws?status=precedent-source-duplicate",
    );
  });

  it("сохраняет manual override поля precedent source topic", async () => {
    const formData = new FormData();
    formData.set("sourceTopicId", "source-topic-1");
    formData.set("isExcluded", "true");
    formData.set("classificationOverride", "ignored");
    formData.set("internalNote", "Исключить до отдельного review.");

    vi.mocked(updatePrecedentSourceTopicOverrides).mockResolvedValue({ id: "source-topic-1" } as never);

    await expectRedirect(
      updatePrecedentSourceTopicAction(formData),
      "/app/admin-laws?status=precedent-source-updated",
    );

    expect(updatePrecedentSourceTopicOverrides).toHaveBeenCalledWith({
      sourceTopicId: "source-topic-1",
      isExcluded: true,
      classificationOverride: "ignored",
      internalNote: "Исключить до отдельного review.",
    });
  });
});
