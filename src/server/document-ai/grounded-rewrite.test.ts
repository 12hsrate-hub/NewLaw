import { describe, expect, it, vi } from "vitest";

import {
  __groundedDocumentFieldRewriteInternals,
  GroundedDocumentFieldRewriteBlockedError,
  GroundedDocumentFieldRewriteInsufficientCorpusError,
  GroundedDocumentFieldRewriteUnavailableError,
  rewriteOwnedGroundedDocumentField,
} from "@/server/document-ai/grounded-rewrite";
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
    formSchemaVersion: "document_schema_v1",
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
    formPayloadJson:
      input?.payload ??
      ({
        filingMode: "representative",
        appealNumber: "OGP-001",
        objectOrganization: "LSPD",
        objectFullName: "Officer Smoke",
        incidentAt: "2026-04-22T10:15",
        situationDescription: "Описание ситуации",
        violationSummary: "Сотрудник нарушил порядок рассмотрения жалобы.",
        workingNotes: "внутренние notes",
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
            labelSnapshot: "Видео",
            url: "https://example.com",
            sortOrder: 0,
          },
        ],
      } satisfies Record<string, unknown>),
    updatedAt: new Date("2026-04-22T11:00:00.000Z"),
    server: {
      id: "server-1",
      code: "blackberry",
      name: "Blackberry",
    },
  };
}

function createLawRetrievalResult(input?: {
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
          sourceKind: "law" as const,
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

function createPrecedentRetrievalResult() {
  return {
    ...createLawRetrievalResult(),
    hasCurrentLawCorpus: false,
    lawRetrieval: {
      resultCount: 0,
      corpusSnapshot: {
        serverId: "server-1",
        generatedAt: "2026-04-22T11:00:00.000Z",
        currentVersionIds: [],
        corpusSnapshotHash: "law-hash",
      },
      results: [],
    },
    resultCount: 1,
    results: [
      {
        serverId: "server-1",
        precedentId: "precedent-1",
        precedentKey: "precedent_relief",
        precedentTitle: "Прецедент по relief",
        precedentVersionId: "precedent-version-1",
        precedentVersionStatus: "current",
        precedentBlockId: "precedent-block-1",
        blockType: "holding",
        blockOrder: 1,
        snippet: "Суд подтвердил допустимый relief.",
        blockText: "Holding: relief допустим при таких обстоятельствах.",
        validityStatus: "applicable" as const,
        sourceTopicUrl: "https://forum.gta5rp.com/threads/precedent.1/",
        sourceTopicTitle: "Прецедент",
        sourcePosts: [],
        metadata: {
          sourceSnapshotHash: "precedent-source-hash",
          normalizedTextHash: "precedent-text-hash",
          corpusSnapshotHash: "precedent-hash",
        },
        sourceKind: "precedent" as const,
      },
    ],
    precedentRetrieval: {
      resultCount: 1,
      corpusSnapshot: {
        serverId: "server-1",
        generatedAt: "2026-04-22T11:00:00.000Z",
        currentVersionIds: ["precedent-version-1"],
        corpusSnapshotHash: "precedent-hash",
      },
      results: [
        {
          serverId: "server-1",
          precedentId: "precedent-1",
          precedentKey: "precedent_relief",
          precedentTitle: "Прецедент по relief",
          precedentVersionId: "precedent-version-1",
          precedentVersionStatus: "current",
          precedentBlockId: "precedent-block-1",
          blockType: "holding",
          blockOrder: 1,
          snippet: "Суд подтвердил допустимый relief.",
          blockText: "Holding: relief допустим при таких обстоятельствах.",
          validityStatus: "applicable" as const,
          sourceTopicUrl: "https://forum.gta5rp.com/threads/precedent.1/",
          sourceTopicTitle: "Прецедент",
          sourcePosts: [],
          metadata: {
            sourceSnapshotHash: "precedent-source-hash",
            normalizedTextHash: "precedent-text-hash",
            corpusSnapshotHash: "precedent-hash",
          },
        },
      ],
    },
    lawCorpusSnapshot: {
      serverId: "server-1",
      generatedAt: "2026-04-22T11:00:00.000Z",
      currentVersionIds: [],
      corpusSnapshotHash: "law-hash",
    },
  };
}

describe("grounded document field rewrite flow", () => {
  it("строит law_grounded suggestion и пишет safe ai log", async () => {
    const requestProxyCompletion = vi.fn().mockResolvedValue({
      status: "success",
      content: "Нарушение сформулировано с опорой на нормы.",
      proxyKey: "primary",
      providerKey: "openai_compatible",
      model: "gpt-5.4",
      attemptedProxyKeys: ["primary"],
      responsePayloadJson: {
        choices: [{ finish_reason: "stop" }],
        usage: {
          prompt_tokens: 410,
          completion_tokens: 160,
          total_tokens: 570,
          cost_usd: 0.024,
        },
      },
    });
    const createAIRequest = vi.fn().mockResolvedValue({ id: "ai-request-1" });

    const result = await rewriteOwnedGroundedDocumentField(
      {
        accountId: "account-1",
        documentId: "document-1",
        sectionKey: "violation_summary",
      },
      {
        getDocumentByIdForAccount: vi.fn().mockResolvedValue(createBaseDocument()),
        searchAssistantCorpus: vi.fn().mockResolvedValue(createLawRetrievalResult()),
        normalizeInputText: vi
          .fn()
          .mockResolvedValue(createNormalizationResult("Сотрудник нарушил порядок рассмотрения жалобы.")),
        requestProxyCompletion,
        createAIRequest,
        now: vi
          .fn()
          .mockReturnValueOnce(new Date("2026-04-22T11:05:00.000Z"))
          .mockReturnValueOnce(new Date("2026-04-22T11:05:00.900Z")),
      },
    );

    expect(result.groundingMode).toBe("law_grounded");
    expect(result.references).toEqual([
      {
        sourceKind: "law",
        lawKey: "fzk_lspd",
        lawTitle: "ФЗ о LSPD",
        lawVersionId: "law-version-1",
        lawBlockId: "law-block-1",
        articleNumberNormalized: "5.1",
        sourceTopicUrl: "https://forum.gta5rp.com/threads/law.1/",
      },
    ]);
    expect(result.usageMeta.featureKey).toBe("document_field_rewrite_grounded");

    expect(requestProxyCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        requestMetadata: expect.objectContaining({
          featureKey: "document_field_rewrite_grounded",
          documentId: "document-1",
          sectionKey: "violation_summary",
          intent: "document_text_improvement",
          actor_context: "representative_for_trustor",
          response_mode: "document_ready",
          prompt_version: "document_field_rewrite_grounded_legal_core_v1",
          raw_input: "Сотрудник нарушил порядок рассмотрения жалобы.",
          normalized_input: "Сотрудник нарушил порядок рассмотрения жалобы.",
          normalization_model: "gpt-5.4-nano",
          groundingMode: "law_grounded",
          law_version_ids: ["law-version-1"],
          law_version_contract: expect.objectContaining({
            contract_mode: "current_snapshot_only",
            is_current_snapshot_consistent: true,
          }),
        }),
      }),
    );

    const userPrompt = requestProxyCompletion.mock.calls[0]?.[0]?.userPrompt as string;
    expect(userPrompt).toContain("Grounding mode: law_grounded");
    expect(userPrompt).toContain("Fact ledger:");
    expect(userPrompt).toContain('"organization": "LSPD"');
    expect(userPrompt).toContain("Grounded нормы закона:");
    expect(userPrompt).toContain("Law version contract: current_snapshot_only (law-version-1)");
    expect(userPrompt).not.toContain("workingNotes");

    expect(createAIRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        featureKey: "document_field_rewrite_grounded",
        requestPayloadJson: expect.objectContaining({
          documentId: "document-1",
          sectionKey: "violation_summary",
          actor_context: "representative_for_trustor",
          intent: "document_text_improvement",
          response_mode: "document_ready",
          prompt_version: "document_field_rewrite_grounded_legal_core_v1",
          groundingMode: "law_grounded",
          lawResultCount: 1,
          precedentResultCount: 0,
          law_version_ids: ["law-version-1"],
          law_version_contract: expect.objectContaining({
            contract_mode: "current_snapshot_only",
            is_current_snapshot_consistent: true,
          }),
          input_trace: expect.objectContaining({
            input_kind: "grounded_document_section_rewrite",
            grounding_mode: "law_grounded",
            raw_input_preview: "Сотрудник нарушил порядок рассмотрения жалобы.",
            normalized_input_preview: "Сотрудник нарушил порядок рассмотрения жалобы.",
          }),
          source_ledger: expect.objectContaining({
            used_sources_strategy: "grounded_prompt_subset",
            found_sources: expect.arrayContaining([
              expect.objectContaining({
                source_kind: "law",
                law_id: "law-1",
              }),
            ]),
            used_sources: expect.arrayContaining([
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
          fact_ledger: expect.objectContaining({
            organization: "LSPD",
            participants: expect.arrayContaining(["Officer Smoke", "Пётр Доверитель"]),
          }),
          retrievalPromptBlockCount: 1,
        }),
        responsePayloadJson: expect.objectContaining({
          statusBranch: "law_grounded",
          suggestionLength: "Нарушение сформулировано с опорой на нормы.".length,
          output_trace: expect.objectContaining({
            output_kind: "grounded_document_section_plain_text",
            grounding_mode: "law_grounded",
            output_preview: "Нарушение сформулировано с опорой на нормы.",
          }),
          prompt_tokens: 410,
          completion_tokens: 160,
          total_tokens: 570,
          cost_usd: 0.024,
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
        }),
      }),
    );
  });

  it("переходит в precedent_grounded branch, когда law results отсутствуют", async () => {
    const createAIRequest = vi.fn();
    const result = await rewriteOwnedGroundedDocumentField(
      {
        accountId: "account-1",
        documentId: "document-1",
        sectionKey: "requested_relief",
      },
      {
        getDocumentByIdForAccount: vi.fn().mockResolvedValue(
          createBaseDocument({
            documentType: "lawsuit",
            payload: {
              filingMode: "self",
              respondentName: "LSPD",
              claimSubject: "Спор",
              factualBackground: "Факты",
              legalBasisSummary: "Основания",
              requestedRelief: "Прошу пересмотреть решение.",
              workingNotes: "notes",
              trustorSnapshot: null,
              evidenceGroups: [],
              courtName: "Court",
              defendantName: "LSPD",
              claimAmount: "1000",
            },
          }),
        ),
        searchAssistantCorpus: vi.fn().mockResolvedValue(createPrecedentRetrievalResult()),
        normalizeInputText: vi
          .fn()
          .mockResolvedValue(createNormalizationResult("Прошу пересмотреть решение.")),
        requestProxyCompletion: vi.fn().mockResolvedValue({
          status: "success",
          content: "Прошу пересмотреть решение с учётом подтверждённого precedent.",
          proxyKey: "primary",
          providerKey: "openai_compatible",
          model: "gpt-5.4",
          attemptedProxyKeys: ["primary"],
          responsePayloadJson: {
            choices: [{ finish_reason: "stop" }],
            usage: {
              prompt_tokens: 280,
              completion_tokens: 110,
              total_tokens: 390,
              cost_usd: 0.016,
            },
          },
        }),
        createAIRequest,
        now: vi
          .fn()
          .mockReturnValueOnce(new Date("2026-04-22T11:05:00.000Z"))
          .mockReturnValueOnce(new Date("2026-04-22T11:05:00.400Z")),
      },
    );

    expect(result.groundingMode).toBe("precedent_grounded");
    expect(result.references[0]).toMatchObject({
      sourceKind: "precedent",
      precedentKey: "precedent_relief",
    });
    expect(result.usageMeta.groundingMode).toBe("precedent_grounded");
    expect(createAIRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        responsePayloadJson: expect.objectContaining({
          output_trace: expect.objectContaining({
            grounding_mode: "precedent_grounded",
          }),
          queue_for_future_ai_quality_review: true,
          future_review_priority: "medium",
          future_review_reason_codes: expect.arrayContaining(["precedent_only_grounding"]),
        }),
      }),
    );
  });

  it("честно возвращает insufficient_corpus, когда retrieval support отсутствует", async () => {
    const createAIRequest = vi.fn();
    await expect(
      rewriteOwnedGroundedDocumentField(
        {
          accountId: "account-1",
          documentId: "document-1",
          sectionKey: "violation_summary",
        },
        {
          getDocumentByIdForAccount: vi.fn().mockResolvedValue(createBaseDocument()),
          searchAssistantCorpus: vi.fn().mockResolvedValue({
            ...createLawRetrievalResult(),
            hasCurrentLawCorpus: false,
            hasUsablePrecedentCorpus: false,
            hasAnyUsableCorpus: false,
            lawRetrieval: {
              resultCount: 0,
              corpusSnapshot: {
                serverId: "server-1",
                generatedAt: "2026-04-22T11:00:00.000Z",
                currentVersionIds: [],
                corpusSnapshotHash: "law-hash",
              },
              results: [],
            },
            precedentRetrieval: {
              resultCount: 0,
              corpusSnapshot: {
                serverId: "server-1",
                generatedAt: "2026-04-22T11:00:00.000Z",
                currentVersionIds: [],
                corpusSnapshotHash: "precedent-hash",
              },
              results: [],
            },
            resultCount: 0,
            results: [],
            lawCorpusSnapshot: {
              serverId: "server-1",
              generatedAt: "2026-04-22T11:00:00.000Z",
              currentVersionIds: [],
              corpusSnapshotHash: "law-hash",
            },
            precedentCorpusSnapshot: {
              serverId: "server-1",
              generatedAt: "2026-04-22T11:00:00.000Z",
              currentVersionIds: [],
              corpusSnapshotHash: "precedent-hash",
            },
          }),
          normalizeInputText: vi
            .fn()
            .mockResolvedValue(createNormalizationResult("Сотрудник нарушил порядок рассмотрения жалобы.")),
          requestProxyCompletion: vi.fn(),
          createAIRequest,
          now: () => new Date("2026-04-22T11:05:00.000Z"),
        },
      ),
    ).rejects.toBeInstanceOf(GroundedDocumentFieldRewriteInsufficientCorpusError);

    expect(createAIRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        responsePayloadJson: expect.objectContaining({
          output_trace: null,
          queue_for_future_ai_quality_review: true,
          future_review_priority: "high",
          future_review_reason_codes: expect.arrayContaining(["insufficient_grounding"]),
        }),
      }),
    );
  });

  it("не даёт вызывать grounded rewrite для unsupported section", async () => {
    await expect(
      rewriteOwnedGroundedDocumentField(
        {
          accountId: "account-1",
          documentId: "document-1",
          sectionKey: "requested_relief",
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
    } satisfies Pick<GroundedDocumentFieldRewriteBlockedError, "reasons">);
  });

  it("не даёт вызывать grounded rewrite для чужого документа", async () => {
    await expect(
      rewriteOwnedGroundedDocumentField(
        {
          accountId: "account-1",
          documentId: "document-404",
          sectionKey: "violation_summary",
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

  it("даёт safe unavailable error при proxy failure", async () => {
    const createAIRequest = vi.fn();
    await expect(
      rewriteOwnedGroundedDocumentField(
        {
          accountId: "account-1",
          documentId: "document-1",
          sectionKey: "violation_summary",
        },
        {
          getDocumentByIdForAccount: vi.fn().mockResolvedValue(createBaseDocument()),
          searchAssistantCorpus: vi.fn().mockResolvedValue(createLawRetrievalResult()),
          normalizeInputText: vi
            .fn()
            .mockResolvedValue(createNormalizationResult("Сотрудник нарушил порядок рассмотрения жалобы.")),
          requestProxyCompletion: vi.fn().mockResolvedValue({
            status: "unavailable",
            message: "AI proxy временно недоступен.",
            attemptedProxyKeys: [],
          }),
          createAIRequest,
          now: vi
            .fn()
            .mockReturnValueOnce(new Date("2026-04-22T11:05:00.000Z"))
            .mockReturnValueOnce(new Date("2026-04-22T11:05:00.100Z")),
        },
      ),
    ).rejects.toBeInstanceOf(GroundedDocumentFieldRewriteUnavailableError);

    expect(createAIRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        responsePayloadJson: expect.objectContaining({
          output_trace: null,
          queue_for_future_ai_quality_review: true,
          future_review_priority: "high",
          future_review_reason_codes: expect.arrayContaining(["rewrite_proxy_unavailable"]),
        }),
      }),
    );
  });

  it("помечает нарушение law version contract в law_grounded режиме", async () => {
    const createAIRequest = vi.fn();

    await rewriteOwnedGroundedDocumentField(
      {
        accountId: "account-1",
        documentId: "document-1",
        sectionKey: "violation_summary",
      },
      {
        getDocumentByIdForAccount: vi.fn().mockResolvedValue(createBaseDocument()),
        searchAssistantCorpus: vi.fn().mockResolvedValue(
          createLawRetrievalResult({
            lawVersionId: "law-version-2",
            lawCurrentVersionIds: ["law-version-1"],
          }),
        ),
        normalizeInputText: vi
          .fn()
          .mockResolvedValue(createNormalizationResult("Сотрудник нарушил порядок рассмотрения жалобы.")),
        requestProxyCompletion: vi.fn().mockResolvedValue({
          status: "success",
          content: "Нарушение изложено нейтрально и структурно.",
          proxyKey: "primary",
          providerKey: "openai_compatible",
          model: "gpt-5.4",
          attemptedProxyKeys: ["primary"],
          responsePayloadJson: {
            choices: [{ finish_reason: "stop" }],
            usage: {
              prompt_tokens: 330,
              completion_tokens: 140,
              total_tokens: 470,
              cost_usd: 0.019,
            },
          },
        }),
        createAIRequest,
        now: vi
          .fn()
          .mockReturnValueOnce(new Date("2026-04-22T11:05:00.000Z"))
          .mockReturnValueOnce(new Date("2026-04-22T11:05:00.700Z")),
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
            used_sources_strategy: "grounded_prompt_subset",
          }),
        }),
        responsePayloadJson: expect.objectContaining({
          output_trace: expect.objectContaining({
            output_kind: "grounded_document_section_plain_text",
          }),
          queue_for_future_ai_quality_review: true,
          future_review_priority: "high",
          future_review_reason_codes: expect.arrayContaining(["law_version_contract_violation"]),
        }),
      }),
    );
  });

  it("строит section-specific query только для supported legal context", () => {
    const context = __groundedDocumentFieldRewriteInternals.buildGroundedPromptContext({
      documentType: "ogp_complaint",
      payload: createBaseDocument().formPayloadJson,
      sectionKey: "violation_summary",
    });

    expect(context.contextFieldKeys).toEqual([
      "objectOrganization",
      "objectFullName",
      "incidentAt",
      "appealNumber",
      "situationDescription",
    ]);
    expect(context.searchQuery).toContain("Violation summary");
    expect(context.searchQuery).not.toContain("workingNotes");
  });
});
