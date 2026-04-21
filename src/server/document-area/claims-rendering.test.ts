import { describe, expect, it, vi } from "vitest";

import {
  CLAIMS_STRUCTURED_PREVIEW_FORMAT,
  CLAIMS_STRUCTURED_RENDERER_VERSION,
  renderOwnedClaimsStructuredPreview,
} from "@/server/document-area/claims-rendering";
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
                  {
                    id: "row-2",
                    label: "Вторая ссылка",
                    url: "",
                    note: "",
                  },
                ],
              },
            ],
            courtName: "Верховный суд",
            defendantName: "Ответчик",
            claimAmount: "150000",
            pretrialSummary: "Досудебная претензия направлялась",
          },
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
      updatedAt: new Date("2026-04-22T10:10:00.000Z"),
      roles: [{ roleKey: "lawyer" }],
      accessFlags: [{ flagKey: "advocate" }],
    },
  };
}

describe("claims rendering", () => {
  it("строит deterministic structured preview для rehabilitation и copyText остаётся консистентным", async () => {
    const document = createBaseClaimsDocument("rehabilitation");

    const result = await renderOwnedClaimsStructuredPreview(
      {
        accountId: document.accountId,
        documentId: document.id,
      },
      {
        getDocumentByIdForAccount: vi.fn().mockResolvedValue(document),
      },
    );

    expect(result.family).toBe("claims");
    expect(result.documentType).toBe("rehabilitation");
    expect(result.format).toBe(CLAIMS_STRUCTURED_PREVIEW_FORMAT);
    expect(result.rendererVersion).toBe(CLAIMS_STRUCTURED_RENDERER_VERSION);
    expect(result.blockingReasons).toEqual([]);
    expect(result.sections.map((section) => section.title)).toEqual([
      "Документ",
      "Режим подачи",
      "Заявитель",
      "Ответчик / орган",
      "Предмет требования",
      "Rehabilitation-specific section",
      "Фактические обстоятельства",
      "Правовые основания",
      "Просительная часть",
      "Доказательства",
      "Рабочие заметки",
    ]);
    expect(result.copyText).toBe(
      result.sections.map((section) => `${section.title}\n${section.body}`).join("\n\n"),
    );
    expect(result.copyText).toContain("CASE-1");
    expect(result.copyText).toContain("https://example.com/rehab-1");
  });

  it("для lawsuit representative filing включает trustor section и evidence rows", async () => {
    const document = createBaseClaimsDocument("lawsuit");

    const result = await renderOwnedClaimsStructuredPreview(
      {
        accountId: document.accountId,
        documentId: document.id,
      },
      {
        getDocumentByIdForAccount: vi.fn().mockResolvedValue(document),
      },
    );

    expect(result.sections.some((section) => section.key === "trustor")).toBe(true);
    expect(result.copyText).toContain("Пётр Доверитель");
    expect(result.copyText).toContain("TR-001");
    expect(result.copyText).toContain("https://example.com/lawsuit-1");
    expect(result.copyText).toContain("Ссылка не указана");
    expect(result.copyText).toContain("Claim amount: 150000");
  });

  it("для self filing не показывает trustor section", async () => {
    const document = createBaseClaimsDocument("rehabilitation");

    const result = await renderOwnedClaimsStructuredPreview(
      {
        accountId: document.accountId,
        documentId: document.id,
      },
      {
        getDocumentByIdForAccount: vi.fn().mockResolvedValue(document),
      },
    );

    expect(result.sections.some((section) => section.key === "trustor")).toBe(false);
  });

  it("честно блокирует renderer при неполном profile и payload", async () => {
    const document = createBaseClaimsDocument("lawsuit");

    await expect(
      renderOwnedClaimsStructuredPreview(
        {
          accountId: document.accountId,
          documentId: document.id,
        },
        {
          getDocumentByIdForAccount: vi.fn().mockResolvedValue({
            ...document,
            authorSnapshotJson: {
              ...document.authorSnapshotJson,
              isProfileComplete: false,
            },
            formPayloadJson: {
              ...document.formPayloadJson,
              respondentName: "",
              claimSubject: "",
              courtName: "",
              trustorSnapshot: {
                sourceType: "inline_manual",
                fullName: "",
                passportNumber: "",
                note: "",
              },
            },
          }),
        },
      ),
    ).rejects.toMatchObject({
      reasons: expect.arrayContaining([
        "profile_incomplete",
        "respondent_name_missing",
        "claim_subject_missing",
        "court_name_missing",
        "trustor_full_name_missing",
        "trustor_passport_missing",
      ]),
    });
  });

  it("не даёт строить preview для чужого или не-claims документа", async () => {
    await expect(
      renderOwnedClaimsStructuredPreview(
        {
          accountId: "00000000-0000-0000-0000-000000000001",
          documentId: "document-404",
        },
        {
          getDocumentByIdForAccount: vi.fn().mockResolvedValue(null),
        },
      ),
    ).rejects.toBeInstanceOf(DocumentAccessDeniedError);

    await expect(
      renderOwnedClaimsStructuredPreview(
        {
          accountId: "00000000-0000-0000-0000-000000000001",
          documentId: "document-ogp",
        },
        {
          getDocumentByIdForAccount: vi.fn().mockResolvedValue({
            ...createBaseClaimsDocument("rehabilitation"),
            documentType: "ogp_complaint",
          }),
        },
      ),
    ).rejects.toBeInstanceOf(DocumentAccessDeniedError);
  });
});
