import { describe, expect, it, vi } from "vitest";

import {
  __groundedDocumentFieldRewriteInternals,
  GroundedDocumentFieldRewriteBlockedError,
  GroundedDocumentFieldRewriteInsufficientCorpusError,
  GroundedDocumentFieldRewriteUnavailableError,
  rewriteOwnedGroundedDocumentField,
} from "@/server/document-ai/grounded-rewrite";
import { DocumentAccessDeniedError } from "@/server/document-area/persistence";

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
        evidenceGroups: [
          {
            id: "group-1",
            title: "Видео",
            rows: [{ id: "row-1", label: "Видео", url: "https://example.com", note: "Основная ссылка" }],
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

function createLawRetrievalResult() {
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
        currentVersionIds: ["law-version-1"],
        corpusSnapshotHash: "law-hash",
      },
      results: [
        {
          serverId: "server-1",
          lawId: "law-1",
          lawKey: "fzk_lspd",
          lawTitle: "ФЗ о LSPD",
          lawVersionId: "law-version-1",
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
        lawVersionId: "law-version-1",
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
      currentVersionIds: ["law-version-1"],
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
      lawCurrentVersionIds: ["law-version-1"],
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
          groundingMode: "law_grounded",
        }),
      }),
    );

    const userPrompt = requestProxyCompletion.mock.calls[0]?.[0]?.userPrompt as string;
    expect(userPrompt).toContain("Grounding mode: law_grounded");
    expect(userPrompt).toContain("Grounded нормы закона:");
    expect(userPrompt).not.toContain("workingNotes");

    expect(createAIRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        featureKey: "document_field_rewrite_grounded",
        requestPayloadJson: expect.objectContaining({
          documentId: "document-1",
          sectionKey: "violation_summary",
          groundingMode: "law_grounded",
          lawResultCount: 1,
          precedentResultCount: 0,
          retrievalPromptBlockCount: 1,
        }),
        responsePayloadJson: expect.objectContaining({
          statusBranch: "law_grounded",
          suggestionLength: "Нарушение сформулировано с опорой на нормы.".length,
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
        requestProxyCompletion: vi.fn().mockResolvedValue({
          status: "success",
          content: "Прошу пересмотреть решение с учётом подтверждённого precedent.",
          proxyKey: "primary",
          providerKey: "openai_compatible",
          model: "gpt-5.4",
          attemptedProxyKeys: ["primary"],
          responsePayloadJson: {
            choices: [{ finish_reason: "stop" }],
          },
        }),
        createAIRequest: vi.fn(),
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
  });

  it("честно возвращает insufficient_corpus, когда retrieval support отсутствует", async () => {
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
          requestProxyCompletion: vi.fn(),
          createAIRequest: vi.fn(),
          now: () => new Date("2026-04-22T11:05:00.000Z"),
        },
      ),
    ).rejects.toBeInstanceOf(GroundedDocumentFieldRewriteInsufficientCorpusError);
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
          requestProxyCompletion: vi.fn().mockResolvedValue({
            status: "unavailable",
            message: "AI proxy временно недоступен.",
            attemptedProxyKeys: [],
          }),
          createAIRequest: vi.fn(),
          now: vi
            .fn()
            .mockReturnValueOnce(new Date("2026-04-22T11:05:00.000Z"))
            .mockReturnValueOnce(new Date("2026-04-22T11:05:00.100Z")),
        },
      ),
    ).rejects.toBeInstanceOf(GroundedDocumentFieldRewriteUnavailableError);
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
