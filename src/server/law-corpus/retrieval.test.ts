import { describe, expect, it, vi } from "vitest";

import { searchCurrentLawCorpus } from "@/server/law-corpus/retrieval";

describe("law corpus retrieval", () => {
  it("возвращает article-блоки как основной retrieval unit и добавляет grounded metadata", async () => {
    const result = await searchCurrentLawCorpus(
      {
        serverId: "server-1",
        query: "статья 1 общие положения",
      },
      {
        listCurrentLawBlocksByServer: vi.fn().mockResolvedValue([
          {
            id: "block-section",
            blockType: "section",
            blockOrder: 0,
            blockTitle: "Раздел I",
            blockText: "Общие положения и вводная часть.",
            articleNumberNormalized: null,
            lawVersion: {
              id: "version-1",
              status: "current",
              lawId: "law-1",
              sourceSnapshotHash: "source-hash",
              normalizedTextHash: "normalized-hash",
              currentForLaw: {
                id: "law-1",
                lawKey: "criminal_code",
                title: "Уголовный кодекс",
                topicUrl: "https://forum.gta5rp.com/threads/1001/",
              },
              sourcePosts: [
                {
                  postExternalId: "9001",
                  postUrl: "https://forum.gta5rp.com/threads/1001/post-9001",
                  postOrder: 0,
                },
              ],
            },
          },
          {
            id: "block-article-1",
            blockType: "article",
            blockOrder: 1,
            blockTitle: "Статья 1. Общие положения",
            blockText: "Статья 1. Общие положения. Основной текст статьи.",
            articleNumberNormalized: "1",
            lawVersion: {
              id: "version-1",
              status: "current",
              lawId: "law-1",
              sourceSnapshotHash: "source-hash",
              normalizedTextHash: "normalized-hash",
              currentForLaw: {
                id: "law-1",
                lawKey: "criminal_code",
                title: "Уголовный кодекс",
                topicUrl: "https://forum.gta5rp.com/threads/1001/",
              },
              sourcePosts: [
                {
                  postExternalId: "9001",
                  postUrl: "https://forum.gta5rp.com/threads/1001/post-9001",
                  postOrder: 0,
                },
              ],
            },
          },
        ]),
        now: () => new Date("2026-04-20T12:00:00.000Z"),
      },
    );

    expect(result.resultCount).toBe(1);
    expect(result.results[0]).toEqual(
      expect.objectContaining({
        lawKey: "criminal_code",
        lawVersionStatus: "current",
        blockType: "article",
        articleNumberNormalized: "1",
        sourceTopicUrl: "https://forum.gta5rp.com/threads/1001/",
        sourcePosts: [
          expect.objectContaining({
            postExternalId: "9001",
          }),
        ],
        metadata: expect.objectContaining({
          sourceSnapshotHash: "source-hash",
          normalizedTextHash: "normalized-hash",
        }),
      }),
    );
    expect(result.corpusSnapshot.currentVersionIds).toEqual(["version-1"]);
  });

  it("аккуратно fallback-ится на не-article блоки, если article не найден", async () => {
    const result = await searchCurrentLawCorpus(
      {
        serverId: "server-1",
        query: "раздел основы",
      },
      {
        listCurrentLawBlocksByServer: vi.fn().mockResolvedValue([
          {
            id: "block-section",
            blockType: "section",
            blockOrder: 0,
            blockTitle: "Раздел I. Основы",
            blockText: "Основы законодательства.",
            articleNumberNormalized: null,
            lawVersion: {
              id: "version-1",
              status: "current",
              lawId: "law-1",
              sourceSnapshotHash: "source-hash",
              normalizedTextHash: "normalized-hash",
              currentForLaw: {
                id: "law-1",
                lawKey: "criminal_code",
                title: "Уголовный кодекс",
                topicUrl: "https://forum.gta5rp.com/threads/1001/",
              },
              sourcePosts: [],
            },
          },
        ]),
        now: () => new Date("2026-04-20T12:00:00.000Z"),
      },
    );

    expect(result.resultCount).toBe(1);
    expect(result.results[0]?.blockType).toBe("section");
  });
});
