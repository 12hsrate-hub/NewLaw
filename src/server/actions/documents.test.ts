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

vi.mock("@/server/document-ai/complaint-narrative-improvement", () => ({
  ComplaintNarrativeImprovementBlockedError: class ComplaintNarrativeImprovementBlockedError extends Error {
    constructor(
      public readonly reasons: Array<
        | "missing_server_id"
        | "missing_active_character"
        | "missing_applicant_role"
        | "missing_organization"
        | "missing_subject_name"
        | "missing_victim_or_trustor_mode"
        | "missing_trustor_name"
        | "missing_raw_situation_description"
        | "missing_date_time"
      >,
    ) {
      super("Complaint narrative improvement blocked.");
      this.name = "ComplaintNarrativeImprovementBlockedError";
    }
  },
  ComplaintNarrativeImprovementUnavailableError: class ComplaintNarrativeImprovementUnavailableError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "ComplaintNarrativeImprovementUnavailableError";
    }
  },
  ComplaintNarrativeImprovementInvalidOutputError: class ComplaintNarrativeImprovementInvalidOutputError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "ComplaintNarrativeImprovementInvalidOutputError";
    }
  },
  mapComplaintNarrativeImprovementBlockingReasonsToMessages: vi.fn((reasons: string[]) =>
    reasons.map((reason) =>
      reason === "missing_trustor_name"
        ? "Для представительской жалобы нужно указать ФИО доверителя."
        : "Не заполнены обязательные поля complaint narrative improvement.",
    ),
  ),
  improveOwnedComplaintNarrative: vi.fn(),
}));

import { requireProtectedAccountContext } from "@/server/auth/protected";
import {
  improveComplaintNarrativeAction,
  rewriteDocumentFieldAction,
  rewriteGroundedDocumentFieldAction,
} from "@/server/actions/documents";
import {
  ComplaintNarrativeImprovementBlockedError,
  ComplaintNarrativeImprovementInvalidOutputError,
  ComplaintNarrativeImprovementUnavailableError,
  improveOwnedComplaintNarrative,
} from "@/server/document-ai/complaint-narrative-improvement";
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

  it("возвращает structured complaint narrative improvement result", async () => {
    vi.mocked(improveOwnedComplaintNarrative).mockResolvedValue({
      sourceText: "Сырой текст ситуации",
      runtimeInput: {
        server_id: "server-1",
        law_version: null,
        active_character: {
          full_name: "Игорь Юристов",
          role_label: "Адвокат",
        },
        applicant_role: "representative_advocate",
        representative_mode: "representative",
        victim_or_trustor_mode: "trustor",
        victim_or_trustor_name: "Пётр Доверитель",
        organization: "LSPD",
        subject_name: "Officer Smoke",
        date_time: "2026-04-22T10:15",
        raw_situation_description: "Сырой текст ситуации",
        evidence_list: [],
        attorney_request_context: null,
        arrest_or_bodycam_context: null,
        selected_legal_context: null,
        length_mode: "normal",
      },
      result: {
        improved_text: "Улучшенный narrative-текст.",
        legal_basis_used: [],
        used_facts: ["Факт 1"],
        missing_facts: ["Факт 2"],
        review_notes: ["Нужно проверить дату события."],
        risk_flags: ["ambiguous_date_time"],
        should_send_to_review: true,
      },
      basedOnUpdatedAt: "2026-04-22T10:00:00.000Z",
      usageMeta: {
        featureKey: "complaint_narrative_improvement",
        providerKey: "openai_compatible",
        proxyKey: "primary",
        model: "gpt-5.4-mini",
        latencyMs: 850,
        finishReason: "stop",
        attemptedProxyKeys: ["primary"],
        improvedTextLength: 27,
        lengthMode: "normal",
      },
    });

    const result = await improveComplaintNarrativeAction({
      documentId: "document-1",
      lengthMode: "normal",
    });

    expect(improveOwnedComplaintNarrative).toHaveBeenCalledWith({
      accountId: "account-1",
      documentId: "document-1",
      lengthMode: "normal",
    });
    expect(result).toEqual({
      ok: true,
      sourceText: "Сырой текст ситуации",
      improvedText: "Улучшенный narrative-текст.",
      legalBasisUsed: [],
      usedFacts: ["Факт 1"],
      missingFacts: ["Факт 2"],
      reviewNotes: ["Нужно проверить дату события."],
      riskFlags: ["ambiguous_date_time"],
      shouldSendToReview: true,
      basedOnUpdatedAt: "2026-04-22T10:00:00.000Z",
      usageMeta: {
        featureKey: "complaint_narrative_improvement",
        providerKey: "openai_compatible",
        proxyKey: "primary",
        model: "gpt-5.4-mini",
        latencyMs: 850,
        finishReason: "stop",
        attemptedProxyKeys: ["primary"],
        improvedTextLength: 27,
        lengthMode: "normal",
      },
    });
  });

  it("безопасно блокирует complaint narrative improvement по preflight причинам", async () => {
    vi.mocked(improveOwnedComplaintNarrative).mockRejectedValue(
      new ComplaintNarrativeImprovementBlockedError(["missing_trustor_name"]),
    );

    const result = await improveComplaintNarrativeAction({
      documentId: "document-1",
      lengthMode: "normal",
    });

    expect(result).toEqual({
      ok: false,
      error: "rewrite-blocked",
      reasons: ["Для представительской жалобы нужно указать ФИО доверителя."],
    });
  });

  it("возвращает safe unavailable для complaint narrative improvement", async () => {
    vi.mocked(improveOwnedComplaintNarrative).mockRejectedValue(
      new ComplaintNarrativeImprovementUnavailableError(
        "AI improvement сейчас недоступен. Попробуйте ещё раз позже.",
      ),
    );

    const result = await improveComplaintNarrativeAction({
      documentId: "document-1",
      lengthMode: "short",
    });

    expect(result).toEqual({
      ok: false,
      error: "rewrite-unavailable",
      message: "AI improvement сейчас недоступен. Попробуйте ещё раз позже.",
    });
  });

  it("возвращает invalid-output branch для complaint narrative improvement", async () => {
    vi.mocked(improveOwnedComplaintNarrative).mockRejectedValue(
      new ComplaintNarrativeImprovementInvalidOutputError(
        "AI вернул невалидный structured output. Попробуйте ещё раз позже.",
      ),
    );

    const result = await improveComplaintNarrativeAction({
      documentId: "document-1",
      lengthMode: "detailed",
    });

    expect(result).toEqual({
      ok: false,
      error: "invalid-output",
      message: "AI вернул невалидный structured output. Попробуйте ещё раз позже.",
    });
  });
});
