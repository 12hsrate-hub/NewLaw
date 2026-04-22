import { describe, expect, it, vi } from "vitest";

import { parseGta5RpForumIdentity, validateGta5RpForumSession } from "@/server/forum-integration/gta5rp-client";

describe("gta5rp forum client foundation", () => {
  it("извлекает forum identity и подтверждает валидную session без publish flow", async () => {
    const html = `
      <html>
        <body data-logged-in="true">
          <a class="p-navgroup-link p-navgroup-link--user" href="/members/forum-user.501/">Forum User</a>
          <div data-user-id="501" data-username="Forum User"></div>
        </body>
      </html>
    `;

    expect(parseGta5RpForumIdentity(html)).toEqual({
      forumUserId: "501",
      forumUsername: "Forum User",
    });

    const result = await validateGta5RpForumSession(
      {
        cookieHeader: "xf_user=501; xf_session=secret",
      },
      {
        fetch: vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValue(html),
        }) as unknown as typeof fetch,
      },
    );

    expect(result).toEqual({
      isValid: true,
      forumUserId: "501",
      forumUsername: "Forum User",
      errorSummary: null,
    });
  });

  it("на невалидной session возвращает безопасную summary без raw cookies", async () => {
    const result = await validateGta5RpForumSession(
      {
        cookieHeader: "xf_user=501; xf_session=secret",
      },
      {
        fetch: vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValue("<html><body><a href=\"/login/\">Login</a></body></html>"),
        }) as unknown as typeof fetch,
      },
    );

    expect(result.isValid).toBe(false);
    expect(result.errorSummary).toContain("Форум не подтвердил авторизованную session");
    expect(result.errorSummary).not.toContain("xf_session=secret");
  });
});
