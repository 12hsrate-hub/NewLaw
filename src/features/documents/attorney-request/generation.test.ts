import { beforeEach, describe, expect, it, vi } from "vitest";

const repositoryMocks = vi.hoisted(() => ({
  createDocumentRecord: vi.fn(),
  getDocumentByIdForAccount: vi.fn(),
  markAttorneyRequestGeneratedRecord: vi.fn(),
  updateDocumentDraftRecord: vi.fn(),
  updateDocumentAuthorSnapshotRecord: vi.fn(),
}));

const signatureServiceMocks = vi.hoisted(() => ({
  buildCharacterSignatureSnapshotFromActiveSignature: vi.fn(),
  loadCharacterSignatureDataUrl: vi.fn(),
}));

const renderMocks = vi.hoisted(() => ({
  renderAttorneyRequestArtifact: vi.fn(),
}));

vi.mock("@/db/repositories/document.repository", () => ({
  createDocumentRecord: repositoryMocks.createDocumentRecord,
  getDocumentByIdForAccount: repositoryMocks.getDocumentByIdForAccount,
  markAttorneyRequestGeneratedRecord: repositoryMocks.markAttorneyRequestGeneratedRecord,
  updateDocumentDraftRecord: repositoryMocks.updateDocumentDraftRecord,
  updateDocumentAuthorSnapshotRecord: repositoryMocks.updateDocumentAuthorSnapshotRecord,
}));

vi.mock("@/server/character-signatures/service", () => ({
  buildCharacterSignatureSnapshotFromActiveSignature:
    signatureServiceMocks.buildCharacterSignatureSnapshotFromActiveSignature,
  loadCharacterSignatureDataUrl: signatureServiceMocks.loadCharacterSignatureDataUrl,
}));

vi.mock("@/features/documents/attorney-request/render", async () => {
  const actual = await vi.importActual<typeof import("@/features/documents/attorney-request/render")>(
    "@/features/documents/attorney-request/render",
  );

  return {
    ...actual,
    renderAttorneyRequestArtifact: renderMocks.renderAttorneyRequestArtifact,
  };
});

import { generateOwnedAttorneyRequestArtifacts } from "@/features/documents/attorney-request/generation";

function buildDocument() {
  return {
    id: "attorney-request-1",
    accountId: "account-1",
    serverId: "server-1",
    characterId: "character-1",
    documentType: "attorney_request" as const,
    title: "Адвокатский запрос",
    formSchemaVersion: "attorney_request_v1",
    signatureSnapshotJson: null,
    authorSnapshotJson: {
      characterId: "character-1",
      serverId: "server-1",
      serverCode: "blackberry",
      serverName: "Blackberry",
      fullName: "Игорь Юристов",
      nickname: "Igor",
      passportNumber: "123456",
      position: "Адвокат",
      address: "Дом 10",
      phone: "123-45-67",
      icEmail: "lawyer@sa.com",
      passportImageUrl: "https://example.com/passport.png",
      isProfileComplete: true,
      roleKeys: ["lawyer"],
      accessFlags: ["advocate"],
      capturedAt: "2026-04-23T09:00:00.000Z",
    },
    formPayloadJson: {
      requestNumberRawInput: "2112",
      requestNumberNormalized: "BAR-2112",
      contractNumber: "DOG-100",
      addresseePreset: "LSPD_CHIEF",
      targetOfficerInput: "Badge #42",
      requestDate: "2026-04-23",
      timeFrom: "23:40",
      timeTo: "00:20",
      crossesMidnight: true,
      periodStartAt: "2026-04-23T20:40:00.000Z",
      periodEndAt: "2026-04-23T21:20:00.000Z",
      startedAtMsk: "2026-04-23T09:00:00.000Z",
      documentDateMsk: "23.04.2026",
      responseDueAtMsk: "2026-04-24T11:00:00.000Z",
      signerTitleSnapshot: {
        sourceTitle: "Адвокат",
        leftColumnEn: "Lawyer",
        bodyRu: "Адвокат Штата Сан-Андреас",
        footerRu: "Адвокат",
      },
      trustorSnapshot: {
        trustorId: "trustor-1",
        fullName: "Павел Доверитель",
        passportNumber: "123456",
        phone: "123-45-67",
        icEmail: "trustor@sa.com",
        passportImageUrl: "https://example.com/trustor.png",
        note: "",
      },
      section1Items: [
        { id: "1", text: "Раздел 1.1" },
        { id: "2", text: "Раздел 1.2" },
        { id: "3", text: "Раздел 1.3" },
      ],
      section3Text: "Раздел 3",
      validationState: {},
      workingNotes: "",
    },
    generatedArtifactJson: null,
    generatedAt: null,
    character: {
      activeSignature: null as
        | null
        | {
            id: string;
            storagePath: string;
            mimeType: string;
            width: number;
            height: number;
            fileSize: number;
          },
    },
    server: {
      id: "server-1",
      code: "blackberry",
      name: "Blackberry",
    },
  };
}

describe("generateOwnedAttorneyRequestArtifacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("блокирует генерацию без frozen и active подписи", async () => {
    repositoryMocks.getDocumentByIdForAccount.mockResolvedValue(buildDocument());
    signatureServiceMocks.buildCharacterSignatureSnapshotFromActiveSignature.mockReturnValue(null);

    await expect(
      generateOwnedAttorneyRequestArtifacts({
        accountId: "account-1",
        documentId: "attorney-request-1",
      }),
    ).rejects.toMatchObject({
      name: "AttorneyRequestGenerationBlockedError",
      reasons: ["Для генерации адвокатского запроса необходимо загрузить подпись персонажа."],
    });
  });

  it("фиксирует активную подпись персонажа при первой генерации, если snapshot ещё не сохранён", async () => {
    const document = buildDocument();
    document.character.activeSignature = {
      id: "signature-1",
      storagePath: "servers/server-1/characters/character-1/signatures/signature-1.png",
      mimeType: "image/png",
      width: 600,
      height: 200,
      fileSize: 180000,
    };
    const signatureSnapshot = {
      signatureId: "signature-1",
      storagePath: "servers/server-1/characters/character-1/signatures/signature-1.png",
      mimeType: "image/png",
      width: 600,
      height: 200,
      fileSize: 180000,
    };

    repositoryMocks.getDocumentByIdForAccount.mockResolvedValue(document);
    signatureServiceMocks.buildCharacterSignatureSnapshotFromActiveSignature.mockReturnValue(signatureSnapshot);
    signatureServiceMocks.loadCharacterSignatureDataUrl.mockResolvedValue("data:image/png;base64,AAA=");
    renderMocks.renderAttorneyRequestArtifact.mockResolvedValue({
      family: "attorney_request",
      format: "attorney_request_preview_pdf_png_jpg_v2",
      rendererVersion: "attorney_request_renderer_v25_signature_snapshot_pass",
      previewHtml: "<main>preview</main>",
      previewText: "preview",
      pdfDataUrl: "data:application/pdf;base64,JVBERi0=",
      pngDataUrl: "data:image/png;base64,iVBORw0KGgo=",
      jpgDataUrl: "data:image/jpeg;base64,/9g=",
      pageCount: 1,
      blockingReasons: [],
    });
    repositoryMocks.markAttorneyRequestGeneratedRecord.mockResolvedValue({
      id: "attorney-request-1",
      status: "generated",
      generatedAt: new Date("2026-04-23T12:00:00.000Z"),
      generatedOutputFormat: "attorney_request_preview_pdf_png_jpg_v2",
        generatedRendererVersion: "attorney_request_renderer_v25_signature_snapshot_pass",
      isModifiedAfterGeneration: false,
      server: {
        id: "server-1",
        code: "blackberry",
        name: "Blackberry",
      },
    });

    await generateOwnedAttorneyRequestArtifacts({
      accountId: "account-1",
      documentId: "attorney-request-1",
    });

    expect(renderMocks.renderAttorneyRequestArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        signatureDataUrl: "data:image/png;base64,AAA=",
      }),
    );
    expect(repositoryMocks.markAttorneyRequestGeneratedRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        signatureSnapshotJson: signatureSnapshot,
      }),
    );
  });
});
