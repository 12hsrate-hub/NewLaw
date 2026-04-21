import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/document-area/context", () => ({
  getClaimsEditorFoundationRouteContext: vi.fn(),
}));

import ClaimsEditorFoundationPage from "@/app/servers/[serverSlug]/documents/claims/[documentId]/page";
import { getClaimsEditorFoundationRouteContext } from "@/server/document-area/context";

describe("/servers/[serverSlug]/documents/claims/[documentId] page", () => {
  it("существует как future claims editor foundation", async () => {
    vi.mocked(getClaimsEditorFoundationRouteContext).mockResolvedValue({
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
      documentId: "claim-123",
      selectedCharacter: {
        id: "character-1",
        fullName: "Игорь Юристов",
        passportNumber: "AA-001",
        isProfileComplete: true,
        canUseRepresentative: true,
        source: "last_used",
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

    expect(getClaimsEditorFoundationRouteContext).toHaveBeenCalledWith({
      serverSlug: "blackberry",
      documentId: "claim-123",
      nextPath: "/servers/blackberry/documents/claims/claim-123",
    });
    expect(html).toContain("Future claims editor route");
    expect(html).toContain("owner-account route foundation");
    expect(html).toContain("claim-123");
    expect(html).toContain("не по URL");
  });
});
