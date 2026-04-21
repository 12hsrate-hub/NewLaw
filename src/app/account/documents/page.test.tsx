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
          workingNotesPreview: "Черновая заметка",
          generatedAt: null,
          publicationUrl: null,
          isSiteForumSynced: false,
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
        },
      ],
    });

    const html = renderToStaticMarkup(await AccountDocumentsPage());

    expect(html).toContain("Мои документы");
    expect(html).toContain("cross-server обзором persisted документов");
    expect(html).toContain("Жалоба в ОГП");
    expect(html).toContain("Claims");
    expect(html).toContain("filing mode: representative");
    expect(html).toContain("/servers/blackberry/documents");
  });

  it("следует auth guard и пробрасывает redirect при отсутствии доступа", async () => {
    vi.mocked(getAccountDocumentsOverviewContext).mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(AccountDocumentsPage()).rejects.toThrow("NEXT_REDIRECT");
  });
});
