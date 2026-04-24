import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/document-area/context", () => ({
  getAccountDocumentsOverviewContext: vi.fn(),
}));

import AccountDocumentsPage from "@/app/account/documents/page";
import { getAccountDocumentsOverviewContext } from "@/server/document-area/context";

describe("/account/documents page", () => {
  it("рендерит aggregator overview route, а не рабочий editor center", async () => {
    vi.mocked(getAccountDocumentsOverviewContext).mockResolvedValue({
      account: {
        id: "account-1",
        email: "user@example.com",
        login: "tester",
        isSuperAdmin: false,
        mustChangePassword: false,
      },
      documents: [
        {
          id: "document-1",
          title: "Жалоба в ОГП",
          documentType: "ogp_complaint",
          status: "draft",
          filingMode: "representative",
          subtype: null,
          appealNumber: "REP-001",
          objectFullName: "Сотрудник Полиции",
          objectOrganization: "LSPD",
          server: {
            id: "server-1",
            code: "blackberry",
            name: "Blackberry",
          },
          authorSnapshot: {
            fullName: "Игорь Юристов",
            passportNumber: "AA-001",
          },
          dataHealth: "ok",
          workingNotesPreview: "Черновая заметка",
          generatedAt: null,
          publicationUrl: null,
          isSiteForumSynced: false,
          forumSyncState: "not_published",
          forumThreadId: null,
          forumPostId: null,
          forumLastPublishedAt: null,
          forumLastSyncError: null,
          isModifiedAfterGeneration: false,
          snapshotCapturedAt: "2026-04-21T10:00:00.000Z",
          updatedAt: "2026-04-21T10:15:00.000Z",
          createdAt: "2026-04-21T10:00:00.000Z",
        },
      ],
      servers: [
        {
          id: "server-1",
          code: "blackberry",
          name: "Blackberry",
          characterCount: 1,
          selectedCharacterId: "character-1",
          selectedCharacterName: "Игорь Юристов",
          selectedCharacterSource: "last_used",
          ogpComplaintDocumentCount: 1,
          claimsDocumentCount: 0,
        },
      ],
    });

    const html = renderToStaticMarkup(await AccountDocumentsPage());

    expect(html).toContain("Мои документы");
    expect(html).toContain("Здесь собраны ваши сохранённые документы по всем серверам");
    expect(html).toContain("Жалоба в ОГП");
    expect(html).toContain("Документы по серверам");
    expect(html).toContain("Подача: как представитель");
    expect(html).toContain("/servers/blackberry/documents");
  });

  it("показывает degraded карточку для документа с повреждённым payload", async () => {
    vi.mocked(getAccountDocumentsOverviewContext).mockResolvedValue({
      account: {
        id: "account-1",
        email: "user@example.com",
        login: "tester",
        isSuperAdmin: false,
        mustChangePassword: false,
      },
      documents: [
        {
          id: "document-broken",
          title: "Адвокатский запрос",
          documentType: "attorney_request",
          status: "draft",
          filingMode: null,
          subtype: null,
          appealNumber: null,
          objectFullName: null,
          objectOrganization: null,
          requestNumber: null,
          trustorName: null,
          server: {
            id: "server-1",
            code: "blackberry",
            name: "Blackberry",
          },
          authorSnapshot: {
            fullName: "Данные персонажа повреждены",
            passportNumber: "не указан",
          },
          dataHealth: "invalid_payload",
          workingNotesPreview: "Документ требует восстановления данных.",
          generatedAt: null,
          publicationUrl: null,
          isSiteForumSynced: false,
          forumSyncState: null,
          forumThreadId: null,
          forumPostId: null,
          forumLastPublishedAt: null,
          forumLastSyncError: null,
          isModifiedAfterGeneration: false,
          snapshotCapturedAt: "2026-04-21T10:00:00.000Z",
          updatedAt: "2026-04-21T10:15:00.000Z",
          createdAt: "2026-04-21T10:00:00.000Z",
        },
      ],
      servers: [],
    });

    const html = renderToStaticMarkup(await AccountDocumentsPage());

    expect(html).toContain("Требует восстановления");
    expect(html).toContain("Документ требует восстановления данных.");
    expect(html).toContain("Карточка открыта в безопасном режиме");
  });

  it("следует auth guard и пробрасывает redirect при отсутствии доступа", async () => {
    vi.mocked(getAccountDocumentsOverviewContext).mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(AccountDocumentsPage()).rejects.toThrow("NEXT_REDIRECT");
  });
});
