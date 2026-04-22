import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  OgpPublicationBlockedError,
  publishOwnedOgpComplaintCreate,
} from "@/server/document-area/publication";
import { DocumentAccessDeniedError } from "@/server/document-area/persistence";
import { ForumConnectionStateError } from "@/server/forum-integration/service";

function createBaseDocument() {
  return {
    id: "document-1",
    accountId: "00000000-0000-0000-0000-000000000001",
    serverId: "server-1",
    characterId: "character-1",
    documentType: "ogp_complaint" as const,
    title: "Жалоба в ОГП",
    status: "generated" as const,
    formSchemaVersion: "ogp_complaint_mvp_editor_v1",
    snapshotCapturedAt: new Date("2026-04-22T02:00:00.000Z"),
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
      capturedAt: "2026-04-22T02:00:00.000Z",
    },
    formPayloadJson: {
      filingMode: "self",
      appealNumber: "OGP-001",
      objectOrganization: "LSPD",
      objectFullName: "Officer Smoke",
      incidentAt: "2026-04-22T02:30",
      situationDescription: "Описание ситуации",
      violationSummary: "Описание нарушения",
      workingNotes: "",
      trustorSnapshot: null,
      evidenceGroups: [],
    },
    generatedArtifactJson: null,
    generatedArtifactText: null,
    generatedOutputFormat: null,
    generatedRendererVersion: null,
    lastGeneratedBbcode: "[b]ЖАЛОБА В ОГП[/b]",
    generatedAt: new Date("2026-04-22T03:00:00.000Z"),
    generatedLawVersion: "current_primary_snapshot_v1:server-1:1:abc",
    generatedTemplateVersion: "ogp_complaint_bbcode_v1",
    generatedFormSchemaVersion: "ogp_complaint_mvp_editor_v1",
    publicationUrl: null,
    isSiteForumSynced: false,
    forumSyncState: "not_published" as const,
    forumThreadId: null,
    forumPostId: null,
    forumPublishedBbcodeHash: null,
    forumLastPublishedAt: null,
    forumLastSyncError: null,
    isModifiedAfterGeneration: false,
    deletedAt: null,
    createdAt: new Date("2026-04-22T02:00:00.000Z"),
    updatedAt: new Date("2026-04-22T03:00:00.000Z"),
    server: {
      id: "server-1",
      code: "blackberry",
      name: "Blackberry",
    },
  };
}

describe("ogp publication", () => {
  const originalThreadFormUrl = process.env.OGP_FORUM_THREAD_FORM_URL;

  beforeEach(() => {
    process.env.OGP_FORUM_THREAD_FORM_URL =
      "https://forum.gta5rp.com/forums/ogp/post-thread";
  });

  afterEach(() => {
    if (originalThreadFormUrl === undefined) {
      delete process.env.OGP_FORUM_THREAD_FORM_URL;
      return;
    }

    process.env.OGP_FORUM_THREAD_FORM_URL = originalThreadFormUrl;
  });

  it("успешный publish create сохраняет external identity и переводит документ в published", async () => {
    const baseDocument = createBaseDocument();
    const createAttempt = vi
      .fn()
      .mockResolvedValueOnce({
        id: "attempt-1",
      });
    const updateAttempt = vi.fn().mockResolvedValue({
      id: "attempt-1",
      status: "succeeded",
    });
    const markPublished = vi.fn().mockResolvedValue({
      ...baseDocument,
      status: "published",
      publicationUrl: "https://forum.gta5rp.com/threads/test.100/",
      isSiteForumSynced: true,
      forumSyncState: "current",
      forumThreadId: "100",
      forumPostId: "200",
      forumPublishedBbcodeHash: "hash",
      forumLastPublishedAt: new Date("2026-04-22T04:00:00.000Z"),
      isModifiedAfterGeneration: false,
    });

    const result = await publishOwnedOgpComplaintCreate(
      {
        accountId: "00000000-0000-0000-0000-000000000001",
        documentId: "document-1",
      },
      {
        getDocumentByIdForAccount: vi.fn().mockResolvedValue(baseDocument),
        getValidatedAccountForumSessionForAutomation: vi.fn().mockResolvedValue({
          payload: {
            cookieHeader: "xf_user=1; xf_session=secret",
          },
        }),
        createGta5RpForumThreadFromBbcode: vi.fn().mockResolvedValue({
          publicationUrl: "https://forum.gta5rp.com/threads/test.100/",
          forumThreadId: "100",
          forumPostId: "200",
        }),
        createOgpForumPublicationAttemptRecord: createAttempt,
        updateOgpForumPublicationAttemptRecord: updateAttempt,
        markOgpDocumentPublishedViaAutomationRecord: markPublished,
        markOgpDocumentPublishFailedRecord: vi.fn(),
        now: () => new Date("2026-04-22T04:00:00.000Z"),
        runTransaction: async (callback) => callback({} as never),
      },
    );

    expect(createAttempt).toHaveBeenCalledWith({
      documentId: "document-1",
      accountId: "00000000-0000-0000-0000-000000000001",
      operation: "publish_create",
      status: "started",
    });
    expect(markPublished).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: "document-1",
        publicationUrl: "https://forum.gta5rp.com/threads/test.100/",
        forumThreadId: "100",
        forumPostId: "200",
      }),
      expect.anything(),
    );
    expect(markPublished.mock.calls[0]?.[0].forumPublishedBbcodeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(updateAttempt).toHaveBeenCalledWith(
      {
        attemptId: "attempt-1",
        status: "succeeded",
        forumThreadId: "100",
        forumPostId: "200",
      },
      expect.anything(),
    );
    expect(result.status).toBe("published");
    expect(result.forumSyncState).toBe("current");
  });

  it("блокирует publish create без generated BBCode и пишет failed attempt", async () => {
    const createAttempt = vi.fn().mockResolvedValue({
      id: "attempt-blocked",
    });

    await expect(
      publishOwnedOgpComplaintCreate(
        {
          accountId: "00000000-0000-0000-0000-000000000001",
          documentId: "document-1",
        },
        {
          getDocumentByIdForAccount: vi.fn().mockResolvedValue({
            ...createBaseDocument(),
            generatedAt: null,
            lastGeneratedBbcode: null,
          }),
          getValidatedAccountForumSessionForAutomation: vi.fn(),
          createGta5RpForumThreadFromBbcode: vi.fn(),
          createOgpForumPublicationAttemptRecord: createAttempt,
          updateOgpForumPublicationAttemptRecord: vi.fn(),
          markOgpDocumentPublishedViaAutomationRecord: vi.fn(),
          markOgpDocumentPublishFailedRecord: vi.fn(),
          now: () => new Date("2026-04-22T04:00:00.000Z"),
          runTransaction: async (callback) => callback({} as never),
        },
      ),
    ).rejects.toMatchObject({
      reasons: expect.arrayContaining(["generated_at_missing", "generated_bbcode_missing"]),
    });

    expect(createAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
      }),
    );
  });

  it("блокирует publish create для stale generation и manual_untracked состояния", async () => {
    await expect(
      publishOwnedOgpComplaintCreate(
        {
          accountId: "00000000-0000-0000-0000-000000000001",
          documentId: "document-1",
        },
        {
          getDocumentByIdForAccount: vi.fn().mockResolvedValue({
            ...createBaseDocument(),
            publicationUrl: "https://forum.gta5rp.com/threads/manual.999/",
            isModifiedAfterGeneration: true,
          }),
          getValidatedAccountForumSessionForAutomation: vi.fn(),
          createGta5RpForumThreadFromBbcode: vi.fn(),
          createOgpForumPublicationAttemptRecord: vi.fn().mockResolvedValue({ id: "attempt-1" }),
          updateOgpForumPublicationAttemptRecord: vi.fn(),
          markOgpDocumentPublishedViaAutomationRecord: vi.fn(),
          markOgpDocumentPublishFailedRecord: vi.fn(),
          now: () => new Date("2026-04-22T04:00:00.000Z"),
          runTransaction: async (callback) => callback({} as never),
        },
      ),
    ).rejects.toMatchObject({
      reasons: expect.arrayContaining(["modified_after_generation", "manual_untracked"]),
    });
  });

  it("не создаёт duplicate thread, если automation-owned external identity уже есть", async () => {
    await expect(
      publishOwnedOgpComplaintCreate(
        {
          accountId: "00000000-0000-0000-0000-000000000001",
          documentId: "document-1",
        },
        {
          getDocumentByIdForAccount: vi.fn().mockResolvedValue({
            ...createBaseDocument(),
            status: "published",
            publicationUrl: "https://forum.gta5rp.com/threads/test.100/",
            forumThreadId: "100",
            forumPostId: "200",
            forumSyncState: "current",
          }),
          getValidatedAccountForumSessionForAutomation: vi.fn(),
          createGta5RpForumThreadFromBbcode: vi.fn(),
          createOgpForumPublicationAttemptRecord: vi.fn().mockResolvedValue({ id: "attempt-1" }),
          updateOgpForumPublicationAttemptRecord: vi.fn(),
          markOgpDocumentPublishedViaAutomationRecord: vi.fn(),
          markOgpDocumentPublishFailedRecord: vi.fn(),
          now: () => new Date("2026-04-22T04:00:00.000Z"),
          runTransaction: async (callback) => callback({} as never),
        },
      ),
    ).rejects.toMatchObject({
      reasons: expect.arrayContaining(["already_published"]),
    });
  });

  it("при publish failure пишет failed state и attempt log", async () => {
    const markFailed = vi.fn().mockResolvedValue({
      ...createBaseDocument(),
      forumSyncState: "failed",
      forumLastSyncError: "Форум не принял сообщение.",
      isSiteForumSynced: false,
    });
    const updateAttempt = vi.fn().mockResolvedValue({
      id: "attempt-1",
      status: "failed",
    });

    await expect(
      publishOwnedOgpComplaintCreate(
        {
          accountId: "00000000-0000-0000-0000-000000000001",
          documentId: "document-1",
        },
        {
          getDocumentByIdForAccount: vi.fn().mockResolvedValue(createBaseDocument()),
          getValidatedAccountForumSessionForAutomation: vi.fn().mockResolvedValue({
            payload: {
              cookieHeader: "xf_user=1; xf_session=secret",
            },
          }),
          createGta5RpForumThreadFromBbcode: vi
            .fn()
            .mockRejectedValue(new Error("Форум не принял сообщение.")),
          createOgpForumPublicationAttemptRecord: vi
            .fn()
            .mockResolvedValue({ id: "attempt-1" }),
          updateOgpForumPublicationAttemptRecord: updateAttempt,
          markOgpDocumentPublishedViaAutomationRecord: vi.fn(),
          markOgpDocumentPublishFailedRecord: markFailed,
          now: () => new Date("2026-04-22T04:00:00.000Z"),
          runTransaction: async (callback) => callback({} as never),
        },
      ),
    ).rejects.toThrow("Форум не принял сообщение.");

    expect(markFailed).toHaveBeenCalledWith(
      {
        documentId: "document-1",
        errorSummary: "Форум не принял сообщение.",
      },
      expect.anything(),
    );
    expect(updateAttempt).toHaveBeenCalledWith(
      {
        attemptId: "attempt-1",
        status: "failed",
        errorCode: "publish_failed",
        errorSummary: "Форум не принял сообщение.",
      },
      expect.anything(),
    );
  });

  it("owner-only access и valid forum connection обязательны", async () => {
    await expect(
      publishOwnedOgpComplaintCreate(
        {
          accountId: "00000000-0000-0000-0000-000000000001",
          documentId: "document-404",
        },
        {
          getDocumentByIdForAccount: vi.fn().mockResolvedValue(null),
          getValidatedAccountForumSessionForAutomation: vi.fn(),
          createGta5RpForumThreadFromBbcode: vi.fn(),
          createOgpForumPublicationAttemptRecord: vi.fn(),
          updateOgpForumPublicationAttemptRecord: vi.fn(),
          markOgpDocumentPublishedViaAutomationRecord: vi.fn(),
          markOgpDocumentPublishFailedRecord: vi.fn(),
          now: () => new Date("2026-04-22T04:00:00.000Z"),
          runTransaction: async (callback) => callback({} as never),
        },
      ),
    ).rejects.toBeInstanceOf(DocumentAccessDeniedError);

    await expect(
      publishOwnedOgpComplaintCreate(
        {
          accountId: "00000000-0000-0000-0000-000000000001",
          documentId: "document-1",
        },
        {
          getDocumentByIdForAccount: vi.fn().mockResolvedValue(createBaseDocument()),
          getValidatedAccountForumSessionForAutomation: vi
            .fn()
            .mockRejectedValue(new ForumConnectionStateError("invalid")),
          createGta5RpForumThreadFromBbcode: vi.fn(),
          createOgpForumPublicationAttemptRecord: vi.fn().mockResolvedValue({ id: "attempt-1" }),
          updateOgpForumPublicationAttemptRecord: vi.fn(),
          markOgpDocumentPublishedViaAutomationRecord: vi.fn(),
          markOgpDocumentPublishFailedRecord: vi.fn(),
          now: () => new Date("2026-04-22T04:00:00.000Z"),
          runTransaction: async (callback) => callback({} as never),
        },
      ),
    ).rejects.toBeInstanceOf(OgpPublicationBlockedError);
  });
});
