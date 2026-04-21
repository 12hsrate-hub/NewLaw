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
        server: {
          code: "blackberry",
          name: "Blackberry",
        },
        authorSnapshot: {
          fullName: "Игорь Юристов",
          passportNumber: "AA-001",
          nickname: "Игорь Юристов",
          roleKeys: ["lawyer"],
          accessFlags: ["advocate"],
          isProfileComplete: false,
        },
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

    expect(html).toContain("owner-account route");
    expect(html).toContain("Persisted draft");
    expect(html).toContain("doc-123");
    expect(html).toContain("OGP complaint editor");
    expect(html).toContain("filing mode: representative");
  });
});
