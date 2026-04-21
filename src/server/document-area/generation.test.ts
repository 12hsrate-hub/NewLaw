import { describe, expect, it, vi } from "vitest";

import {
  DocumentPublicationMetadataStateError,
  generateOwnedOgpComplaintBbcode,
  OGP_COMPLAINT_BBCODE_TEMPLATE_VERSION,
  updateOwnedDocumentPublicationMetadata,
} from "@/server/document-area/generation";
import { DocumentAccessDeniedError } from "@/server/document-area/persistence";

function createBaseDocument() {
  return {
    id: "document-1",
    accountId: "00000000-0000-0000-0000-000000000001",
    serverId: "server-1",
    characterId: "character-1",
    documentType: "ogp_complaint" as const,
    title: "Жалоба в ОГП",
    status: "draft" as const,
    formSchemaVersion: "ogp_complaint_mvp_editor_v1",
    snapshotCapturedAt: new Date("2026-04-21T10:00:00.000Z"),
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
      capturedAt: "2026-04-21T10:00:00.000Z",
    },
    formPayloadJson: {
      filingMode: "self",
      appealNumber: "OGP-001",
      objectOrganization: "LSPD",
      objectFullName: "Officer Smoke",
      incidentAt: "2026-04-21T10:15",
      situationDescription: "Описание ситуации",
      violationSummary: "Описание нарушения",
      workingNotes: "Черновая заметка",
      trustorSnapshot: null,
      evidenceGroups: [
        {
          id: "group-1",
          title: "Видео",
          rows: [
            {
              id: "row-1",
              label: "Запись с бодикамеры",
              url: "https://example.com/bodycam",
              note: "Основная ссылка",
            },
          ],
        },
      ],
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
    createdAt: new Date("2026-04-21T10:00:00.000Z"),
    updatedAt: new Date("2026-04-21T10:10:00.000Z"),
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
      createdAt: new Date("2026-04-21T10:00:00.000Z"),
      updatedAt: new Date("2026-04-21T10:00:00.000Z"),
      roles: [{ roleKey: "lawyer" }],
      accessFlags: [{ flagKey: "advocate" }],
    },
  };
}

describe("document generation", () => {
  it("генерирует deterministic BBCode для self filing и обновляет generation metadata", async () => {
    const baseDocument = createBaseDocument();
    const markDocumentGeneratedRecord = vi.fn().mockResolvedValue({
      ...baseDocument,
      status: "generated",
      lastGeneratedBbcode: "[center][b]ЖАЛОБА В ОГП[/b][/center]",
      generatedAt: new Date("2026-04-21T12:00:00.000Z"),
      generatedLawVersion: "current_primary_snapshot_v1:server-1:1:abc",
      generatedTemplateVersion: OGP_COMPLAINT_BBCODE_TEMPLATE_VERSION,
      generatedFormSchemaVersion: "ogp_complaint_mvp_editor_v1",
      updatedAt: new Date("2026-04-21T12:00:00.000Z"),
    });

    const result = await generateOwnedOgpComplaintBbcode(
      {
        accountId: "00000000-0000-0000-0000-000000000001",
        documentId: "document-1",
      },
      {
        getDocumentByIdForAccount: vi.fn().mockResolvedValue(baseDocument),
        listCurrentPrimaryLawVersionIdsByServer: vi.fn().mockResolvedValue(["law-version-1"]),
        markDocumentGeneratedRecord,
        updateDocumentPublicationMetadataRecord: vi.fn(),
        now: () => new Date("2026-04-21T12:00:00.000Z"),
      },
    );

    expect(markDocumentGeneratedRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: "document-1",
        generatedTemplateVersion: OGP_COMPLAINT_BBCODE_TEMPLATE_VERSION,
        generatedFormSchemaVersion: "ogp_complaint_mvp_editor_v1",
      }),
    );
    expect(markDocumentGeneratedRecord.mock.calls[0]?.[0].lastGeneratedBbcode).toContain("ЖАЛОБА В ОГП");
    expect(markDocumentGeneratedRecord.mock.calls[0]?.[0].lastGeneratedBbcode).toContain("Номер обращения:");
    expect(markDocumentGeneratedRecord.mock.calls[0]?.[0].lastGeneratedBbcode).toContain("OGP-001");
    expect(markDocumentGeneratedRecord.mock.calls[0]?.[0].lastGeneratedBbcode).toContain("Запись с бодикамеры");
    expect(result.status).toBe("generated");
  });

  it("для representative filing использует trustor snapshot в BBCode", async () => {
    const baseDocument = createBaseDocument();
    const markDocumentGeneratedRecord = vi.fn().mockResolvedValue({
      ...baseDocument,
      status: "generated",
      lastGeneratedBbcode: "[b]Доверитель:[/b] Пётр Доверитель",
      generatedAt: new Date("2026-04-21T12:00:00.000Z"),
      generatedLawVersion: "current_primary_snapshot_v1:server-1:1:abc",
      generatedTemplateVersion: OGP_COMPLAINT_BBCODE_TEMPLATE_VERSION,
      generatedFormSchemaVersion: "ogp_complaint_mvp_editor_v1",
      updatedAt: new Date("2026-04-21T12:00:00.000Z"),
    });

    await generateOwnedOgpComplaintBbcode(
      {
        accountId: "00000000-0000-0000-0000-000000000001",
        documentId: "document-1",
      },
      {
        getDocumentByIdForAccount: vi.fn().mockResolvedValue({
          ...baseDocument,
          formPayloadJson: {
            ...baseDocument.formPayloadJson,
            filingMode: "representative",
            trustorSnapshot: {
              sourceType: "inline_manual",
              fullName: "Пётр Доверитель",
              passportNumber: "TR-001",
              note: "Действую по доверенности",
            },
          },
        }),
        listCurrentPrimaryLawVersionIdsByServer: vi.fn().mockResolvedValue(["law-version-1"]),
        markDocumentGeneratedRecord,
        updateDocumentPublicationMetadataRecord: vi.fn(),
        now: () => new Date("2026-04-21T12:00:00.000Z"),
      },
    );

    expect(markDocumentGeneratedRecord.mock.calls[0]?.[0].lastGeneratedBbcode).toContain("Доверитель:");
    expect(markDocumentGeneratedRecord.mock.calls[0]?.[0].lastGeneratedBbcode).toContain("Пётр Доверитель");
    expect(markDocumentGeneratedRecord.mock.calls[0]?.[0].lastGeneratedBbcode).toContain("TR-001");
  });

  it("блокирует generation при неполном профиле и неполном payload", async () => {
    await expect(
      generateOwnedOgpComplaintBbcode(
        {
          accountId: "00000000-0000-0000-0000-000000000001",
          documentId: "document-1",
        },
        {
          getDocumentByIdForAccount: vi.fn().mockResolvedValue({
            ...createBaseDocument(),
            authorSnapshotJson: {
              ...createBaseDocument().authorSnapshotJson,
              isProfileComplete: false,
            },
            formPayloadJson: {
              ...createBaseDocument().formPayloadJson,
              appealNumber: "",
              violationSummary: "",
            },
          }),
          listCurrentPrimaryLawVersionIdsByServer: vi.fn(),
          markDocumentGeneratedRecord: vi.fn(),
          updateDocumentPublicationMetadataRecord: vi.fn(),
          now: () => new Date("2026-04-21T12:00:00.000Z"),
        },
      ),
    ).rejects.toMatchObject({
      reasons: expect.arrayContaining(["profile_incomplete", "appeal_number_missing", "violation_summary_missing"]),
    });
  });

  it("publication_url валидируется и обновляется только после generation", async () => {
    const baseDocument = createBaseDocument();
    const updateDocumentPublicationMetadataRecord = vi.fn().mockResolvedValue({
      ...baseDocument,
      status: "published",
      publicationUrl: "https://forum.gta5rp.com/topic/123",
      isSiteForumSynced: true,
      generatedAt: new Date("2026-04-21T12:00:00.000Z"),
      updatedAt: new Date("2026-04-21T12:30:00.000Z"),
      server: baseDocument.server,
    });

    const result = await updateOwnedDocumentPublicationMetadata(
      {
        accountId: "00000000-0000-0000-0000-000000000001",
        documentId: "document-1",
        publicationUrl: "https://forum.gta5rp.com/topic/123",
        isSiteForumSynced: true,
      },
      {
        getDocumentByIdForAccount: vi.fn().mockResolvedValue({
          ...baseDocument,
          status: "generated",
          generatedAt: new Date("2026-04-21T12:00:00.000Z"),
          lastGeneratedBbcode: "bbcode",
        }),
        listCurrentPrimaryLawVersionIdsByServer: vi.fn(),
        markDocumentGeneratedRecord: vi.fn(),
        updateDocumentPublicationMetadataRecord,
        now: () => new Date("2026-04-21T12:00:00.000Z"),
      },
    );

    expect(updateDocumentPublicationMetadataRecord).toHaveBeenCalledWith({
      documentId: "document-1",
      publicationUrl: "https://forum.gta5rp.com/topic/123",
      isSiteForumSynced: true,
    });
    expect(result.status).toBe("published");
    expect(result.publicationUrl).toBe("https://forum.gta5rp.com/topic/123");
  });

  it("не даёт обновлять publication metadata до первой generation", async () => {
    await expect(
      updateOwnedDocumentPublicationMetadata(
        {
          accountId: "00000000-0000-0000-0000-000000000001",
          documentId: "document-1",
          publicationUrl: "https://forum.gta5rp.com/topic/123",
          isSiteForumSynced: true,
        },
        {
          getDocumentByIdForAccount: vi.fn().mockResolvedValue(createBaseDocument()),
          listCurrentPrimaryLawVersionIdsByServer: vi.fn(),
          markDocumentGeneratedRecord: vi.fn(),
          updateDocumentPublicationMetadataRecord: vi.fn(),
          now: () => new Date("2026-04-21T12:00:00.000Z"),
        },
      ),
    ).rejects.toBeInstanceOf(DocumentPublicationMetadataStateError);
  });

  it("не даёт генерировать и обновлять publication metadata для чужого документа", async () => {
    await expect(
      generateOwnedOgpComplaintBbcode(
        {
          accountId: "00000000-0000-0000-0000-000000000001",
          documentId: "document-404",
        },
        {
          getDocumentByIdForAccount: vi.fn().mockResolvedValue(null),
          listCurrentPrimaryLawVersionIdsByServer: vi.fn(),
          markDocumentGeneratedRecord: vi.fn(),
          updateDocumentPublicationMetadataRecord: vi.fn(),
          now: () => new Date("2026-04-21T12:00:00.000Z"),
        },
      ),
    ).rejects.toBeInstanceOf(DocumentAccessDeniedError);

    await expect(
      updateOwnedDocumentPublicationMetadata(
        {
          accountId: "00000000-0000-0000-0000-000000000001",
          documentId: "document-404",
          publicationUrl: "",
          isSiteForumSynced: false,
        },
        {
          getDocumentByIdForAccount: vi.fn().mockResolvedValue(null),
          listCurrentPrimaryLawVersionIdsByServer: vi.fn(),
          markDocumentGeneratedRecord: vi.fn(),
          updateDocumentPublicationMetadataRecord: vi.fn(),
          now: () => new Date("2026-04-21T12:00:00.000Z"),
        },
      ),
    ).rejects.toBeInstanceOf(DocumentAccessDeniedError);
  });
});
