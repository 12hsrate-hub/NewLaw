import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/repositories/server.repository", () => ({
  listAssistantServers: vi.fn(),
}));

import { listAssistantServers } from "@/db/repositories/server.repository";
import { getInternalAILegalCorePageContext } from "@/server/internal/ai-legal-core";

describe("internal ai legal core page context", () => {
  it("собирает assistant-capable servers и scenario groups для первого test-run slice", async () => {
    vi.mocked(listAssistantServers).mockResolvedValue([
      {
        id: "server-1",
        code: "blackberry",
        name: "Blackberry",
        hasCurrentLawCorpus: true,
        currentPrimaryLawCount: 3,
        hasUsablePrecedentCorpus: true,
        currentPrecedentCount: 2,
        hasUsableAssistantCorpus: true,
      },
      {
        id: "server-2",
        code: "legacy",
        name: "Legacy",
        hasCurrentLawCorpus: false,
        currentPrimaryLawCount: 0,
        hasUsablePrecedentCorpus: false,
        currentPrecedentCount: 0,
        hasUsableAssistantCorpus: false,
      },
    ]);

    const result = await getInternalAILegalCorePageContext();

    expect(result.servers).toEqual([
      expect.objectContaining({
        code: "blackberry",
        currentPrimaryLawCount: 3,
        currentPrecedentCount: 2,
      }),
    ]);
    expect(result.lawVersionOptions).toEqual([
      expect.objectContaining({
        value: "current_snapshot_only",
      }),
    ]);
    expect(result.actorContextOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: "self",
        }),
      ]),
    );
    expect(result.answerModeOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: "document_ready",
        }),
      ]),
    );
    expect(result.scenarioGroups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "general_legal_questions",
          runMode: "available_now",
        }),
        expect.objectContaining({
          key: "document_text_improvement",
          runMode: "available_now",
        }),
      ]),
    );
    expect(result.implementationNotes).toEqual(
      expect.arrayContaining([
        expect.stringContaining("document_text_improvement"),
      ]),
    );
  });
});
