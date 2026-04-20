import { describe, expect, it, vi } from "vitest";

import {
  LawSourceIndexDuplicateError,
  LawSourceIndexLimitExceededError,
  LawSourceIndexNotFoundError,
  LawSourceServerNotFoundError,
  MAX_LAW_SOURCE_INDEXES_PER_SERVER,
  addLawSourceIndexForServer,
  setLawSourceIndexEnabledState,
} from "@/server/law-corpus/source-management";

describe("law source management", () => {
  it("не позволяет добавить третий source index для сервера", async () => {
    await expect(
      addLawSourceIndexForServer(
        {
          serverId: "server-1",
          indexUrl: "https://forum.gta5rp.com/forums/laws",
        },
        {
          getServerById: vi.fn().mockResolvedValue({ id: "server-1" }),
          countLawSourceIndexesByServer: vi
            .fn()
            .mockResolvedValue(MAX_LAW_SOURCE_INDEXES_PER_SERVER),
          findLawSourceIndexByServerAndUrl: vi.fn(),
          createLawSourceIndexRecord: vi.fn(),
          getLawSourceIndexById: vi.fn(),
          updateLawSourceIndexEnabledState: vi.fn(),
        },
      ),
    ).rejects.toBeInstanceOf(LawSourceIndexLimitExceededError);
  });

  it("не позволяет дублировать один и тот же source index URL", async () => {
    await expect(
      addLawSourceIndexForServer(
        {
          serverId: "server-1",
          indexUrl: "https://forum.gta5rp.com/forums/laws",
        },
        {
          getServerById: vi.fn().mockResolvedValue({ id: "server-1" }),
          countLawSourceIndexesByServer: vi.fn().mockResolvedValue(1),
          findLawSourceIndexByServerAndUrl: vi.fn().mockResolvedValue({ id: "source-1" }),
          createLawSourceIndexRecord: vi.fn(),
          getLawSourceIndexById: vi.fn(),
          updateLawSourceIndexEnabledState: vi.fn(),
        },
      ),
    ).rejects.toBeInstanceOf(LawSourceIndexDuplicateError);
  });

  it("не позволяет добавить источник для несуществующего сервера", async () => {
    await expect(
      addLawSourceIndexForServer(
        {
          serverId: "server-missing",
          indexUrl: "https://forum.gta5rp.com/forums/laws",
        },
        {
          getServerById: vi.fn().mockResolvedValue(null),
          countLawSourceIndexesByServer: vi.fn(),
          findLawSourceIndexByServerAndUrl: vi.fn(),
          createLawSourceIndexRecord: vi.fn(),
          getLawSourceIndexById: vi.fn(),
          updateLawSourceIndexEnabledState: vi.fn(),
        },
      ),
    ).rejects.toBeInstanceOf(LawSourceServerNotFoundError);
  });

  it("позволяет включать и отключать существующий источник", async () => {
    const updateLawSourceIndexEnabledState = vi.fn().mockResolvedValue({
      id: "source-1",
      isEnabled: false,
    });

    const result = await setLawSourceIndexEnabledState(
      {
        sourceIndexId: "source-1",
        isEnabled: false,
      },
      {
        getServerById: vi.fn(),
        countLawSourceIndexesByServer: vi.fn(),
        findLawSourceIndexByServerAndUrl: vi.fn(),
        createLawSourceIndexRecord: vi.fn(),
        getLawSourceIndexById: vi.fn().mockResolvedValue({
          id: "source-1",
          isEnabled: true,
        }),
        updateLawSourceIndexEnabledState,
      },
    );

    expect(result.isEnabled).toBe(false);
    expect(updateLawSourceIndexEnabledState).toHaveBeenCalledWith({
      sourceIndexId: "source-1",
      isEnabled: false,
    });
  });

  it("безопасно отклоняет toggle для несуществующего источника", async () => {
    await expect(
      setLawSourceIndexEnabledState(
        {
          sourceIndexId: "missing-source",
          isEnabled: false,
        },
        {
          getServerById: vi.fn(),
          countLawSourceIndexesByServer: vi.fn(),
          findLawSourceIndexByServerAndUrl: vi.fn(),
          createLawSourceIndexRecord: vi.fn(),
          getLawSourceIndexById: vi.fn().mockResolvedValue(null),
          updateLawSourceIndexEnabledState: vi.fn(),
        },
      ),
    ).rejects.toBeInstanceOf(LawSourceIndexNotFoundError);
  });
});
