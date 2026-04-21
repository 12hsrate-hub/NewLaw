import { describe, expect, it, vi } from "vitest";

import {
  createInitialOgpComplaintDraft,
  DocumentAccessDeniedError,
  DocumentCharacterUnavailableError,
  DocumentRepresentativeAccessError,
  readOgpComplaintDraftPayload,
  saveOwnedDocumentDraft,
} from "@/server/document-area/persistence";

describe("document persistence foundation", () => {
  it("first save создаёт self draft и фиксирует author snapshot", async () => {
    const now = new Date("2026-04-21T05:00:00.000Z");
    const createDocumentRecord = vi.fn().mockResolvedValue({
      id: "document-1",
      status: "draft",
      updatedAt: now,
      server: {
        id: "server-1",
        code: "blackberry",
        name: "Blackberry",
      },
    });

    await createInitialOgpComplaintDraft(
      {
        accountId: "00000000-0000-0000-0000-000000000001",
        serverSlug: "blackberry",
        characterId: "character-1",
        title: "Жалоба в ОГП",
        payload: {
          filingMode: "self",
          workingNotes: "Черновая заметка",
          appealNumber: "OGP-001",
          evidenceGroups: [],
        },
      },
      {
        getServerByCode: vi.fn().mockResolvedValue({
          id: "server-1",
          code: "blackberry",
          name: "Blackberry",
        }),
        getCharacterByIdForAccount: vi.fn().mockResolvedValue({
          id: "character-1",
          accountId: "00000000-0000-0000-0000-000000000001",
          serverId: "server-1",
          fullName: "Игорь Юристов",
          nickname: "Игорь Юристов",
          passportNumber: "AA-001",
          isProfileComplete: true,
          roles: [{ roleKey: "lawyer" }],
          accessFlags: [{ flagKey: "advocate" }],
        }),
        createDocumentRecord,
        getDocumentByIdForAccount: vi.fn(),
        updateDocumentDraftRecord: vi.fn(),
        setActiveServerSelection: vi.fn().mockResolvedValue(undefined),
        setActiveCharacterSelection: vi.fn().mockResolvedValue(undefined),
        now: () => now,
      },
    );

    expect(createDocumentRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "00000000-0000-0000-0000-000000000001",
        serverId: "server-1",
        characterId: "character-1",
        documentType: "ogp_complaint",
        title: "Жалоба в ОГП",
        snapshotCapturedAt: now,
        formSchemaVersion: "ogp_complaint_mvp_editor_v1",
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
          capturedAt: now.toISOString(),
        },
        formPayloadJson: expect.objectContaining({
          filingMode: "self",
          appealNumber: "OGP-001",
          workingNotes: "Черновая заметка",
          trustorSnapshot: null,
        }),
      }),
    );
  });

  it("representative filing доступен только при advocate и сохраняет trustor snapshot с evidence rows", async () => {
    const createDocumentRecord = vi.fn().mockResolvedValue({
      id: "document-1",
      status: "draft",
      updatedAt: new Date("2026-04-21T05:00:00.000Z"),
      server: {
        id: "server-1",
        code: "blackberry",
        name: "Blackberry",
      },
    });

    await createInitialOgpComplaintDraft(
      {
        accountId: "00000000-0000-0000-0000-000000000001",
        serverSlug: "blackberry",
        characterId: "character-1",
        title: "Жалоба от представителя",
        payload: {
          filingMode: "representative",
          workingNotes: "Представительский draft",
          appealNumber: "OGP-REP-001",
          objectOrganization: "LSPD",
          objectFullName: "Сотрудник Полиции",
          incidentAt: "2026-04-21T10:30",
          situationDescription: "Подробное описание",
          violationSummary: "Краткое резюме нарушения",
          trustorSnapshot: {
            sourceType: "inline_manual",
            fullName: "Пётр Доверитель",
            passportNumber: "TR-001",
            note: "Действую по доверенности",
          },
          evidenceGroups: [
            {
              id: "group-1",
              title: "Видео",
              rows: [
                {
                  id: "row-1",
                  label: "Запись 1",
                  url: "https://example.com/video-1",
                  note: "Основной ролик",
                },
              ],
            },
          ],
        },
      },
      {
        getServerByCode: vi.fn().mockResolvedValue({
          id: "server-1",
          code: "blackberry",
          name: "Blackberry",
        }),
        getCharacterByIdForAccount: vi.fn().mockResolvedValue({
          id: "character-1",
          accountId: "00000000-0000-0000-0000-000000000001",
          serverId: "server-1",
          fullName: "Игорь Юристов",
          nickname: "Игорь Юристов",
          passportNumber: "AA-001",
          isProfileComplete: true,
          roles: [{ roleKey: "lawyer" }],
          accessFlags: [{ flagKey: "advocate" }],
        }),
        createDocumentRecord,
        getDocumentByIdForAccount: vi.fn(),
        updateDocumentDraftRecord: vi.fn(),
        setActiveServerSelection: vi.fn().mockResolvedValue(undefined),
        setActiveCharacterSelection: vi.fn().mockResolvedValue(undefined),
        now: () => new Date("2026-04-21T05:00:00.000Z"),
      },
    );

    expect(createDocumentRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        formPayloadJson: expect.objectContaining({
          filingMode: "representative",
          trustorSnapshot: expect.objectContaining({
            fullName: "Пётр Доверитель",
            passportNumber: "TR-001",
          }),
          evidenceGroups: [
            expect.objectContaining({
              title: "Видео",
              rows: [
                expect.objectContaining({
                  label: "Запись 1",
                  url: "https://example.com/video-1",
                }),
              ],
            }),
          ],
        }),
      }),
    );
  });

  it("без advocate representative filing недоступен", async () => {
    await expect(
      createInitialOgpComplaintDraft(
        {
          accountId: "00000000-0000-0000-0000-000000000001",
          serverSlug: "blackberry",
          characterId: "character-1",
          title: "Жалоба в ОГП",
          payload: {
            filingMode: "representative",
            workingNotes: "",
            trustorSnapshot: {
              sourceType: "inline_manual",
              fullName: "Доверитель",
              passportNumber: "TR-001",
              note: "",
            },
            evidenceGroups: [],
          },
        },
        {
          getServerByCode: vi.fn().mockResolvedValue({
            id: "server-1",
            code: "blackberry",
            name: "Blackberry",
          }),
          getCharacterByIdForAccount: vi.fn().mockResolvedValue({
            id: "character-1",
            accountId: "00000000-0000-0000-0000-000000000001",
            serverId: "server-1",
            fullName: "Павел Гражданин",
            nickname: "Павел Гражданин",
            passportNumber: "AA-001",
            isProfileComplete: true,
            roles: [],
            accessFlags: [],
          }),
          createDocumentRecord: vi.fn(),
          getDocumentByIdForAccount: vi.fn(),
          updateDocumentDraftRecord: vi.fn(),
          setActiveServerSelection: vi.fn(),
          setActiveCharacterSelection: vi.fn(),
          now: () => new Date("2026-04-21T05:00:00.000Z"),
        },
      ),
    ).rejects.toBeInstanceOf(DocumentRepresentativeAccessError);
  });

  it("не даёт создать документ на сервере, где выбранный персонаж не принадлежит текущему server context", async () => {
    await expect(
      createInitialOgpComplaintDraft(
        {
          accountId: "00000000-0000-0000-0000-000000000001",
          serverSlug: "blackberry",
          characterId: "character-1",
          title: "Жалоба в ОГП",
          payload: {
            filingMode: "self",
            workingNotes: "",
            evidenceGroups: [],
          },
        },
        {
          getServerByCode: vi.fn().mockResolvedValue({
            id: "server-1",
            code: "blackberry",
            name: "Blackberry",
          }),
          getCharacterByIdForAccount: vi.fn().mockResolvedValue({
            id: "character-1",
            accountId: "00000000-0000-0000-0000-000000000001",
            serverId: "server-2",
            fullName: "Игорь Юристов",
            nickname: "Игорь Юристов",
            passportNumber: "AA-001",
            isProfileComplete: true,
            roles: [],
            accessFlags: [],
          }),
          createDocumentRecord: vi.fn(),
          getDocumentByIdForAccount: vi.fn(),
          updateDocumentDraftRecord: vi.fn(),
          setActiveServerSelection: vi.fn(),
          setActiveCharacterSelection: vi.fn(),
          now: () => new Date("2026-04-21T05:00:00.000Z"),
        },
      ),
    ).rejects.toBeInstanceOf(DocumentCharacterUnavailableError);
  });

  it("manual save обновляет complaint payload и не меняет snapshot invariants", async () => {
    const existingDocument = {
      id: "document-1",
      accountId: "00000000-0000-0000-0000-000000000001",
      serverId: "server-1",
      characterId: "character-1",
      documentType: "ogp_complaint" as const,
      title: "Жалоба в ОГП",
      status: "draft" as const,
      formSchemaVersion: "ogp_complaint_mvp_editor_v1",
      snapshotCapturedAt: new Date("2026-04-21T05:00:00.000Z"),
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
        capturedAt: "2026-04-21T05:00:00.000Z",
      },
      formPayloadJson: {
        filingMode: "self",
        workingNotes: "Старые заметки",
        evidenceGroups: [],
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
      createdAt: new Date("2026-04-21T05:00:00.000Z"),
      updatedAt: new Date("2026-04-21T05:00:00.000Z"),
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
        createdAt: new Date("2026-04-21T05:00:00.000Z"),
        updatedAt: new Date("2026-04-21T05:00:00.000Z"),
        roles: [{ roleKey: "lawyer" }],
        accessFlags: [{ flagKey: "advocate" }],
      },
    };
    const updateDocumentDraftRecord = vi.fn().mockResolvedValue({
      ...existingDocument,
      title: "Жалоба в ОГП / draft 2",
      formPayloadJson: {
        filingMode: "representative",
        workingNotes: "Новые заметки",
        appealNumber: "REP-001",
        trustorSnapshot: {
          sourceType: "inline_manual",
          fullName: "Доверитель",
          passportNumber: "TR-001",
          note: "",
        },
        evidenceGroups: [
          {
            id: "group-1",
            title: "Видео",
            rows: [
              {
                id: "row-1",
                label: "Запись",
                url: "https://example.com/video",
                note: "",
              },
            ],
          },
        ],
      },
      updatedAt: new Date("2026-04-21T05:15:00.000Z"),
    });

    const savedDocument = await saveOwnedDocumentDraft(
      {
        accountId: "00000000-0000-0000-0000-000000000001",
        documentId: "document-1",
        title: "Жалоба в ОГП / draft 2",
        payload: {
          filingMode: "representative",
          workingNotes: "Новые заметки",
          appealNumber: "REP-001",
          trustorSnapshot: {
            sourceType: "inline_manual",
            fullName: "Доверитель",
            passportNumber: "TR-001",
            note: "",
          },
          evidenceGroups: [
            {
              id: "group-1",
              title: "Видео",
              rows: [
                {
                  id: "row-1",
                  label: "Запись",
                  url: "https://example.com/video",
                  note: "",
                },
              ],
            },
          ],
        },
      },
      {
        getServerByCode: vi.fn(),
        getCharacterByIdForAccount: vi.fn(),
        createDocumentRecord: vi.fn(),
        getDocumentByIdForAccount: vi.fn().mockResolvedValue(existingDocument),
        updateDocumentDraftRecord,
        setActiveServerSelection: vi.fn(),
        setActiveCharacterSelection: vi.fn(),
        now: () => new Date("2026-04-21T05:00:00.000Z"),
      },
    );

    expect(updateDocumentDraftRecord).toHaveBeenCalledWith({
      documentId: "document-1",
      title: "Жалоба в ОГП / draft 2",
      formPayloadJson: expect.objectContaining({
        filingMode: "representative",
        appealNumber: "REP-001",
        workingNotes: "Новые заметки",
      }),
    });
    expect(savedDocument.serverId).toBe("server-1");
    expect(savedDocument.characterId).toBe("character-1");
    expect(readOgpComplaintDraftPayload(savedDocument.formPayloadJson)).toEqual(
      expect.objectContaining({
        filingMode: "representative",
        workingNotes: "Новые заметки",
      }),
    );
  });

  it("не даёт сохранить representative payload без advocate snapshot", async () => {
    await expect(
      saveOwnedDocumentDraft(
        {
          accountId: "00000000-0000-0000-0000-000000000001",
          documentId: "document-1",
          title: "Жалоба в ОГП",
          payload: {
            filingMode: "representative",
            trustorSnapshot: {
              sourceType: "inline_manual",
              fullName: "Доверитель",
              passportNumber: "TR-001",
              note: "",
            },
            evidenceGroups: [],
            workingNotes: "",
          },
        },
        {
          getServerByCode: vi.fn(),
          getCharacterByIdForAccount: vi.fn(),
          createDocumentRecord: vi.fn(),
          getDocumentByIdForAccount: vi.fn().mockResolvedValue({
            id: "document-1",
            accountId: "00000000-0000-0000-0000-000000000001",
            serverId: "server-1",
            characterId: "character-1",
            documentType: "ogp_complaint",
            title: "Жалоба в ОГП",
            status: "draft",
            formSchemaVersion: "ogp_complaint_mvp_editor_v1",
            snapshotCapturedAt: new Date("2026-04-21T05:00:00.000Z"),
            authorSnapshotJson: {
              characterId: "character-1",
              serverId: "server-1",
              serverCode: "blackberry",
              serverName: "Blackberry",
              fullName: "Павел Гражданин",
              nickname: "Павел Гражданин",
              passportNumber: "AA-001",
              isProfileComplete: true,
              roleKeys: [],
              accessFlags: [],
              capturedAt: "2026-04-21T05:00:00.000Z",
            },
            formPayloadJson: {
              filingMode: "self",
              workingNotes: "",
              evidenceGroups: [],
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
            createdAt: new Date("2026-04-21T05:00:00.000Z"),
            updatedAt: new Date("2026-04-21T05:00:00.000Z"),
            server: {
              id: "server-1",
              code: "blackberry",
              name: "Blackberry",
            },
            character: {
              id: "character-1",
              accountId: "00000000-0000-0000-0000-000000000001",
              serverId: "server-1",
              fullName: "Павел Гражданин",
              nickname: "Павел Гражданин",
              passportNumber: "AA-001",
              isProfileComplete: true,
              profileDataJson: null,
              deletedAt: null,
              createdAt: new Date("2026-04-21T05:00:00.000Z"),
              updatedAt: new Date("2026-04-21T05:00:00.000Z"),
              roles: [],
              accessFlags: [],
            },
          }),
          updateDocumentDraftRecord: vi.fn(),
          setActiveServerSelection: vi.fn(),
          setActiveCharacterSelection: vi.fn(),
          now: () => new Date("2026-04-21T05:00:00.000Z"),
        },
      ),
    ).rejects.toBeInstanceOf(DocumentRepresentativeAccessError);
  });

  it("не даёт сохранить чужой documentId", async () => {
    await expect(
      saveOwnedDocumentDraft(
        {
          accountId: "00000000-0000-0000-0000-000000000001",
          documentId: "document-404",
          title: "Жалоба в ОГП",
          payload: {
            filingMode: "self",
            workingNotes: "",
            evidenceGroups: [],
          },
        },
        {
          getServerByCode: vi.fn(),
          getCharacterByIdForAccount: vi.fn(),
          createDocumentRecord: vi.fn(),
          getDocumentByIdForAccount: vi.fn().mockResolvedValue(null),
          updateDocumentDraftRecord: vi.fn(),
          setActiveServerSelection: vi.fn(),
          setActiveCharacterSelection: vi.fn(),
          now: () => new Date("2026-04-21T05:00:00.000Z"),
        },
      ),
    ).rejects.toBeInstanceOf(DocumentAccessDeniedError);
  });
});
