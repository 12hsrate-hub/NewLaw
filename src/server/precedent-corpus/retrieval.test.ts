import { describe, expect, it, vi } from "vitest";

import { searchCurrentPrecedentCorpus } from "@/server/precedent-corpus/retrieval";

describe("precedent retrieval", () => {
  it("использует holding как основной retrieval unit и исключает obsolete через provider contract", async () => {
    const result = await searchCurrentPrecedentCorpus(
      {
        serverId: "server-1",
        query: "письменная форма договора",
        limit: 5,
        includeValidityStatuses: ["applicable", "limited"],
      },
      {
        listCurrentPrecedentBlocksByServer: vi.fn().mockResolvedValue([
          {
            id: "block-facts",
            blockType: "facts",
            blockOrder: 1,
            blockTitle: "Факты",
            blockText: "Спор возник из устного договора.",
            precedentVersion: {
              id: "version-1",
              status: "current",
              precedentId: "precedent-1",
              sourceSnapshotHash: "source-hash",
              normalizedTextHash: "normalized-hash",
              currentForPrecedent: {
                id: "precedent-1",
                precedentKey: "oral_contract_case",
                displayTitle: "О письменной форме договора",
                validityStatus: "applicable",
                sourceTopic: {
                  topicUrl: "https://forum.gta5rp.com/threads/200001/",
                  title: "Судебные прецеденты Верховного суда",
                },
              },
              sourcePosts: [],
            },
          },
          {
            id: "block-holding",
            blockType: "holding",
            blockOrder: 2,
            blockTitle: "Позиция суда",
            blockText: "Суд указал, что письменная форма обязательна.",
            precedentVersion: {
              id: "version-1",
              status: "current",
              precedentId: "precedent-1",
              sourceSnapshotHash: "source-hash",
              normalizedTextHash: "normalized-hash",
              currentForPrecedent: {
                id: "precedent-1",
                precedentKey: "oral_contract_case",
                displayTitle: "О письменной форме договора",
                validityStatus: "applicable",
                sourceTopic: {
                  topicUrl: "https://forum.gta5rp.com/threads/200001/",
                  title: "Судебные прецеденты Верховного суда",
                },
              },
              sourcePosts: [],
            },
          },
        ]),
        now: () => new Date("2026-04-21T08:00:00.000Z"),
      },
    );

    expect(result.resultCount).toBe(1);
    expect(result.results[0].blockType).toBe("holding");
    expect(result.results[0].validityStatus).toBe("applicable");
  });

  it("делает fallback в unstructured, если надёжной структуры нет", async () => {
    const result = await searchCurrentPrecedentCorpus(
      {
        serverId: "server-1",
        query: "договор",
        limit: 5,
      },
      {
        listCurrentPrecedentBlocksByServer: vi.fn().mockResolvedValue([
          {
            id: "block-1",
            blockType: "unstructured",
            blockOrder: 1,
            blockTitle: null,
            blockText: "Договор рассматривался судом в письменной форме.",
            precedentVersion: {
              id: "version-1",
              status: "current",
              precedentId: "precedent-1",
              sourceSnapshotHash: "source-hash",
              normalizedTextHash: "normalized-hash",
              currentForPrecedent: {
                id: "precedent-1",
                precedentKey: "contract_case",
                displayTitle: "О договоре",
                validityStatus: "limited",
                sourceTopic: {
                  topicUrl: "https://forum.gta5rp.com/threads/200001/",
                  title: "Судебные прецеденты Верховного суда",
                },
              },
              sourcePosts: [],
            },
          },
        ]),
        now: () => new Date("2026-04-21T08:00:00.000Z"),
      },
    );

    expect(result.resultCount).toBe(1);
    expect(result.results[0].blockType).toBe("unstructured");
  });
});
