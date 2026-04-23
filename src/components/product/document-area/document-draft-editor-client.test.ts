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
          evidenceGroups: [],
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
    expect(html).toContain("Situation description");
    expect(html).toContain("Violation summary");
    expect(html).toContain("Publication metadata");
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
          evidenceGroups: [],
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

    expect(html).toContain("Prefill из trustors registry");
    expect(html).toContain("Подставить из registry");
    expect(html).toContain('/account/trustors?server=blackberry');
  });
});
