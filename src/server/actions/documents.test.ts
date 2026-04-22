import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("next/dist/client/components/redirect-error", () => ({
  isRedirectError: () => false,
}));

vi.mock("@/server/auth/protected", () => ({
  requireProtectedAccountContext: vi.fn(),
}));

vi.mock("@/server/document-ai/rewrite", () => ({
  DocumentFieldRewriteBlockedError: class DocumentFieldRewriteBlockedError extends Error {
    constructor(public readonly reasons: Array<"unsupported_section" | "source_text_empty">) {
      super("Document field rewrite blocked.");
      this.name = "DocumentFieldRewriteBlockedError";
    }
  },
  DocumentFieldRewriteUnavailableError: class DocumentFieldRewriteUnavailableError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "DocumentFieldRewriteUnavailableError";
    }
  },
  mapDocumentFieldRewriteBlockingReasonsToMessages: vi.fn((reasons: string[]) =>
    reasons.map((reason) =>
      reason === "unsupported_section"
        ? "Для этой секции AI rewrite в v1 не поддерживается."
        : "В этой секции пока нет текста для улучшения.",
    ),
  ),
  rewriteOwnedDocumentField: vi.fn(),
}));

import { requireProtectedAccountContext } from "@/server/auth/protected";
import { rewriteDocumentFieldAction } from "@/server/actions/documents";
import {
  DocumentFieldRewriteBlockedError,
  DocumentFieldRewriteUnavailableError,
  rewriteOwnedDocumentField,
} from "@/server/document-ai/rewrite";

describe("document rewrite action", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(requireProtectedAccountContext).mockResolvedValue({
      account: {
        id: "account-1",
      },
    } as never);
  });

  it("возвращает suggestion для owner-only rewrite flow", async () => {
    vi.mocked(rewriteOwnedDocumentField).mockResolvedValue({
      sourceText: "Исходный текст",
      suggestionText: "Улучшенный текст",
      basedOnUpdatedAt: "2026-04-22T10:00:00.000Z",
      usageMeta: {
        featureKey: "document_field_rewrite",
        providerKey: "openai_compatible",
        proxyKey: "primary",
        model: "gpt-5.4",
        latencyMs: 1200,
        suggestionLength: 16,
        finishReason: "stop",
        attemptedProxyKeys: ["primary"],
      },
    });

    const result = await rewriteDocumentFieldAction({
      documentId: "document-1",
      sectionKey: "situation_description",
    });

    expect(rewriteOwnedDocumentField).toHaveBeenCalledWith({
      accountId: "account-1",
      documentId: "document-1",
      sectionKey: "situation_description",
    });
    expect(result).toEqual({
      ok: true,
      sourceText: "Исходный текст",
      suggestionText: "Улучшенный текст",
      basedOnUpdatedAt: "2026-04-22T10:00:00.000Z",
      usageMeta: {
        featureKey: "document_field_rewrite",
        providerKey: "openai_compatible",
        proxyKey: "primary",
        model: "gpt-5.4",
        latencyMs: 1200,
        suggestionLength: 16,
        finishReason: "stop",
        attemptedProxyKeys: ["primary"],
      },
    });
  });

  it("безопасно блокирует unsupported section", async () => {
    vi.mocked(rewriteOwnedDocumentField).mockRejectedValue(
      new DocumentFieldRewriteBlockedError(["unsupported_section"]),
    );

    const result = await rewriteDocumentFieldAction({
      documentId: "document-1",
      sectionKey: "situation_description",
    });

    expect(result).toEqual({
      ok: false,
      error: "rewrite-blocked",
      reasons: ["Для этой секции AI rewrite в v1 не поддерживается."],
    });
  });

  it("возвращает безопасное unavailable сообщение без выброса технической ошибки", async () => {
    vi.mocked(rewriteOwnedDocumentField).mockRejectedValue(
      new DocumentFieldRewriteUnavailableError("AI rewrite сейчас недоступен. Попробуйте ещё раз позже."),
    );

    const result = await rewriteDocumentFieldAction({
      documentId: "document-1",
      sectionKey: "situation_description",
    });

    expect(result).toEqual({
      ok: false,
      error: "rewrite-unavailable",
      message: "AI rewrite сейчас недоступен. Попробуйте ещё раз позже.",
    });
  });
});
