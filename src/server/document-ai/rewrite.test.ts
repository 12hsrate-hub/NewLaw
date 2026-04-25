import { describe, expect, it, vi } from "vitest";

import {
  __documentFieldRewriteInternals,
  DocumentFieldRewriteBlockedError,
  DocumentFieldRewriteUnavailableError,
  rewriteOwnedDocumentField,
} from "@/server/document-ai/rewrite";
import { DocumentAccessDeniedError } from "@/server/document-area/persistence";

function createNormalizationResult(rawInput: string, normalizedInput = rawInput) {
  return {
    raw_input: rawInput,
    normalized_input: normalizedInput,
    normalization_model: "gpt-5.4-nano",
    normalization_prompt_version: "legal_input_normalization_v1",
    normalization_changed: normalizedInput !== rawInput,
  };
}

function createBaseDocument(input?: {
  documentType?: "ogp_complaint" | "rehabilitation" | "lawsuit";
  payload?: Record<string, unknown>;
}) {
  return {
    id: "document-1",
    accountId: "account-1",
    serverId: "server-1",
    characterId: "character-1",
    documentType: input?.documentType ?? ("ogp_complaint" as const),
    title: "Жалоба в ОГП",
    status: "draft" as const,
    formSchemaVersion: "ogp_complaint_mvp_editor_v1",
    snapshotCapturedAt: new Date("2026-04-22T10:00:00.000Z"),
    authorSnapshotJson: {
      characterId: "character-1",
      serverId: "server-1",
      serverCode: "blackberry",
      serverName: "Blackberry",
      fullName: "Игорь Юристов",
      nickname: "Игорь Юристов",
      passportNumber: "AA-001",
      isProfileComplete: true,
      roleKeys: ["lawyer"],
      accessFlags: ["advocate"],
      capturedAt: "2026-04-22T10:00:00.000Z",
    },
    formPayloadJson: input?.payload ?? {
      filingMode: "representative",
      appealNumber: "OGP-001",
      objectOrganization: "LSPD",
      objectFullName: "Officer Smoke",
      incidentAt: "2026-04-22T10:15",
      situationDescription: "Изначальное описание ситуации",
      violationSummary: "Изначальная формулировка нарушения",
      workingNotes: "Черновая заметка",
      trustorSnapshot: {
        sourceType: "inline_manual",
        fullName: "Пётр Доверитель",
        passportNumber: "TR-001",
        note: "Действую по доверенности",
      },
      evidenceItems: [
        {
          id: "item-1",
          mode: "custom",
          templateKey: null,
          labelSnapshot: "Запись с бодикамеры",
          url: "https://example.com/bodycam",
          sortOrder: 0,
        },
      ],
    },
    updatedAt: new Date("2026-04-22T11:00:00.000Z"),
    server: {
      id: "server-1",
      code: "blackberry",
      name: "Blackberry",
    },
  };
}

function createGuardrailRetrievalResult(input?: {
  lawVersionId?: string;
  lawCurrentVersionIds?: string[];
}) {
  const lawVersionId = input?.lawVersionId ?? "law-version-1";
  const lawCurrentVersionIds = input?.lawCurrentVersionIds ?? ["law-version-1"];

  return {
    query: "query",
    serverId: "server-1",
    generatedAt: "2026-04-22T11:00:00.000Z",
    hasCurrentLawCorpus: true,
    hasUsablePrecedentCorpus: true,
    hasAnyUsableCorpus: true,
    lawRetrieval: {
      resultCount: 1,
      corpusSnapshot: {
        serverId: "server-1",
        generatedAt: "2026-04-22T11:00:00.000Z",
        currentVersionIds: lawCurrentVersionIds,
        corpusSnapshotHash: "law-hash",
      },
      results: [
        {
          serverId: "server-1",
          lawId: "law-1",
          lawKey: "fzk_lspd",
          lawTitle: "ФЗ о LSPD",
          lawVersionId,
          lawVersionStatus: "current",
          lawBlockId: "law-block-1",
          blockType: "article",
          blockOrder: 1,
          articleNumberNormalized: "5.1",
          snippet: "Норма о порядке рассмотрения жалоб.",
          blockText: "Статья 5.1. Жалоба должна быть рассмотрена в установленный срок.",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/law.1/",
          sourcePosts: [],
          metadata: {
            sourceSnapshotHash: "law-source-hash",
            normalizedTextHash: "law-text-hash",
            corpusSnapshotHash: "law-hash",
          },
        },
      ],
    },
    precedentRetrieval: {
      resultCount: 0,
      corpusSnapshot: {
        serverId: "server-1",
        generatedAt: "2026-04-22T11:00:00.000Z",
        currentVersionIds: ["precedent-version-1"],
        corpusSnapshotHash: "precedent-hash",
      },
      results: [],
    },
    resultCount: 1,
    results: [
      {
        serverId: "server-1",
        lawId: "law-1",
        lawKey: "fzk_lspd",
        lawTitle: "ФЗ о LSPD",
        lawVersionId,
        lawVersionStatus: "current",
        lawBlockId: "law-block-1",
        blockType: "article",
        blockOrder: 1,
        articleNumberNormalized: "5.1",
        snippet: "Норма о порядке рассмотрения жалоб.",
        blockText: "Статья 5.1. Жалоба должна быть рассмотрена в установленный срок.",
        sourceTopicUrl: "https://forum.gta5rp.com/threads/law.1/",
        sourcePosts: [],
        metadata: {
          sourceSnapshotHash: "law-source-hash",
          normalizedTextHash: "law-text-hash",
          corpusSnapshotHash: "law-hash",
        },
        sourceKind: "law" as const,
      },
    ],
    lawCorpusSnapshot: {
      serverId: "server-1",
      generatedAt: "2026-04-22T11:00:00.000Z",
      currentVersionIds: lawCurrentVersionIds,
      corpusSnapshotHash: "law-hash",
    },
    precedentCorpusSnapshot: {
      serverId: "server-1",
      generatedAt: "2026-04-22T11:00:00.000Z",
      currentVersionIds: ["precedent-version-1"],
      corpusSnapshotHash: "precedent-hash",
    },
    combinedRetrievalRevision: {
      serverId: "server-1",
      generatedAt: "2026-04-22T11:00:00.000Z",
      lawCorpusSnapshotHash: "law-hash",
      precedentCorpusSnapshotHash: "precedent-hash",
      combinedCorpusSnapshotHash: "combined-hash",
      lawCurrentVersionIds,
      precedentCurrentVersionIds: ["precedent-version-1"],
    },
  };
}

describe("document field rewrite flow", () => {
  it("строит suggestion только из persisted owner document и пишет safe ai log", async () => {
    const requestProxyCompletion = vi.fn().mockResolvedValue({
      status: "success",
      content: "Улучшенный и структурированный текст секции.",
      proxyKey: "primary",
      providerKey: "openai_compatible",
      model: "gpt-5.4",
      attemptedProxyKeys: ["primary"],
      responsePayloadJson: {
        choices: [
          {
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 240,
          completion_tokens: 120,
          total_tokens: 360,
          cost_usd: 0.012,
        },
      },
    });
    const createAIRequest = vi.fn().mockResolvedValue({
      id: "ai-request-1",
    });

    const result = await rewriteOwnedDocumentField(
      {
        accountId: "account-1",
        documentId: "document-1",
        sectionKey: "situation_description",
      },
      {
        getDocumentByIdForAccount: vi.fn().mockResolvedValue(createBaseDocument()),
        searchAssistantCorpus: vi.fn().mockResolvedValue(createGuardrailRetrievalResult()),
        normalizeInputText: vi
          .fn()
          .mockResolvedValue(createNormalizationResult("Изначальное описание ситуации")),
        requestProxyCompletion,
        createAIRequest,
        now: vi
          .fn()
          .mockReturnValueOnce(new Date("2026-04-22T11:05:00.000Z"))
          .mockReturnValueOnce(new Date("2026-04-22T11:05:01.250Z")),
      },
    );

    expect(result.sourceText).toBe("Изначальное описание ситуации");
    expect(result.suggestionText).toBe("Улучшенный и структурированный текст секции.");
    expect(result.basedOnUpdatedAt).toBe("2026-04-22T11:00:00.000Z");
    expect(result.usageMeta.featureKey).toBe("document_field_rewrite");

    expect(requestProxyCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        requestMetadata: expect.objectContaining({
          featureKey: "document_field_rewrite",
          documentId: "document-1",
          documentType: "ogp_complaint",
          sectionKey: "situation_description",
          intent: "document_text_improvement",
          actor_context: "representative_for_trustor",
          response_mode: "document_ready",
          prompt_version: "document_field_rewrite_legal_core_v1",
          law_version_ids: ["law-version-1"],
          law_version_contract: expect.objectContaining({
            contract_mode: "current_snapshot_only",
            is_current_snapshot_consistent: true,
          }),
        }),
      }),
    );

    const userPrompt = requestProxyCompletion.mock.calls[0]?.[0]?.userPrompt as string;
    expect(userPrompt).toContain("Изначальное описание ситуации");
    expect(userPrompt).toContain("violationSummary: Изначальная формулировка нарушения");
    expect(userPrompt).toContain("Fact ledger:");
    expect(userPrompt).toContain('"organization": "LSPD"');
    expect(userPrompt).toContain("Legal guardrails:");
    expect(userPrompt).toContain("Law version contract: current_snapshot_only (law-version-1)");
    expect(userPrompt).toContain("ФЗ о LSPD");
    expect(userPrompt).not.toContain("workingNotes");

    expect(createAIRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        featureKey: "document_field_rewrite",
        requestPayloadJson: expect.objectContaining({
          documentId: "document-1",
          documentType: "ogp_complaint",
          sectionKey: "situation_description",
          actor_context: "representative_for_trustor",
          intent: "document_text_improvement",
          response_mode: "document_ready",
          prompt_version: "document_field_rewrite_legal_core_v1",
          raw_input: "Изначальное описание ситуации",
          normalized_input: "Изначальное описание ситуации",
          normalization_model: "gpt-5.4-nano",
          sourceLength: "Изначальное описание ситуации".length,
          law_version_ids: ["law-version-1"],
          law_version_contract: expect.objectContaining({
            contract_mode: "current_snapshot_only",
            is_current_snapshot_consistent: true,
          }),
          input_trace: expect.objectContaining({
            input_kind: "document_section_rewrite",
            raw_input_preview: "Изначальное описание ситуации",
            normalized_input_preview: "Изначальное описание ситуации",
            context_field_keys: [
              "objectOrganization",
              "objectFullName",
              "incidentAt",
              "appealNumber",
              "violationSummary",
            ],
          }),
          source_ledger: expect.objectContaining({
            used_sources_strategy: "boundary_context_default",
            found_sources: expect.arrayContaining([
              expect.objectContaining({
                source_kind: "law",
                law_id: "law-1",
              }),
            ]),
            context_sources: expect.arrayContaining([
              expect.objectContaining({
                source_kind: "law",
                law_id: "law-1",
              }),
            ]),
          }),
          used_sources: [
            {
              source_kind: "law",
              server_id: "server-1",
              law_id: "law-1",
              law_name: "ФЗ о LSPD",
              law_version: "law-version-1",
              article_number: "5.1",
              source_topic_url: "https://forum.gta5rp.com/threads/law.1/",
            },
          ],
          contextFieldKeys: [
            "objectOrganization",
            "objectFullName",
            "incidentAt",
            "appealNumber",
            "violationSummary",
          ],
          fact_ledger: expect.objectContaining({
            organization: "LSPD",
            participants: expect.arrayContaining(["Officer Smoke", "Пётр Доверитель"]),
          }),
        }),
        responsePayloadJson: expect.objectContaining({
          suggestionLength: "Улучшенный и структурированный текст секции.".length,
          latencyMs: 1250,
          finishReason: "stop",
          output_trace: expect.objectContaining({
            output_kind: "document_section_plain_text",
            output_preview: "Улучшенный и структурированный текст секции.",
            output_length: "Улучшенный и структурированный текст секции.".length,
            finish_reason: "stop",
          }),
          prompt_tokens: 240,
          completion_tokens: 120,
          total_tokens: 360,
          cost_usd: 0.012,
          confidence: "high",
          queue_for_future_ai_quality_review: false,
          future_review_priority: "low",
          future_review_flags: [],
          future_review_reason_codes: [],
          self_assessment: expect.objectContaining({
            answer_confidence: "high",
            insufficient_data: false,
            answer_risk_level: "low",
          }),
        }),
      }),
    );

    const aiRequestInput = createAIRequest.mock.calls[0]?.[0];
    expect(aiRequestInput.requestPayloadJson).not.toHaveProperty("sourceText");
    expect(aiRequestInput.requestPayloadJson).not.toHaveProperty("contextText");
  });

  it("блокирует unsupported section для текущего document type", async () => {
    await expect(
      rewriteOwnedDocumentField(
        {
          accountId: "account-1",
          documentId: "document-1",
          sectionKey: "pretrial_summary",
        },
        {
          getDocumentByIdForAccount: vi.fn().mockResolvedValue(createBaseDocument()),
          searchAssistantCorpus: vi.fn(),
          requestProxyCompletion: vi.fn(),
          createAIRequest: vi.fn(),
          now: () => new Date("2026-04-22T11:05:00.000Z"),
        },
      ),
    ).rejects.toMatchObject({
      reasons: ["unsupported_section"],
    } satisfies Pick<DocumentFieldRewriteBlockedError, "reasons">);
  });

  it("не даёт вызывать rewrite для чужого документа", async () => {
    await expect(
      rewriteOwnedDocumentField(
        {
          accountId: "account-1",
          documentId: "document-404",
          sectionKey: "situation_description",
        },
        {
          getDocumentByIdForAccount: vi.fn().mockResolvedValue(null),
          searchAssistantCorpus: vi.fn(),
          requestProxyCompletion: vi.fn(),
          createAIRequest: vi.fn(),
          now: () => new Date("2026-04-22T11:05:00.000Z"),
        },
      ),
    ).rejects.toBeInstanceOf(DocumentAccessDeniedError);
  });

  it("даёт safe unavailable error и логирует неуспешную попытку", async () => {
    const createAIRequest = vi.fn().mockResolvedValue({
      id: "ai-request-2",
    });

    await expect(
      rewriteOwnedDocumentField(
        {
          accountId: "account-1",
          documentId: "document-1",
          sectionKey: "situation_description",
        },
        {
          getDocumentByIdForAccount: vi.fn().mockResolvedValue(createBaseDocument()),
          searchAssistantCorpus: vi.fn().mockResolvedValue(createGuardrailRetrievalResult()),
          normalizeInputText: vi
            .fn()
            .mockResolvedValue(createNormalizationResult("Изначальное описание ситуации")),
          requestProxyCompletion: vi.fn().mockResolvedValue({
            status: "unavailable",
            message: "AI proxy не настроен для текущего окружения.",
            attemptedProxyKeys: [],
          }),
          createAIRequest,
          now: vi
            .fn()
            .mockReturnValueOnce(new Date("2026-04-22T11:05:00.000Z"))
            .mockReturnValueOnce(new Date("2026-04-22T11:05:00.050Z")),
        },
      ),
    ).rejects.toBeInstanceOf(DocumentFieldRewriteUnavailableError);

    expect(createAIRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "unavailable",
        errorMessage: "AI proxy не настроен для текущего окружения.",
        requestPayloadJson: expect.objectContaining({
          raw_input: "Изначальное описание ситуации",
          normalized_input: "Изначальное описание ситуации",
          law_version_contract: expect.objectContaining({
            contract_mode: "current_snapshot_only",
          }),
          source_ledger: expect.objectContaining({
            used_sources_strategy: "boundary_context_default",
          }),
        }),
        responsePayloadJson: expect.objectContaining({
          output_trace: null,
          queue_for_future_ai_quality_review: true,
          future_review_priority: "high",
          future_review_reason_codes: expect.arrayContaining(["rewrite_proxy_unavailable"]),
        }),
      }),
    );
  });

  it("не принимает пустой source text", async () => {
    await expect(
      rewriteOwnedDocumentField(
        {
          accountId: "account-1",
          documentId: "document-1",
          sectionKey: "situation_description",
        },
        {
          getDocumentByIdForAccount: vi.fn().mockResolvedValue(
            createBaseDocument({
              payload: {
                ...createBaseDocument().formPayloadJson,
                situationDescription: "   ",
              },
            }),
          ),
          searchAssistantCorpus: vi.fn(),
          requestProxyCompletion: vi.fn(),
          createAIRequest: vi.fn(),
          now: () => new Date("2026-04-22T11:05:00.000Z"),
        },
      ),
    ).rejects.toMatchObject({
      reasons: ["source_text_empty"],
    } satisfies Pick<DocumentFieldRewriteBlockedError, "reasons">);
  });

  it("помечает нарушение law version contract, если guardrail вне current snapshot", async () => {
    const createAIRequest = vi.fn().mockResolvedValue({
      id: "ai-request-law-version-violation",
    });

    await rewriteOwnedDocumentField(
      {
        accountId: "account-1",
        documentId: "document-1",
        sectionKey: "situation_description",
      },
      {
        getDocumentByIdForAccount: vi.fn().mockResolvedValue(createBaseDocument()),
        searchAssistantCorpus: vi.fn().mockResolvedValue(
          createGuardrailRetrievalResult({
            lawVersionId: "law-version-2",
            lawCurrentVersionIds: ["law-version-1"],
          }),
        ),
        normalizeInputText: vi
          .fn()
          .mockResolvedValue(createNormalizationResult("Изначальное описание ситуации")),
        requestProxyCompletion: vi.fn().mockResolvedValue({
          status: "success",
          content: "Улучшенный текст без добавления новых фактов.",
          proxyKey: "primary",
          providerKey: "openai_compatible",
          model: "gpt-5.4",
          attemptedProxyKeys: ["primary"],
          responsePayloadJson: {
            choices: [{ finish_reason: "stop" }],
            usage: {
              prompt_tokens: 210,
              completion_tokens: 90,
              total_tokens: 300,
              cost_usd: 0.01,
            },
          },
        }),
        createAIRequest,
        now: vi
          .fn()
          .mockReturnValueOnce(new Date("2026-04-22T11:05:00.000Z"))
          .mockReturnValueOnce(new Date("2026-04-22T11:05:00.500Z")),
      },
    );

    expect(createAIRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        requestPayloadJson: expect.objectContaining({
          law_version_contract: expect.objectContaining({
            is_current_snapshot_consistent: false,
            found_norms_outside_current_snapshot: ["law-version-2"],
            context_norms_outside_current_snapshot: ["law-version-2"],
            used_norms_outside_current_snapshot: ["law-version-2"],
          }),
          source_ledger: expect.objectContaining({
            used_sources_strategy: "boundary_context_default",
          }),
        }),
        responsePayloadJson: expect.objectContaining({
          output_trace: expect.objectContaining({
            output_kind: "document_section_plain_text",
          }),
          queue_for_future_ai_quality_review: true,
          future_review_priority: "high",
          future_review_reason_codes: expect.arrayContaining(["law_version_contract_violation"]),
        }),
      }),
    );
  });

  it("не смешивает v1 rewrite с grounded assistant policy", () => {
    const systemPrompt = __documentFieldRewriteInternals.buildRewriteSystemPrompt();

    expect(systemPrompt).toContain("writing assistant");
    expect(systemPrompt).not.toContain("confirmed corpus");
    expect(systemPrompt).not.toContain("laws-first");
    expect(systemPrompt).not.toContain("grounded");
  });
});
