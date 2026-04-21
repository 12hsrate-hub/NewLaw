import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/document-area/context", () => ({
  getAccountDocumentsOverviewContext: vi.fn(),
}));

import AccountDocumentsPage from "@/app/account/documents/page";
import { getAccountDocumentsOverviewContext } from "@/server/document-area/context";

describe("/account/documents page", () => {
  it("рендерит aggregator overview route, а не рабочий editor center", async () => {
    vi.mocked(getAccountDocumentsOverviewContext).mockResolvedValue({
      account: {
        id: "account-1",
        email: "user@example.com",
        login: "tester",
        isSuperAdmin: false,
        mustChangePassword: false,
      },
      servers: [
        {
          id: "server-1",
          code: "blackberry",
          name: "Blackberry",
          characterCount: 1,
          selectedCharacterId: "character-1",
          selectedCharacterName: "Игорь Юристов",
          selectedCharacterSource: "last_used",
        },
      ],
    });

    const html = renderToStaticMarkup(await AccountDocumentsPage());

    expect(html).toContain("Мои документы");
    expect(html).toContain("cross-server overview route");
    expect(html).toContain("/servers/blackberry/documents");
  });

  it("следует auth guard и пробрасывает redirect при отсутствии доступа", async () => {
    vi.mocked(getAccountDocumentsOverviewContext).mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(AccountDocumentsPage()).rejects.toThrow("NEXT_REDIRECT");
  });
});
