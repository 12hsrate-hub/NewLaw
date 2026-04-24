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

vi.mock("@/server/characters/access-request-review", () => ({
  approveCharacterAccessRequestAsAdmin: vi.fn(),
  rejectCharacterAccessRequestAsAdmin: vi.fn(),
}));

import {
  approveCharacterAccessRequestAction,
  rejectCharacterAccessRequestAction,
} from "@/server/actions/character-access-requests";
import { requireProtectedAccountContext } from "@/server/auth/protected";
import {
  approveCharacterAccessRequestAsAdmin,
  rejectCharacterAccessRequestAsAdmin,
} from "@/server/characters/access-request-review";

function expectRedirect(promise: Promise<unknown>, path: string) {
  return expect(promise).rejects.toThrow(`NEXT_REDIRECT:${path}`);
}

describe("character access request admin actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(requireProtectedAccountContext).mockResolvedValue({
      account: {
        id: "22222222-2222-2222-2222-222222222222",
      },
    } as never);
  });

  it("approve ревалидирует internal/account surfaces и редиректит с success status", async () => {
    vi.mocked(approveCharacterAccessRequestAsAdmin).mockResolvedValue({
      status: "success",
      requestId: "request-1",
    });

    const formData = new FormData();
    formData.set("returnPath", "/internal/access-requests");
    formData.set("requestId", "request-1");
    formData.set("reviewComment", "Одобрено");

    await expectRedirect(
      approveCharacterAccessRequestAction(formData),
      "/internal/access-requests?status=character-access-request-approved",
    );

    expect(approveCharacterAccessRequestAsAdmin).toHaveBeenCalledWith({
      actorAccountId: "22222222-2222-2222-2222-222222222222",
      requestId: "request-1",
      reviewComment: "Одобрено",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/account");
    expect(revalidatePathMock).toHaveBeenCalledWith("/account/characters");
    expect(revalidatePathMock).toHaveBeenCalledWith("/internal");
    expect(revalidatePathMock).toHaveBeenCalledWith("/internal/access-requests");
  });

  it("approve маппит forbidden в safe status", async () => {
    vi.mocked(approveCharacterAccessRequestAsAdmin).mockResolvedValue({
      status: "forbidden",
      message: "forbidden",
    });

    const formData = new FormData();
    formData.set("requestId", "request-1");

    await expectRedirect(
      approveCharacterAccessRequestAction(formData),
      "/internal/access-requests?status=character-access-request-review-forbidden",
    );
  });

  it("reject маппит success в rejected status", async () => {
    vi.mocked(rejectCharacterAccessRequestAsAdmin).mockResolvedValue({
      status: "success",
      requestId: "request-1",
    });

    const formData = new FormData();
    formData.set("requestId", "request-1");
    formData.set("reviewComment", "Отклонено");

    await expectRedirect(
      rejectCharacterAccessRequestAction(formData),
      "/internal/access-requests?status=character-access-request-rejected",
    );

    expect(rejectCharacterAccessRequestAsAdmin).toHaveBeenCalledWith({
      actorAccountId: "22222222-2222-2222-2222-222222222222",
      requestId: "request-1",
      reviewComment: "Отклонено",
    });
  });
});
