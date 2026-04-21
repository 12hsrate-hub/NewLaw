import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/document-area/context", () => ({
  getClaimsEditorRouteContext: vi.fn(),
}));

import ClaimsEditorFoundationPage from "@/app/servers/[serverSlug]/documents/claims/[documentId]/page";
import { getClaimsEditorRouteContext } from "@/server/document-area/context";

describe("/servers/[serverSlug]/documents/claims/[documentId] page", () => {
  it("грузит persisted claims draft как owner-only route", async () => {
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
        formSchemaVersion: "rehabilitation_claim_foundation_v1",
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
        payload: {
          workingNotes: "Черновые notes",
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
    expect(html).toContain("реальный claims editor route");
    expect(html).toContain("Subtype: Rehabilitation");
    expect(html).toContain("claim-123");
    expect(html).toContain("working notes");
  });
});
