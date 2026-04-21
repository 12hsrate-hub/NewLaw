import { describe, expect, it, vi } from "vitest";

import { updateDocumentDraftRecord } from "@/db/repositories/document.repository";

describe("document.repository", () => {
  it("правка generated claims документа помечает modified_after_generation и сбрасывает forum sync", async () => {
    const db = {
      document: {
        findUnique: vi.fn().mockResolvedValue({
          id: "claim-1",
          title: "Документ по реабилитации",
          status: "generated",
          formPayloadJson: {
            filingMode: "self",
            respondentName: "LSPD",
          },
          isModifiedAfterGeneration: false,
          isSiteForumSynced: true,
        }),
        update: vi.fn().mockResolvedValue({
          id: "claim-1",
          title: "Документ по реабилитации",
          status: "generated",
          isModifiedAfterGeneration: true,
          isSiteForumSynced: false,
          server: {
            id: "server-1",
            code: "blackberry",
            name: "Blackberry",
          },
        }),
      },
    };

    await updateDocumentDraftRecord(
      {
        documentId: "claim-1",
        title: "Документ по реабилитации (обновлён)",
        formPayloadJson: {
          filingMode: "self",
          respondentName: "LSSD",
        },
      },
      db as never,
    );

    expect(db.document.update).toHaveBeenCalledWith({
      where: {
        id: "claim-1",
      },
      data: expect.objectContaining({
        isModifiedAfterGeneration: true,
        isSiteForumSynced: false,
      }),
      include: {
        server: true,
      },
    });
  });
});
