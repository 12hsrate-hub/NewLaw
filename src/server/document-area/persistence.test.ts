import { describe, expect, it, vi } from "vitest";

import {
  createInitialOgpComplaintDraft,
  DocumentAccessDeniedError,
  DocumentCharacterUnavailableError,
  readOgpComplaintDraftPayload,
  saveOwnedDocumentDraft,
} from "@/server/document-area/persistence";

describe("document persistence foundation", () => {
  it("first save создаёт draft и фиксирует author snapshot", async () => {
    const now = new Date("2026-04-21T05:00:00.000Z");
    const createDocumentRecord = vi.fn().mockResolvedValue({
      id: "document-1",
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
        workingNotes: "Черновая заметка",
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
        formSchemaVersion: "ogp_complaint_foundation_v1",
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
        formPayloadJson: {
          workingNotes: "Черновая заметка",
        },
      }),
    );
  });

  it("не даёт создать документ на сервере, где выбранный персонаж не принадлежит текущему server context", async () => {
    await expect(
      createInitialOgpComplaintDraft(
        {
          accountId: "00000000-0000-0000-0000-000000000001",
          serverSlug: "blackberry",
          characterId: "character-1",
          title: "Жалоба в ОГП",
          workingNotes: "",
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

  it("manual save обновляет только payload/title и не меняет snapshot invariants", async () => {
    const existingDocument = {
      id: "document-1",
      accountId: "00000000-0000-0000-0000-000000000001",
      serverId: "server-1",
      characterId: "character-1",
      documentType: "ogp_complaint" as const,
      title: "Жалоба в ОГП",
      status: "draft" as const,
      formSchemaVersion: "ogp_complaint_foundation_v1",
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
        workingNotes: "Старые заметки",
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
        workingNotes: "Новые заметки",
      },
      updatedAt: new Date("2026-04-21T05:15:00.000Z"),
    });

    const savedDocument = await saveOwnedDocumentDraft(
      {
        accountId: "00000000-0000-0000-0000-000000000001",
        documentId: "document-1",
        title: "Жалоба в ОГП / draft 2",
        workingNotes: "Новые заметки",
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
      formPayloadJson: {
        workingNotes: "Новые заметки",
      },
    });
    expect(savedDocument.serverId).toBe("server-1");
    expect(savedDocument.characterId).toBe("character-1");
    expect(readOgpComplaintDraftPayload(savedDocument.formPayloadJson).workingNotes).toBe(
      "Новые заметки",
    );
  });

  it("не даёт сохранить чужой documentId", async () => {
    await expect(
      saveOwnedDocumentDraft(
        {
          accountId: "00000000-0000-0000-0000-000000000001",
          documentId: "document-404",
          title: "Жалоба в ОГП",
          workingNotes: "",
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
