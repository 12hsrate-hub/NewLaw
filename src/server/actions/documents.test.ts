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

vi.mock("@/server/document-ai/grounded-rewrite", () => ({
  GroundedDocumentFieldRewriteBlockedError: class GroundedDocumentFieldRewriteBlockedError extends Error {
    constructor(public readonly reasons: Array<"unsupported_section" | "source_text_empty">) {
      super("Grounded document field rewrite blocked.");
      this.name = "GroundedDocumentFieldRewriteBlockedError";
    }
  },
  GroundedDocumentFieldRewriteInsufficientCorpusError: class GroundedDocumentFieldRewriteInsufficientCorpusError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "GroundedDocumentFieldRewriteInsufficientCorpusError";
    }
  },
  GroundedDocumentFieldRewriteUnavailableError: class GroundedDocumentFieldRewriteUnavailableError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "GroundedDocumentFieldRewriteUnavailableError";
    }
  },
  mapGroundedDocumentFieldRewriteBlockingReasonsToMessages: vi.fn((reasons: string[]) =>
    reasons.map((reason) =>
      reason === "unsupported_section"
        ? "Grounded AI v2 пока поддерживается только для legal sections этого rollout."
        : "В этой секции пока нет текста для grounded улучшения.",
    ),
  ),
  rewriteOwnedGroundedDocumentField: vi.fn(),
}));

import { requireProtectedAccountContext } from "@/server/auth/protected";
import {
  rewriteDocumentFieldAction,
  rewriteGroundedDocumentFieldAction,
} from "@/server/actions/documents";
import {
  GroundedDocumentFieldRewriteBlockedError,
  GroundedDocumentFieldRewriteInsufficientCorpusError,
  GroundedDocumentFieldRewriteUnavailableError,
  rewriteOwnedGroundedDocumentField,
} from "@/server/document-ai/grounded-rewrite";
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

  it("возвращает grounded suggestion для supported owner-only flow", async () => {
    vi.mocked(rewriteOwnedGroundedDocumentField).mockResolvedValue({
      sourceText: "Правовые основания",
      suggestionText: "Уточнённые правовые основания с опорой на нормы.",
      basedOnUpdatedAt: "2026-04-22T10:00:00.000Z",
      groundingMode: "law_grounded",
      references: [
        {
          sourceKind: "law",
          lawKey: "fzk_lspd",
          lawTitle: "ФЗ о LSPD",
          lawVersionId: "law-version-1",
          lawBlockId: "law-block-1",
          articleNumberNormalized: "5.1",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/law.1/",
        },
      ],
      usageMeta: {
        featureKey: "document_field_rewrite_grounded",
        providerKey: "openai_compatible",
        proxyKey: "primary",
        model: "gpt-5.4",
        latencyMs: 900,
        suggestionLength: 39,
        finishReason: "stop",
        attemptedProxyKeys: ["primary"],
        groundingMode: "law_grounded",
        lawResultCount: 2,
        precedentResultCount: 0,
        retrievalPromptBlockCount: 1,
      },
    });

    const result = await rewriteGroundedDocumentFieldAction({
      documentId: "document-1",
      sectionKey: "legal_basis_summary",
    });

    expect(rewriteOwnedGroundedDocumentField).toHaveBeenCalledWith({
      accountId: "account-1",
      documentId: "document-1",
      sectionKey: "legal_basis_summary",
    });
    expect(result).toEqual({
      ok: true,
      sourceText: "Правовые основания",
      suggestionText: "Уточнённые правовые основания с опорой на нормы.",
      basedOnUpdatedAt: "2026-04-22T10:00:00.000Z",
      groundingMode: "law_grounded",
      references: [
        {
          sourceKind: "law",
          lawKey: "fzk_lspd",
          lawTitle: "ФЗ о LSPD",
          lawVersionId: "law-version-1",
          lawBlockId: "law-block-1",
          articleNumberNormalized: "5.1",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/law.1/",
        },
      ],
      usageMeta: {
        featureKey: "document_field_rewrite_grounded",
        providerKey: "openai_compatible",
        proxyKey: "primary",
        model: "gpt-5.4",
        latencyMs: 900,
        suggestionLength: 39,
        finishReason: "stop",
        attemptedProxyKeys: ["primary"],
        groundingMode: "law_grounded",
        lawResultCount: 2,
        precedentResultCount: 0,
        retrievalPromptBlockCount: 1,
      },
    });
  });

  it("возвращает honest insufficient_corpus branch для grounded flow", async () => {
    vi.mocked(rewriteOwnedGroundedDocumentField).mockRejectedValue(
      new GroundedDocumentFieldRewriteInsufficientCorpusError(
        "Для этой секции сейчас не нашлось достаточной grounded опоры в подтверждённом corpus.",
      ),
    );

    const result = await rewriteGroundedDocumentFieldAction({
      documentId: "document-1",
      sectionKey: "requested_relief",
    });

    expect(result).toEqual({
      ok: false,
      error: "insufficient-corpus",
      message:
        "Для этой секции сейчас не нашлось достаточной grounded опоры в подтверждённом corpus.",
    });
  });

  it("безопасно блокирует unsupported section для grounded flow", async () => {
    vi.mocked(rewriteOwnedGroundedDocumentField).mockRejectedValue(
      new GroundedDocumentFieldRewriteBlockedError(["unsupported_section"]),
    );

    const result = await rewriteGroundedDocumentFieldAction({
      documentId: "document-1",
      sectionKey: "violation_summary",
    });

    expect(result).toEqual({
      ok: false,
      error: "rewrite-blocked",
      reasons: ["Grounded AI v2 пока поддерживается только для legal sections этого rollout."],
    });
  });

  it("возвращает grounded unavailable message без технической детали", async () => {
    vi.mocked(rewriteOwnedGroundedDocumentField).mockRejectedValue(
      new GroundedDocumentFieldRewriteUnavailableError(
        "Grounded AI rewrite сейчас недоступен. Попробуйте ещё раз позже.",
      ),
    );

    const result = await rewriteGroundedDocumentFieldAction({
      documentId: "document-1",
      sectionKey: "legal_basis_summary",
    });

    expect(result).toEqual({
      ok: false,
      error: "rewrite-unavailable",
      message: "Grounded AI rewrite сейчас недоступен. Попробуйте ещё раз позже.",
    });
  });
});
