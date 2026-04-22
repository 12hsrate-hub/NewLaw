import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/actions/documents", () => ({
  createClaimDraftAction: vi.fn(),
  generateClaimsStructuredCheckpointAction: vi.fn(),
  generateClaimsStructuredPreviewAction: vi.fn(),
  rewriteDocumentFieldAction: vi.fn(),
  saveDocumentDraftAction: vi.fn(),
}));

import { ClaimsDraftEditorClient } from "@/components/product/document-area/document-claims-editor-client";

describe("claims document editor rewrite affordances", () => {
  it("рендерит AI action только для согласованных long-text sections текущего subtype", () => {
    const html = renderToStaticMarkup(
      createElement(ClaimsDraftEditorClient, {
        documentId: "document-1",
        documentType: "rehabilitation",
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
        initialTitle: "Документ по реабилитации",
        initialPayload: {
          filingMode: "self",
          respondentName: "LSPD",
          claimSubject: "Реабилитация",
          factualBackground: "Факты",
          legalBasisSummary: "Правовые основания",
          requestedRelief: "Прошу восстановить права",
          workingNotes: "Внутренние notes",
          trustorSnapshot: null,
          evidenceGroups: [],
          caseReference: "CASE-1",
          rehabilitationBasis: "Основание",
          harmSummary: "Вред",
        },
        status: "draft",
        updatedAt: "2026-04-22T10:00:00.000Z",
        generatedAt: null,
        generatedFormSchemaVersion: null,
        generatedOutputFormat: null,
        generatedRendererVersion: null,
        generatedArtifact: null,
        isModifiedAfterGeneration: false,
      }),
    );

    expect(html.match(/Улучшить текст/g)?.length).toBe(5);
    expect(html).toContain("Factual background");
    expect(html).toContain("Legal basis summary");
    expect(html).toContain("Requested relief");
    expect(html).toContain("Rehabilitation basis");
    expect(html).toContain("Harm summary");
    expect(html).not.toContain("Trustor full name");
    expect(html).not.toContain("AI-предложение для секции Working notes");
  });
});
