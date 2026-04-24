import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  markAttorneyRequestGeneratedRecord,
  markLegalServicesAgreementGeneratedRecord,
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
          rendererVersion: "attorney_request_renderer_v25_signature_snapshot_pass",
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
        generatedRendererVersion: "attorney_request_renderer_v25_signature_snapshot_pass",
        signatureSnapshotJson: {
          signatureId: "signature-1",
          storagePath: "servers/server-1/characters/character-1/signatures/signature-1.png",
          mimeType: "image/png",
          width: 600,
          height: 200,
          fileSize: 180000,
        },
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
        signatureSnapshotJson: {
          signatureId: "signature-1",
          storagePath: "servers/server-1/characters/character-1/signatures/signature-1.png",
          mimeType: "image/png",
          width: 600,
          height: 200,
          fileSize: 180000,
        },
        isModifiedAfterGeneration: false,
        publicationUrl: null,
      }),
      include: {
        server: true,
      },
    });
  });

  it("генерация legal_services_agreement сохраняет postраничный artifact без image-signature snapshot", async () => {
    const db = {
      document: {
        findUnique: vi.fn().mockResolvedValue({
          id: "agreement-1",
          documentType: "legal_services_agreement",
          signatureSnapshotJson: null,
        }),
        update: vi.fn().mockResolvedValue({
          id: "agreement-1",
          status: "generated",
          isModifiedAfterGeneration: false,
          generatedArtifactText: "preview",
          server: {
            id: "server-1",
            code: "blackberry",
            name: "Blackberry",
          },
        }),
      },
    };

    await markLegalServicesAgreementGeneratedRecord(
      {
        documentId: "agreement-1",
        generatedArtifactJson: {
          family: "legal_services_agreement",
          format: "legal_services_agreement_png_pages_v1",
          templateVersion: "legal_services_agreement_reference_pdf_v1",
          rendererVersion: "legal_services_agreement_print_template_page1_v42",
          referenceState: "ready",
          previewHtml: "<main>preview</main>",
          previewText: "preview",
          blockingReasons: [],
          pageCount: 5,
          pages: [
            {
              pageNumber: 1,
              fileName: "DomPerignon_NickName_p1.png",
              pngDataUrl: "data:image/png;base64,iVBORw0KGgo=",
              width: 953,
              height: 1348,
            },
            {
              pageNumber: 2,
              fileName: "DomPerignon_NickName_p2.png",
              pngDataUrl: "data:image/png;base64,iVBORw0KGgo=",
              width: 953,
              height: 1348,
            },
            {
              pageNumber: 3,
              fileName: "DomPerignon_NickName_p3.png",
              pngDataUrl: "data:image/png;base64,iVBORw0KGgo=",
              width: 953,
              height: 1348,
            },
            {
              pageNumber: 4,
              fileName: "DomPerignon_NickName_p4.png",
              pngDataUrl: "data:image/png;base64,iVBORw0KGgo=",
              width: 953,
              height: 1348,
            },
            {
              pageNumber: 5,
              fileName: "DomPerignon_NickName_p5.png",
              pngDataUrl: "data:image/png;base64,iVBORw0KGgo=",
              width: 953,
              height: 1348,
            },
          ],
        },
        generatedArtifactText: "preview",
        generatedAt: new Date("2026-04-24T12:00:00.000Z"),
        generatedFormSchemaVersion: "legal_services_agreement_contract_v1",
        generatedOutputFormat: "legal_services_agreement_png_pages_v1",
        generatedRendererVersion: "legal_services_agreement_print_template_page1_v42",
      },
      db as never,
    );

    expect(db.document.update).toHaveBeenCalledWith({
      where: {
        id: "agreement-1",
      },
      data: expect.objectContaining({
        status: "generated",
        generatedArtifactText: "preview",
        generatedOutputFormat: "legal_services_agreement_png_pages_v1",
        signatureSnapshotJson: Prisma.JsonNull,
        isModifiedAfterGeneration: false,
      }),
      include: {
        server: true,
      },
    });
  });
});
