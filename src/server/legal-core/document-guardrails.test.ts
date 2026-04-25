import { describe, expect, it } from "vitest";

import {
  buildDocumentGuardrailContextText,
  buildDocumentGuardrailSearchQuery,
  buildDocumentGuardrailUsedSources,
  buildDocumentRewritePolicyLines,
} from "@/server/legal-core/document-guardrails";

function createRetrievalResult() {
  return {
    query: "query",
    serverId: "server-1",
    generatedAt: "2026-04-22T11:00:00.000Z",
    hasCurrentLawCorpus: true,
    hasUsablePrecedentCorpus: true,
    hasAnyUsableCorpus: true,
    lawRetrieval: {
      query: "query",
      serverId: "server-1",
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
          lawVersionStatus: "current" as const,
          lawBlockId: "law-block-1",
          blockType: "article" as const,
          blockOrder: 1,
          score: 0.91,
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
      query: "query",
      serverId: "server-1",
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
          precedentVersionStatus: "current" as const,
          precedentBlockId: "precedent-block-1",
          blockType: "holding" as const,
          blockOrder: 1,
          score: 0.88,
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
    resultCount: 2,
    results: [],
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

describe("document guardrails helpers", () => {
  it("строит search query с ограничением длины", () => {
    const query = buildDocumentGuardrailSearchQuery({
      sectionLabel: "Violation summary",
      sourceText: "A".repeat(20),
      contextText: "B".repeat(20),
      maxLength: 32,
    });

    expect(query.length).toBe(32);
    expect(query).toContain("Violation summary");
  });

  it("строит used sources для всех режимов", () => {
    const retrieval = createRetrievalResult();

    expect(
      buildDocumentGuardrailUsedSources(retrieval, {
        lawLimit: 1,
        precedentLimit: 1,
      }),
    ).toEqual([
      expect.objectContaining({
        source_kind: "law",
        law_id: "law-1",
      }),
      expect.objectContaining({
        source_kind: "precedent",
        precedent_id: "precedent-1",
      }),
    ]);

    expect(
      buildDocumentGuardrailUsedSources(retrieval, {
        lawLimit: 1,
        precedentLimit: 1,
        mode: "law",
      }),
    ).toEqual([
      expect.objectContaining({
        source_kind: "law",
      }),
    ]);

    expect(
      buildDocumentGuardrailUsedSources(retrieval, {
        lawLimit: 1,
        precedentLimit: 1,
        mode: "precedent",
      }),
    ).toEqual([
      expect.objectContaining({
        source_kind: "precedent",
      }),
    ]);
  });

  it("строит context text с дополнительными detail lines", () => {
    const retrieval = createRetrievalResult();
    const context = buildDocumentGuardrailContextText(retrieval, {
      lawLimit: 1,
      precedentLimit: 1,
      maxBlockTextLength: 40,
      lawLabel: "Law source",
      precedentLabel: "Precedent source",
      buildLawDetails: (result) => [`- law_key: ${result.lawKey}`],
      buildPrecedentDetails: (result) => [`- precedent_key: ${result.precedentKey}`],
    });

    expect(context.combinedCorpusSnapshotHash).toBe("combined-hash");
    expect(context.lawContext).toContain("Law source 1");
    expect(context.lawContext).toContain("- law_key: fzk_lspd");
    expect(context.precedentContext).toContain("Precedent source 1");
    expect(context.precedentContext).toContain("- precedent_key: precedent_relief");
  });

  it("строит policy lines для boundary и grounded режимов", () => {
    const boundaryLines = buildDocumentRewritePolicyLines({
      includeGuardrailsAsBoundary: true,
    });
    const groundedLines = buildDocumentRewritePolicyLines({
      includeGroundedCorpusLine: true,
    });

    expect(boundaryLines).toContain(
      "Если переданы legal guardrails, используй их только как ограничитель правового контура выбранного сервера.",
    );
    expect(groundedLines).toContain("Работай только как grounded writing assistant.");
    expect(groundedLines).toContain("Используй только переданный confirmed corpus выбранного сервера.");
  });
});
