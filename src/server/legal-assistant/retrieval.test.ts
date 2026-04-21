import { describe, expect, it, vi } from "vitest";

import { searchAssistantCorpus } from "@/server/legal-assistant/retrieval";

describe("assistant retrieval envelope", () => {
  it("объединяет law и precedent providers только на уровне typed envelope", async () => {
    const result = await searchAssistantCorpus(
      {
        serverId: "server-1",
        query: "договор",
      },
      {
        searchCurrentLawCorpus: vi.fn().mockResolvedValue({
          query: "договор",
          serverId: "server-1",
          resultCount: 1,
          corpusSnapshot: {
            serverId: "server-1",
            generatedAt: "2026-04-21T08:00:00.000Z",
            currentVersionIds: ["law-version-1"],
            corpusSnapshotHash: "law-snapshot-hash",
          },
          results: [
            {
              serverId: "server-1",
              lawId: "law-1",
              lawKey: "civil_code",
              lawTitle: "Гражданский кодекс",
              lawVersionId: "law-version-1",
              lawVersionStatus: "current",
              lawBlockId: "law-block-1",
              blockType: "article",
              blockOrder: 1,
              articleNumberNormalized: "1",
              snippet: "Статья 1.",
              blockText: "Статья 1.",
              sourceTopicUrl: "https://forum.gta5rp.com/threads/100001/",
              sourcePosts: [],
              metadata: {
                sourceSnapshotHash: "source-hash",
                normalizedTextHash: "normalized-hash",
                corpusSnapshotHash: "law-snapshot-hash",
              },
            },
          ],
        }),
        searchCurrentPrecedentCorpus: vi.fn().mockResolvedValue({
          query: "договор",
          serverId: "server-1",
          resultCount: 1,
          corpusSnapshot: {
            serverId: "server-1",
            generatedAt: "2026-04-21T08:00:00.000Z",
            currentVersionIds: ["precedent-version-1"],
            corpusSnapshotHash: "precedent-snapshot-hash",
          },
          results: [
            {
              serverId: "server-1",
              precedentId: "precedent-1",
              precedentKey: "precedent_contract_case",
              precedentTitle: "О договоре",
              precedentVersionId: "precedent-version-1",
              precedentVersionStatus: "current",
              precedentBlockId: "precedent-block-1",
              blockType: "holding",
              blockOrder: 2,
              snippet: "Суд указал...",
              blockText: "Суд указал...",
              validityStatus: "applicable",
              sourceTopicUrl: "https://forum.gta5rp.com/threads/200001/",
              sourceTopicTitle: "Судебные прецеденты",
              sourcePosts: [],
              metadata: {
                sourceSnapshotHash: "source-hash",
                normalizedTextHash: "normalized-hash",
                corpusSnapshotHash: "precedent-snapshot-hash",
              },
            },
          ],
        }),
        now: () => new Date("2026-04-21T08:00:00.000Z"),
      },
    );

    expect(result.resultCount).toBe(2);
    expect(result.hasCurrentLawCorpus).toBe(true);
    expect(result.hasUsablePrecedentCorpus).toBe(true);
    expect(result.hasAnyUsableCorpus).toBe(true);
    expect(result.results[0].sourceKind).toBe("law");
    expect(result.results[1].sourceKind).toBe("precedent");
    expect(result.combinedRetrievalRevision.combinedCorpusSnapshotHash).toBeTruthy();
  });

  it("остаётся usable, если laws нет, но есть valid current precedents", async () => {
    const result = await searchAssistantCorpus(
      {
        serverId: "server-1",
        query: "договор",
      },
      {
        searchCurrentLawCorpus: vi.fn().mockResolvedValue({
          query: "договор",
          serverId: "server-1",
          resultCount: 0,
          corpusSnapshot: {
            serverId: "server-1",
            generatedAt: "2026-04-21T08:00:00.000Z",
            currentVersionIds: [],
            corpusSnapshotHash: "law-snapshot-hash",
          },
          results: [],
        }),
        searchCurrentPrecedentCorpus: vi.fn().mockResolvedValue({
          query: "договор",
          serverId: "server-1",
          resultCount: 1,
          corpusSnapshot: {
            serverId: "server-1",
            generatedAt: "2026-04-21T08:00:00.000Z",
            currentVersionIds: ["precedent-version-1"],
            corpusSnapshotHash: "precedent-snapshot-hash",
          },
          results: [
            {
              serverId: "server-1",
              precedentId: "precedent-1",
              precedentKey: "precedent_contract_case",
              precedentTitle: "О договоре",
              precedentVersionId: "precedent-version-1",
              precedentVersionStatus: "current",
              precedentBlockId: "precedent-block-1",
              blockType: "holding",
              blockOrder: 1,
              snippet: "Суд указал...",
              blockText: "Суд указал...",
              validityStatus: "limited",
              sourceTopicUrl: "https://forum.gta5rp.com/threads/200001/",
              sourceTopicTitle: "Судебные прецеденты",
              sourcePosts: [],
              metadata: {
                sourceSnapshotHash: "source-hash",
                normalizedTextHash: "normalized-hash",
                corpusSnapshotHash: "precedent-snapshot-hash",
              },
            },
          ],
        }),
        now: () => new Date("2026-04-21T08:00:00.000Z"),
      },
    );

    expect(result.hasCurrentLawCorpus).toBe(false);
    expect(result.hasUsablePrecedentCorpus).toBe(true);
    expect(result.hasAnyUsableCorpus).toBe(true);
    expect(result.resultCount).toBe(1);
    expect(result.results[0].sourceKind).toBe("precedent");
  });
});
