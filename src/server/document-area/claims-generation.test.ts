import { describe, expect, it, vi } from "vitest";

import { generateOwnedClaimsStructuredCheckpoint } from "@/server/document-area/claims-generation";
import { ClaimsOutputBlockedError } from "@/server/document-area/claims-rendering";
import { DocumentAccessDeniedError } from "@/server/document-area/persistence";

function createBaseClaimsDocument(documentType: "rehabilitation" | "lawsuit") {
  return {
    id: "claim-1",
    accountId: "00000000-0000-0000-0000-000000000001",
    serverId: "server-1",
    characterId: "character-1",
    documentType,
    title: documentType === "rehabilitation" ? "Документ по реабилитации" : "Исковое заявление",
    status: "draft" as const,
    formSchemaVersion:
      documentType === "rehabilitation"
        ? "rehabilitation_claim_mvp_editor_v1"
        : "lawsuit_claim_mvp_editor_v1",
    snapshotCapturedAt: new Date("2026-04-22T10:00:00.000Z"),
    authorSnapshotJson: {
      characterId: "character-1",
      serverId: "server-1",
      serverCode: "blackberry",
      serverName: "Blackberry",
      fullName: "Игорь Юристов",
      nickname: "Игорь Юристов",
      passportNumber: "AA-001",
      isProfileComplete: true,
      roleKeys: ["lawyer"],
      accessFlags: ["advocate"],
      capturedAt: "2026-04-22T10:00:00.000Z",
    },
    formPayloadJson:
      documentType === "rehabilitation"
        ? {
            filingMode: "self",
            respondentName: "LSPD",
            claimSubject: "Реабилитация и восстановление прав",
            factualBackground: "Фактические обстоятельства дела",
            legalBasisSummary: "Правовые основания и ссылки на нормы",
            requestedRelief: "Прошу признать право на реабилитацию",
            workingNotes: "Внутренняя заметка",
            trustorSnapshot: null,
            evidenceGroups: [
              {
                id: "group-1",
                title: "Материалы дела",
                rows: [
                  {
                    id: "row-1",
                    label: "Ссылка на решение",
                    url: "https://example.com/rehab-1",
                    note: "Основное доказательство",
                  },
                ],
              },
            ],
            caseReference: "CASE-1",
            rehabilitationBasis: "Основания для реабилитации",
            harmSummary: "Описание причинённого вреда",
          }
        : {
            filingMode: "representative",
            respondentName: "LSSD",
            claimSubject: "Оспаривание действий",
            factualBackground: "Фактические обстоятельства по иску",
            legalBasisSummary: "Правовые основания по иску",
            requestedRelief: "Прошу удовлетворить иск",
            workingNotes: "Внутренняя заметка по иску",
            trustorSnapshot: {
              sourceType: "inline_manual",
              fullName: "Пётр Доверитель",
              passportNumber: "TR-001",
              note: "Действую по доверенности",
            },
            evidenceGroups: [
              {
                id: "group-1",
                title: "Доказательства",
                rows: [
                  {
                    id: "row-1",
                    label: "Видео",
                    url: "https://example.com/lawsuit-1",
                    note: "Основная ссылка",
                  },
                ],
              },
            ],
            courtName: "Верховный суд",
            defendantName: "Ответчик",
            claimAmount: "150000",
            pretrialSummary: "Досудебная претензия направлялась",
          },
    generatedArtifactJson: null,
    generatedArtifactText: null,
    generatedOutputFormat: null,
    generatedRendererVersion: null,
    lastGeneratedBbcode: null,
    generatedAt: null,
    generatedLawVersion: null,
    generatedTemplateVersion: null,
    generatedFormSchemaVersion: null,
    publicationUrl: null,
    isSiteForumSynced: false,
    isModifiedAfterGeneration: false,
    deletedAt: null,
    createdAt: new Date("2026-04-22T10:00:00.000Z"),
    updatedAt: new Date("2026-04-22T10:10:00.000Z"),
    server: {
      id: "server-1",
      code: "blackberry",
      name: "Blackberry",
    },
    character: {
      id: "character-1",
      accountId: "00000000-0000-0000-0000-000000000001",
      serverId: "server-1",
      fullName: "Игорь Юристов",
      nickname: "Игорь Юристов",
      passportNumber: "AA-001",
      isProfileComplete: true,
      profileDataJson: null,
      deletedAt: null,
      createdAt: new Date("2026-04-22T10:00:00.000Z"),
      updatedAt: new Date("2026-04-22T10:00:00.000Z"),
      roles: [{ roleKey: "lawyer" }],
      accessFlags: [{ flagKey: "advocate" }],
    },
  };
}

describe("claims generation checkpoint", () => {
  it("успешный claims checkpoint переводит документ в generated и сохраняет persisted artifact", async () => {
    const baseDocument = createBaseClaimsDocument("rehabilitation");
    const markClaimsDocumentGeneratedRecord = vi.fn().mockResolvedValue({
      ...baseDocument,
      status: "generated",
      generatedArtifactJson: {
        family: "claims",
      },
      generatedArtifactText: "rendered preview",
      generatedOutputFormat: "claims_structured_preview_v1",
      generatedRendererVersion: "claims_structured_renderer_v1",
      generatedAt: new Date("2026-04-22T12:00:00.000Z"),
      generatedFormSchemaVersion: "rehabilitation_claim_mvp_editor_v1",
      updatedAt: new Date("2026-04-22T12:00:00.000Z"),
      isModifiedAfterGeneration: false,
    });

    const result = await generateOwnedClaimsStructuredCheckpoint(
      {
        accountId: baseDocument.accountId,
        documentId: baseDocument.id,
      },
      {
        getDocumentByIdForAccount: vi.fn().mockResolvedValue(baseDocument),
        markClaimsDocumentGeneratedRecord,
        now: () => new Date("2026-04-22T12:00:00.000Z"),
      },
    );

    expect(markClaimsDocumentGeneratedRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: baseDocument.id,
        generatedFormSchemaVersion: "rehabilitation_claim_mvp_editor_v1",
        generatedOutputFormat: "claims_structured_preview_v1",
        generatedRendererVersion: "claims_structured_renderer_v1",
      }),
    );
    expect(markClaimsDocumentGeneratedRecord.mock.calls[0]?.[0].generatedArtifactText).toContain(
      "CASE-1",
    );
    expect(markClaimsDocumentGeneratedRecord.mock.calls[0]?.[0].generatedArtifactJson).toMatchObject({
      family: "claims",
      documentType: "rehabilitation",
      format: "claims_structured_preview_v1",
    });
    expect(result.document.status).toBe("generated");
    expect(result.output.copyText).toContain("CASE-1");
  });

  it("regenerate обновляет persisted artifact и metadata", async () => {
    const baseDocument = createBaseClaimsDocument("lawsuit");
    const markClaimsDocumentGeneratedRecord = vi.fn()
      .mockResolvedValueOnce({
        ...baseDocument,
        status: "generated",
        generatedArtifactJson: { version: 1 },
        generatedArtifactText: "first",
        generatedOutputFormat: "claims_structured_preview_v1",
        generatedRendererVersion: "claims_structured_renderer_v1",
        generatedAt: new Date("2026-04-22T12:00:00.000Z"),
        generatedFormSchemaVersion: "lawsuit_claim_mvp_editor_v1",
        updatedAt: new Date("2026-04-22T12:00:00.000Z"),
        isModifiedAfterGeneration: false,
      })
      .mockResolvedValueOnce({
        ...baseDocument,
        status: "generated",
        generatedArtifactJson: { version: 2 },
        generatedArtifactText: "second",
        generatedOutputFormat: "claims_structured_preview_v1",
        generatedRendererVersion: "claims_structured_renderer_v1",
        generatedAt: new Date("2026-04-22T12:05:00.000Z"),
        generatedFormSchemaVersion: "lawsuit_claim_mvp_editor_v1",
        updatedAt: new Date("2026-04-22T12:05:00.000Z"),
        isModifiedAfterGeneration: false,
      });

    const firstDocument = baseDocument;
    const secondDocument = {
      ...baseDocument,
      formPayloadJson: {
        ...baseDocument.formPayloadJson,
        claimAmount: "250000",
      },
    };

    await generateOwnedClaimsStructuredCheckpoint(
      {
        accountId: baseDocument.accountId,
        documentId: baseDocument.id,
      },
      {
        getDocumentByIdForAccount: vi.fn().mockResolvedValueOnce(firstDocument),
        markClaimsDocumentGeneratedRecord,
        now: () => new Date("2026-04-22T12:00:00.000Z"),
      },
    );

    await generateOwnedClaimsStructuredCheckpoint(
      {
        accountId: baseDocument.accountId,
        documentId: baseDocument.id,
      },
      {
        getDocumentByIdForAccount: vi.fn().mockResolvedValueOnce(secondDocument),
        markClaimsDocumentGeneratedRecord,
        now: () => new Date("2026-04-22T12:05:00.000Z"),
      },
    );

    expect(markClaimsDocumentGeneratedRecord).toHaveBeenCalledTimes(2);
    expect(markClaimsDocumentGeneratedRecord.mock.calls[0]?.[0].generatedArtifactText).toContain(
      "Claim amount: 150000",
    );
    expect(markClaimsDocumentGeneratedRecord.mock.calls[1]?.[0].generatedArtifactText).toContain(
      "Claim amount: 250000",
    );
  });

  it("blocking reasons не позволяют перевести claims в generated", async () => {
    const markClaimsDocumentGeneratedRecord = vi.fn();

    await expect(
      generateOwnedClaimsStructuredCheckpoint(
        {
          accountId: "00000000-0000-0000-0000-000000000001",
          documentId: "claim-1",
        },
        {
          getDocumentByIdForAccount: vi.fn().mockResolvedValue({
            ...createBaseClaimsDocument("lawsuit"),
            authorSnapshotJson: {
              ...createBaseClaimsDocument("lawsuit").authorSnapshotJson,
              isProfileComplete: false,
            },
            formPayloadJson: {
              ...createBaseClaimsDocument("lawsuit").formPayloadJson,
              respondentName: "",
              trustorSnapshot: {
                sourceType: "inline_manual",
                fullName: "",
                passportNumber: "",
                note: "",
              },
            },
          }),
          markClaimsDocumentGeneratedRecord,
          now: () => new Date("2026-04-22T12:00:00.000Z"),
        },
      ),
    ).rejects.toBeInstanceOf(ClaimsOutputBlockedError);

    expect(markClaimsDocumentGeneratedRecord).not.toHaveBeenCalled();
  });

  it("owner-only generation checkpoint работает", async () => {
    await expect(
      generateOwnedClaimsStructuredCheckpoint(
        {
          accountId: "00000000-0000-0000-0000-000000000001",
          documentId: "claim-404",
        },
        {
          getDocumentByIdForAccount: vi.fn().mockResolvedValue(null),
          markClaimsDocumentGeneratedRecord: vi.fn(),
          now: () => new Date("2026-04-22T12:00:00.000Z"),
        },
      ),
    ).rejects.toBeInstanceOf(DocumentAccessDeniedError);
  });
});
