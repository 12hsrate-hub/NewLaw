import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/document-area/context", () => ({
  getOgpComplaintEditorRouteContext: vi.fn(),
}));

import OgpComplaintEditorFoundationPage from "@/app/servers/[serverSlug]/documents/ogp-complaints/[documentId]/page";
import { getOgpComplaintEditorRouteContext } from "@/server/document-area/context";

describe("/servers/[serverSlug]/documents/ogp-complaints/[documentId] page", () => {
  it("рендерит owner-account persisted editor route", async () => {
    vi.mocked(getOgpComplaintEditorRouteContext).mockResolvedValue({
      status: "ready",
      account: {
        id: "account-1",
        email: "user@example.com",
        login: "tester",
        isSuperAdmin: false,
        mustChangePassword: false,
      },
      server: {
        id: "server-1",
        code: "blackberry",
        name: "Blackberry",
      },
      servers: [],
      document: {
        id: "doc-123",
        title: "Persisted draft",
        status: "draft",
        createdAt: "2026-04-21T10:00:00.000Z",
        updatedAt: "2026-04-21T10:15:00.000Z",
        snapshotCapturedAt: "2026-04-21T10:00:00.000Z",
        formSchemaVersion: "ogp_complaint_mvp_editor_v1",
        lastGeneratedBbcode: null,
        generatedAt: null,
        generatedLawVersion: null,
        generatedTemplateVersion: null,
        generatedFormSchemaVersion: null,
        publicationUrl: null,
        isSiteForumSynced: false,
        forumSyncState: "not_published",
        forumThreadId: null,
        forumPostId: null,
        forumPublishedBbcodeHash: null,
        forumLastPublishedAt: null,
        forumLastSyncError: null,
        isModifiedAfterGeneration: false,
        forumConnection: {
          providerKey: "forum.gta5rp.com",
          state: "valid",
          forumUserId: "501",
          forumUsername: "Forum User",
          validatedAt: "2026-04-22T09:00:00.000Z",
          lastValidationError: null,
          disabledAt: null,
        },
        server: {
          code: "blackberry",
          name: "Blackberry",
        },
        authorSnapshot: {
          fullName: "Игорь Юристов",
          passportNumber: "AA-001",
          position: "Адвокат",
          address: "Дом 10",
          phone: "123-45-67",
          icEmail: "lawyer@example.com",
          passportImageUrl: "https://example.com/passport.png",
          nickname: "Игорь Юристов",
          roleKeys: ["lawyer"],
          accessFlags: ["advocate"],
          isProfileComplete: true,
        },
        trustorRegistry: [
          {
            id: "trustor-1",
            fullName: "Иван Доверителев",
            passportNumber: "AA-001",
            phone: null,
            icEmail: null,
            passportImageUrl: null,
            note: "Проверенный представитель",
            isRepresentativeReady: true,
          },
        ],
        payload: {
          filingMode: "representative",
          appealNumber: "REP-001",
          objectOrganization: "LSPD",
          objectFullName: "Сотрудник Полиции",
          incidentAt: "2026-04-21T10:15",
          situationDescription: "Описание ситуации",
          violationSummary: "Резюме нарушения",
          workingNotes: "Черновая заметка",
          trustorSnapshot: {
            sourceType: "inline_manual",
            fullName: "Пётр Доверитель",
            passportNumber: "TR-001",
            address: "",
            phone: "",
            icEmail: "",
            passportImageUrl: "",
            note: "",
          },
          evidenceGroups: [],
        },
      },
    });

    const html = renderToStaticMarkup(
      await OgpComplaintEditorFoundationPage({
        params: Promise.resolve({
          serverSlug: "blackberry",
          documentId: "doc-123",
        }),
      }),
    );

    expect(html).toContain("только для владельца");
    expect(html).toContain("Persisted draft");
    expect(html).toContain("doc-123");
    expect(html).toContain("Редактор жалобы в ОГП");
    expect(html).toContain("Подача: как представитель");
    expect(html).toContain("Готовый BBCode");
    expect(html).toContain("Подключение форума");
    expect(html).toContain("Статус: подключение работает");
    expect(html).toContain("Опубликовать на форуме");
    expect(html).not.toContain("Профиль персонажа неполный");
    expect(html).not.toContain("Должность: Укажите должность.");
    expect(html).not.toContain("Телефон: Укажите телефон.");
    expect(html).not.toContain("Игровая почта: Укажите игровую почту.");
    expect(html).not.toContain("Ссылка на скрин паспорта: Укажите ссылку на скрин паспорта.");
  });
});
