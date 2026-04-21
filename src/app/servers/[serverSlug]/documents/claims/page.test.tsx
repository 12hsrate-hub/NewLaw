import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/document-area/context", () => ({
  getClaimsFamilyFoundationRouteContext: vi.fn(),
}));

import ClaimsFamilyPage from "@/app/servers/[serverSlug]/documents/claims/page";
import { getClaimsFamilyFoundationRouteContext } from "@/server/document-area/context";

describe("/servers/[serverSlug]/documents/claims page", () => {
  it("существует как отдельная claims family рядом с OGP", async () => {
    vi.mocked(getClaimsFamilyFoundationRouteContext).mockResolvedValue({
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
      canCreateDocuments: true,
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
      await ClaimsFamilyPage({
        params: Promise.resolve({
          serverSlug: "blackberry",
        }),
      }),
    );

    expect(getClaimsFamilyFoundationRouteContext).toHaveBeenCalledWith({
      serverSlug: "blackberry",
      nextPath: "/servers/blackberry/documents/claims",
    });
    expect(html).toContain("Claims");
    expect(html).toContain("rehabilitation");
    expect(html).toContain("lawsuit");
    expect(html).toContain("не включает persisted editor");
  });
});
