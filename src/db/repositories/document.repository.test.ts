import { describe, expect, it, vi } from "vitest";

import {
  markAttorneyRequestGeneratedRecord,
  updateDocumentDraftRecord,
} from "@/db/repositories/document.repository";

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

  it("повторная генерация attorney_request сохраняет последние артефакты и сбрасывает modified flag", async () => {
    const db = {
      document: {
        findUnique: vi.fn().mockResolvedValue({
          id: "attorney-request-1",
          documentType: "attorney_request",
        }),
        update: vi.fn().mockResolvedValue({
          id: "attorney-request-1",
          status: "generated",
          isModifiedAfterGeneration: false,
          generatedArtifactText: "new preview",
          server: {
            id: "server-1",
            code: "blackberry",
            name: "Blackberry",
          },
        }),
      },
    };

    await markAttorneyRequestGeneratedRecord(
      {
        documentId: "attorney-request-1",
        generatedArtifactJson: {
          family: "attorney_request",
          format: "attorney_request_preview_pdf_png_jpg_v2",
          rendererVersion: "attorney_request_renderer_v13_png_export_pass",
          previewHtml: "<main>preview</main>",
          previewText: "new preview",
          pdfDataUrl: "data:application/pdf;base64,JVBERi0=",
          pngDataUrl: "data:image/png;base64,iVBORw0KGgo=",
          jpgDataUrl: "data:image/jpeg;base64,/9g=",
          pageCount: 1,
          blockingReasons: [],
        },
        generatedArtifactText: "new preview",
        generatedAt: new Date("2026-04-23T12:00:00.000Z"),
        generatedFormSchemaVersion: "attorney_request_v1",
        generatedOutputFormat: "attorney_request_preview_pdf_png_jpg_v2",
        generatedRendererVersion: "attorney_request_renderer_v13_png_export_pass",
      },
      db as never,
    );

    expect(db.document.update).toHaveBeenCalledWith({
      where: {
        id: "attorney-request-1",
      },
      data: expect.objectContaining({
        status: "generated",
        generatedArtifactText: "new preview",
        isModifiedAfterGeneration: false,
        publicationUrl: null,
      }),
      include: {
        server: true,
      },
    });
  });
});
