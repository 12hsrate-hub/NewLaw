import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/actions/documents", () => ({
  createOgpComplaintDraftAction: vi.fn(),
  generateOgpComplaintBbcodeAction: vi.fn(),
  publishOgpComplaintCreateAction: vi.fn(),
  publishOgpComplaintUpdateAction: vi.fn(),
  rewriteDocumentFieldAction: vi.fn(),
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
        updatedAt: "2026-04-22T10:00:00.000Z",
      }),
    );

    expect(html.match(/Улучшить текст/g)?.length).toBe(2);
    expect(html).toContain("Situation description");
    expect(html).toContain("Violation summary");
    expect(html).toContain("Publication metadata");
    expect(html).not.toContain("AI-предложение для секции Working notes");
  });
});
