import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/actions/documents", () => ({
  createOgpComplaintDraftAction: vi.fn(),
  generateOgpComplaintBbcodeAction: vi.fn(),
  publishOgpComplaintCreateAction: vi.fn(),
  publishOgpComplaintUpdateAction: vi.fn(),
  refreshOgpComplaintAuthorSnapshotAction: vi.fn(),
  rewriteDocumentFieldAction: vi.fn(),
  rewriteGroundedDocumentFieldAction: vi.fn(),
  saveDocumentDraftAction: vi.fn(),
  updateDocumentPublicationMetadataAction: vi.fn(),
}));

import { DocumentDraftEditorClient } from "@/components/product/document-area/document-draft-editor-client";

describe("OGP document editor rewrite affordances", () => {
  it("рендерит AI action только для situationDescription и violationSummary", () => {
    const html = renderToStaticMarkup(
      createElement(DocumentDraftEditorClient, {
        documentId: "document-1",
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
          isProfileComplete: true,
          canUseRepresentative: true,
        },
        initialTitle: "Жалоба в ОГП",
        initialPayload: {
          filingMode: "self",
          appealNumber: "OGP-001",
          objectOrganization: "LSPD",
          objectFullName: "Officer Smoke",
          incidentAt: "2026-04-22T10:15",
          situationDescription: "Описание",
          violationSummary: "Нарушение",
          workingNotes: "Внутренние notes",
          trustorSnapshot: null,
          evidenceItems: [],
        },
        initialLastGeneratedBbcode: null,
        generatedAt: null,
        generatedLawVersion: null,
        generatedTemplateVersion: null,
        generatedFormSchemaVersion: null,
        initialPublicationUrl: null,
        initialIsSiteForumSynced: false,
        initialIsModifiedAfterGeneration: false,
        initialForumSyncState: "not_published",
        initialForumThreadId: null,
        initialForumPostId: null,
        initialForumPublishedBbcodeHash: null,
        initialForumLastPublishedAt: null,
        initialForumLastSyncError: null,
        status: "draft",
        forumConnection: {
          providerKey: "forum.gta5rp.com",
          state: "valid",
          forumUserId: "42",
          forumUsername: "lawyer",
          validatedAt: "2026-04-22T10:00:00.000Z",
          lastValidationError: null,
          disabledAt: null,
        },
        trustorRegistry: [],
        updatedAt: "2026-04-22T10:00:00.000Z",
      }),
    );

    expect(html.match(/Улучшить текст/g)?.length).toBe(2);
    expect(html.match(/Улучшить с опорой на нормы/g)?.length).toBe(1);
    expect(html).toContain("Подробное описание ситуации");
    expect(html).toContain("Суть нарушения");
    expect(html).toContain("Публикация на форуме");
    expect(html).toContain("Очистить форму жалобы");
    expect(html).toContain("Обновить данные профиля в жалобе");
    expect(html).not.toContain("AI-предложение для секции Working notes");
  });

  it("в representative flow показывает trustor registry prefill как optional chooser", () => {
    const html = renderToStaticMarkup(
      createElement(DocumentDraftEditorClient, {
        documentId: "document-2",
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
          isProfileComplete: true,
          canUseRepresentative: true,
        },
        initialTitle: "Жалоба в ОГП",
        initialPayload: {
          filingMode: "representative",
          appealNumber: "OGP-002",
          objectOrganization: "LSPD",
          objectFullName: "Officer Smoke",
          incidentAt: "2026-04-22T10:15",
          situationDescription: "Описание",
          violationSummary: "Нарушение",
          workingNotes: "Внутренние notes",
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
          evidenceItems: [],
        },
        initialLastGeneratedBbcode: null,
        generatedAt: null,
        generatedLawVersion: null,
        generatedTemplateVersion: null,
        generatedFormSchemaVersion: null,
        initialPublicationUrl: null,
        initialIsSiteForumSynced: false,
        initialIsModifiedAfterGeneration: false,
        initialForumSyncState: "not_published",
        initialForumThreadId: null,
        initialForumPostId: null,
        initialForumPublishedBbcodeHash: null,
        initialForumLastPublishedAt: null,
        initialForumLastSyncError: null,
        status: "draft",
        forumConnection: {
          providerKey: "forum.gta5rp.com",
          state: "valid",
          forumUserId: "42",
          forumUsername: "lawyer",
          validatedAt: "2026-04-22T10:00:00.000Z",
          lastValidationError: null,
          disabledAt: null,
        },
        trustorRegistry: [
          {
            id: "trustor-1",
            fullName: "Иван Доверителев",
            passportNumber: "AA-001",
            phone: "+7 900 000-00-00",
            icEmail: "trustor@example.com",
            passportImageUrl: "https://example.com/trustor-passport.png",
            note: "Проверенный представитель",
            isRepresentativeReady: true,
          },
        ],
        updatedAt: "2026-04-22T10:00:00.000Z",
      }),
    );

    expect(html).toContain("Подставить доверителя из списка");
    expect(html).toContain("Подставить в документ");
    expect(html).toContain('/account/trustors?server=blackberry');
  });

  it("рендерит плоский блок доказательств без групп и комментариев", () => {
    const html = renderToStaticMarkup(
      createElement(DocumentDraftEditorClient, {
        documentId: "document-3",
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
          isProfileComplete: true,
          canUseRepresentative: true,
        },
        initialTitle: "Жалоба в ОГП",
        initialPayload: {
          filingMode: "self",
          appealNumber: "OGP-003",
          objectOrganization: "LSPD",
          objectFullName: "Officer Smoke",
          incidentAt: "2026-04-22T10:15",
          situationDescription: "Описание",
          violationSummary: "Нарушение",
          workingNotes: "",
          trustorSnapshot: null,
          evidenceItems: [
            {
              id: "item-1",
              mode: "template",
              templateKey: "legal_services_contract",
              labelSnapshot: "Договор на оказание юридических услуг",
              url: "https://example.com/contract",
              sortOrder: 0,
            },
            {
              id: "item-2",
              mode: "custom",
              templateKey: null,
              labelSnapshot: "Свой скриншот",
              url: "https://example.com/screenshot",
              sortOrder: 1,
            },
          ],
        },
        initialLastGeneratedBbcode: null,
        generatedAt: null,
        generatedLawVersion: null,
        generatedTemplateVersion: null,
        generatedFormSchemaVersion: null,
        initialPublicationUrl: null,
        initialIsSiteForumSynced: false,
        initialIsModifiedAfterGeneration: false,
        initialForumSyncState: "not_published",
        initialForumThreadId: null,
        initialForumPostId: null,
        initialForumPublishedBbcodeHash: null,
        initialForumLastPublishedAt: null,
        initialForumLastSyncError: null,
        status: "draft",
        forumConnection: {
          providerKey: "forum.gta5rp.com",
          state: "valid",
          forumUserId: "42",
          forumUsername: "lawyer",
          validatedAt: "2026-04-22T10:00:00.000Z",
          lastValidationError: null,
          disabledAt: null,
        },
        trustorRegistry: [],
        updatedAt: "2026-04-22T10:00:00.000Z",
      }),
    );

    expect(html).toContain("Добавить доказательство");
    expect(html).toContain("Из списка");
    expect(html).toContain("Свой текст");
    expect(html).toContain("Договор на оказание юридических услуг");
    expect(html).toContain("Адвокатский запрос");
    expect(html).not.toContain("Добавить группу доказательств");
    expect(html).not.toContain("Заголовок группы");
    expect(html).not.toContain("Комментарий");
  });
});
