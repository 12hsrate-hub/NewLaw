import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/forum-integration/context", () => ({
  getAccountForumIntegrationContext: vi.fn(),
}));

import AccountSecurityPage from "@/app/account/security/page";
import { getAccountForumIntegrationContext } from "@/server/forum-integration/context";

describe("/account/security page", () => {
  it("рендерит account-scoped security и forum integration foundation без утечки raw session", async () => {
    vi.mocked(getAccountForumIntegrationContext).mockResolvedValue({
      account: {
        id: "account-1",
        email: "user@example.com",
        login: "tester",
        pendingEmail: null,
        pendingEmailRequestedAt: null,
        mustChangePassword: false,
        mustChangePasswordReason: null,
        passwordChangedAt: null,
        isSuperAdmin: false,
        createdAt: new Date("2026-04-22T00:00:00.000Z"),
        updatedAt: new Date("2026-04-22T00:00:00.000Z"),
      },
      forumConnection: {
        providerKey: "forum.gta5rp.com",
        state: "connected_unvalidated",
        forumUserId: null,
        forumUsername: null,
        validatedAt: null,
        lastValidationError: null,
        disabledAt: null,
      },
    });

    const html = renderToStaticMarkup(await AccountSecurityPage({}));

    expect(html).toContain("Настройки аккаунта");
    expect(html).toContain("Подключение форума для жалоб в ОГП");
    expect(html).toContain("Cookie header форума");
    expect(html).toContain("подключено, но не проверено");
    expect(html).not.toContain("xf_session=");
  });
});
