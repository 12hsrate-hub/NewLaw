import { describe, expect, it, vi } from "vitest";

import {
  PrecedentSourceIndexNotFoundError,
  PrecedentSourceTopicDuplicateError,
  addPrecedentSourceTopic,
  updatePrecedentSourceTopicOverrides,
} from "@/server/precedent-corpus/source-management";

describe("precedent source management", () => {
  it("дедуплицирует source topic по server + topic_external_id", async () => {
    const existingTopic = {
      id: "source-topic-1",
      topicExternalId: "1001",
    };

    await expect(
      addPrecedentSourceTopic(
        {
          sourceIndexId: "source-1",
          topicUrl: "https://forum.gta5rp.com/threads/precedent.1001/",
          title: "Судебный прецедент",
        },
        {
          getLawSourceIndexById: vi.fn().mockResolvedValue({
            id: "source-1",
            serverId: "server-1",
          }),
          findPrecedentSourceTopicByServerAndTopicExternalId: vi
            .fn()
            .mockResolvedValue(existingTopic),
          createPrecedentSourceTopicRecord: vi.fn(),
          getPrecedentSourceTopicById: vi.fn(),
          updatePrecedentSourceTopicManualOverride: vi.fn(),
        },
      ),
    ).rejects.toBeInstanceOf(PrecedentSourceTopicDuplicateError);
  });

  it("строит source topic foundation через source index server context", async () => {
    const createPrecedentSourceTopicRecord = vi.fn().mockResolvedValue({
      id: "source-topic-1",
    });

    await addPrecedentSourceTopic(
      {
        sourceIndexId: "source-1",
        topicUrl: "https://forum.gta5rp.com/threads/precedent.1001/",
        title: "Судебный прецедент",
      },
      {
        getLawSourceIndexById: vi.fn().mockResolvedValue({
          id: "source-1",
          serverId: "server-1",
        }),
        findPrecedentSourceTopicByServerAndTopicExternalId: vi.fn().mockResolvedValue(null),
        createPrecedentSourceTopicRecord,
        getPrecedentSourceTopicById: vi.fn(),
        updatePrecedentSourceTopicManualOverride: vi.fn(),
      },
    );

    expect(createPrecedentSourceTopicRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        serverId: "server-1",
        sourceIndexId: "source-1",
        topicExternalId: "1001",
      }),
    );
  });

  it("сохраняет manual override поля source topic", async () => {
    const updatePrecedentSourceTopicManualOverride = vi.fn().mockResolvedValue({
      id: "source-topic-1",
      isExcluded: true,
      classificationOverride: "ignored",
      internalNote: "Исключить из будущего auto-discovery.",
    });

    const result = await updatePrecedentSourceTopicOverrides(
      {
        sourceTopicId: "source-topic-1",
        isExcluded: true,
        classificationOverride: "ignored",
        internalNote: "Исключить из будущего auto-discovery.",
      },
      {
        getLawSourceIndexById: vi.fn(),
        findPrecedentSourceTopicByServerAndTopicExternalId: vi.fn(),
        createPrecedentSourceTopicRecord: vi.fn(),
        getPrecedentSourceTopicById: vi.fn().mockResolvedValue({ id: "source-topic-1" }),
        updatePrecedentSourceTopicManualOverride,
      },
    );

    expect(result.isExcluded).toBe(true);
    expect(updatePrecedentSourceTopicManualOverride).toHaveBeenCalledWith({
      sourceTopicId: "source-topic-1",
      isExcluded: true,
      classificationOverride: "ignored",
      internalNote: "Исключить из будущего auto-discovery.",
    });
  });

  it("не позволяет работать без source index", async () => {
    await expect(
      addPrecedentSourceTopic(
        {
          sourceIndexId: "missing-source",
          topicUrl: "https://forum.gta5rp.com/threads/precedent.1001/",
          title: "Судебный прецедент",
        },
        {
          getLawSourceIndexById: vi.fn().mockResolvedValue(null),
          findPrecedentSourceTopicByServerAndTopicExternalId: vi.fn(),
          createPrecedentSourceTopicRecord: vi.fn(),
          getPrecedentSourceTopicById: vi.fn(),
          updatePrecedentSourceTopicManualOverride: vi.fn(),
        },
      ),
    ).rejects.toBeInstanceOf(PrecedentSourceIndexNotFoundError);
  });
});
