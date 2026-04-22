import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db/repositories/server.repository", () => ({
  getServers: vi.fn(),
}));

vi.mock("@/db/repositories/law-source-index.repository", () => ({
  listLawSourceIndexes: vi.fn(),
}));

vi.mock("@/db/repositories/law.repository", () => ({
  listLawsForAdminReview: vi.fn(),
}));

vi.mock("@/db/repositories/precedent-source-topic.repository", () => ({
  listPrecedentSourceTopicsForAdminReview: vi.fn(),
}));

vi.mock("@/server/law-corpus/retrieval", () => ({
  searchCurrentLawCorpus: vi.fn(),
}));

import { listLawSourceIndexes } from "@/db/repositories/law-source-index.repository";
import { listLawsForAdminReview } from "@/db/repositories/law.repository";
import { listPrecedentSourceTopicsForAdminReview } from "@/db/repositories/precedent-source-topic.repository";
import { getServers } from "@/db/repositories/server.repository";
import {
  getInternalLawCorpusPageData,
  getInternalPrecedentCorpusPageData,
} from "@/server/internal/corpus";
import { searchCurrentLawCorpus } from "@/server/law-corpus/retrieval";

describe("internal corpus page data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("строит law corpus context без зависимости от active shell server и fallback-ит preview на первый server", async () => {
    vi.mocked(getServers).mockResolvedValue([
      {
        id: "server-1",
        code: "blackberry",
        name: "Blackberry",
      },
      {
        id: "server-2",
        code: "sunrise",
        name: "Sunrise",
      },
    ] as never);
    vi.mocked(listLawSourceIndexes).mockResolvedValue([
      {
        id: "index-1",
        serverId: "server-1",
        indexUrl: "https://forum.gta5rp.com/forums/blackberry-laws",
        isEnabled: true,
        lastDiscoveredAt: null,
        lastDiscoveryStatus: "success",
        lastDiscoveryError: null,
      },
    ] as never);
    vi.mocked(listLawsForAdminReview).mockResolvedValue([
      {
        id: "law-1",
        serverId: "server-1",
        lawKey: "1.1",
        title: "Основной закон",
        topicUrl: "https://forum.gta5rp.com/threads/1",
        lawKind: "primary",
        isExcluded: false,
        classificationOverride: null,
        currentVersionId: "version-1",
        versions: [
          {
            id: "version-1",
            status: "current",
            importedAt: new Date("2026-01-01T00:00:00.000Z"),
            confirmedAt: new Date("2026-01-02T00:00:00.000Z"),
            confirmedByAccount: {
              email: "admin@example.com",
            },
            _count: {
              sourcePosts: 2,
              blocks: 5,
            },
            sourceSnapshotHash: "source-hash",
            normalizedTextHash: "normalized-hash",
          },
        ],
        _count: {
          versions: 1,
        },
      },
    ] as never);
    vi.mocked(searchCurrentLawCorpus).mockResolvedValue({
      query: "статья 1",
      serverId: "server-1",
      resultCount: 1,
      corpusSnapshot: {
        corpusSnapshotHash: "corpus-hash",
        currentVersionIds: ["version-1"],
      },
      results: [
        {
          lawBlockId: "block-1",
        },
      ],
    } as never);

    const result = await getInternalLawCorpusPageData({
      previewQuery: " статья 1 ",
      previewServerId: "missing-server",
    });

    expect(result.selectedPreviewServerId).toBe("server-1");
    expect(searchCurrentLawCorpus).toHaveBeenCalledWith({
      serverId: "server-1",
      query: "статья 1",
    });
    expect(result.bootstrapHealthByServerId["server-1"]?.status).toBe("current_corpus_ready");
    expect(result.bootstrapHealthByServerId["server-2"]?.status).toBe("corpus_bootstrap_incomplete");
  });

  it("не запускает retrieval preview без достаточного persisted query", async () => {
    vi.mocked(getServers).mockResolvedValue([
      {
        id: "server-1",
        code: "blackberry",
        name: "Blackberry",
      },
    ] as never);
    vi.mocked(listLawSourceIndexes).mockResolvedValue([] as never);
    vi.mocked(listLawsForAdminReview).mockResolvedValue([] as never);

    const result = await getInternalLawCorpusPageData({
      previewQuery: "a",
      previewServerId: "server-1",
    });

    expect(searchCurrentLawCorpus).not.toHaveBeenCalled();
    expect(result.retrievalPreview).toBeNull();
    expect(result.previewQuery).toBe("a");
  });

  it("строит precedents context для /internal/precedents без app shell state", async () => {
    vi.mocked(getServers).mockResolvedValue([
      {
        id: "server-1",
        code: "blackberry",
        name: "Blackberry",
      },
    ] as never);
    vi.mocked(listLawSourceIndexes).mockResolvedValue([
      {
        id: "index-1",
        serverId: "server-1",
        indexUrl: "https://forum.gta5rp.com/forums/blackberry-laws",
        isEnabled: true,
      },
    ] as never);
    vi.mocked(listPrecedentSourceTopicsForAdminReview).mockResolvedValue([
      {
        id: "topic-1",
        serverId: "server-1",
        sourceIndexId: "index-1",
        topicUrl: "https://forum.gta5rp.com/threads/99",
        topicExternalId: "99",
        title: "Решение суда",
        isExcluded: false,
        classificationOverride: null,
        internalNote: null,
        lastDiscoveredAt: null,
        lastDiscoveryStatus: "success",
        lastDiscoveryError: null,
        sourceIndex: {
          indexUrl: "https://forum.gta5rp.com/forums/blackberry-laws",
        },
        _count: {
          precedents: 1,
        },
        importRuns: [],
        precedents: [
          {
            id: "precedent-1",
            displayTitle: "Решение суда",
            precedentKey: "P-1",
            precedentLocatorKey: "blackberry-p-1",
            validityStatus: "applicable",
            currentVersionId: "version-1",
            versions: [
              {
                id: "version-1",
                status: "current",
                importedAt: new Date("2026-01-01T00:00:00.000Z"),
                confirmedAt: new Date("2026-01-02T00:00:00.000Z"),
                confirmedByAccount: {
                  email: "admin@example.com",
                },
                _count: {
                  sourcePosts: 2,
                  blocks: 3,
                },
                sourceSnapshotHash: "source-hash",
                normalizedTextHash: "normalized-hash",
                blocks: [
                  {
                    blockType: "facts",
                  },
                ],
              },
            ],
            _count: {
              versions: 1,
            },
          },
        ],
      },
    ] as never);

    const result = await getInternalPrecedentCorpusPageData();

    expect(result.servers).toEqual([
      {
        id: "server-1",
        name: "Blackberry",
      },
    ]);
    expect(result.sourceTopics[0]?.precedents[0]?.versions[0]?.blockTypes).toEqual(["facts"]);
  });
});
