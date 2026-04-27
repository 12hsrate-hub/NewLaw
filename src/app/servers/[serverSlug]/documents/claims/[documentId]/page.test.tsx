import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/document-area/context", () => ({
  getClaimsEditorRouteContext: vi.fn(),
}));

import ClaimsEditorFoundationPage from "@/app/servers/[serverSlug]/documents/claims/[documentId]/page";
import { getClaimsEditorRouteContext } from "@/server/document-area/context";

describe("/servers/[serverSlug]/documents/claims/[documentId] page", () => {
  it("грузит сохранённый документ из раздела исков", async () => {
    vi.mocked(getClaimsEditorRouteContext).mockResolvedValue({
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
        id: "claim-123",
        title: "Документ по реабилитации",
        documentType: "rehabilitation",
        status: "draft",
        createdAt: "2026-04-22T00:00:00.000Z",
        updatedAt: "2026-04-22T00:10:00.000Z",
        snapshotCapturedAt: "2026-04-22T00:00:00.000Z",
        formSchemaVersion: "rehabilitation_claim_mvp_editor_v1",
        generatedAt: null,
        generatedFormSchemaVersion: null,
        generatedOutputFormat: null,
        generatedRendererVersion: null,
        generatedArtifact: null,
        isModifiedAfterGeneration: false,
        server: {
          code: "blackberry",
          name: "Blackberry",
        },
        authorSnapshot: {
          fullName: "Игорь Юристов",
          passportNumber: "AA-001",
          nickname: "Игорь Юристов",
          roleKeys: [],
          accessFlags: [],
          isProfileComplete: true,
        },
        trustorRegistry: [],
        payload: {
          filingMode: "self",
          respondentName: "",
          claimSubject: "",
          factualBackground: "",
          legalBasisSummary: "",
          requestedRelief: "",
          workingNotes: "Черновые notes",
          trustorSnapshot: null,
          evidenceGroups: [],
          caseReference: "",
          rehabilitationBasis: "",
          harmSummary: "",
        },
      },
    });

    const html = renderToStaticMarkup(
      await ClaimsEditorFoundationPage({
        params: Promise.resolve({
          serverSlug: "blackberry",
          documentId: "claim-123",
        }),
      }),
    );

    expect(getClaimsEditorRouteContext).toHaveBeenCalledWith({
      serverSlug: "blackberry",
      documentId: "claim-123",
      nextPath: "/servers/blackberry/documents/claims/claim-123",
    });
    expect(html).toContain("Редактор документа");
    expect(html).toContain("Вид документа: Реабилитация");
    expect(html).toContain("Рабочие заметки");
    expect(html).toContain("Сведения о сборке");
    expect(html).not.toContain("claim-123");
  });
});
