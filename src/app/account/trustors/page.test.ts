import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/account-zone/trustors", () => ({
  getAccountTrustorsOverviewContext: vi.fn(),
}));

import AccountTrustorsPage from "@/app/account/trustors/page";
import { getAccountTrustorsOverviewContext } from "@/server/account-zone/trustors";

describe("/account/trustors page", () => {
  it("рендерит owner-only grouped overview route с focus query pattern", async () => {
    vi.mocked(getAccountTrustorsOverviewContext).mockResolvedValue({
      viewer: {
        accountId: "account-1",
        email: "user@example.com",
        login: "tester",
      },
      focusedServerCode: "blackberry",
      serverGroups: [
        {
          server: {
            id: "server-1",
            code: "blackberry",
            slug: "blackberry",
            name: "Blackberry",
          },
          trustorCount: 1,
          focusHref: "/account/trustors?server=blackberry",
          isFocused: true,
          trustors: [
            {
              id: "trustor-1",
              fullName: "Иван Доверителев",
              passportNumber: "AA-001",
              phone: null,
              note: null,
              isRepresentativeReady: true,
            },
          ],
        },
      ],
    });

    const html = renderToStaticMarkup(
      await AccountTrustorsPage({
        searchParams: Promise.resolve({
          server: "blackberry",
        }),
      }),
    );

    expect(getAccountTrustorsOverviewContext).toHaveBeenCalledWith({
      nextPath: "/account/trustors",
      focusedServerCode: "blackberry",
    });
    expect(html).toContain("Доверители аккаунта");
    expect(html).toContain("Blackberry");
  });

  it("следует auth guard и пробрасывает redirect при отсутствии доступа", async () => {
    vi.mocked(getAccountTrustorsOverviewContext).mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(AccountTrustorsPage({})).rejects.toThrow("NEXT_REDIRECT");
  });
});
