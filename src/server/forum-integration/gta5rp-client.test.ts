import { describe, expect, it, vi } from "vitest";

import {
  createGta5RpForumThreadFromBbcode,
  parseGta5RpForumIdentity,
  validateGta5RpForumSession,
} from "@/server/forum-integration/gta5rp-client";

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

  it("создаёт thread из BBCode и извлекает external identity", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(`
          <html>
            <body data-logged-in="true">
              <form class="message-form" action="/forums/ogp/post-thread">
                <input type="hidden" name="_xfToken" value="token-1" />
                <input type="hidden" name="_xfRequestUri" value="/forums/ogp/post-thread" />
                <input type="text" name="title" />
                <textarea name="message"></textarea>
              </form>
              <div data-user-id="501" data-username="Forum User"></div>
            </body>
          </html>
        `),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        text: vi.fn().mockResolvedValue(
          JSON.stringify({
            redirect: "https://forum.gta5rp.com/threads/test-thread.100/",
          }),
        ),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(`
          <html>
            <body data-logged-in="true">
              <div data-user-id="501" data-username="Forum User"></div>
              <article id="js-post-200"></article>
            </body>
          </html>
        `),
      });

    const result = await createGta5RpForumThreadFromBbcode(
      {
        sessionPayload: {
          cookieHeader: "xf_user=501; xf_session=secret",
        },
        threadFormUrl: "https://forum.gta5rp.com/forums/ogp/post-thread",
        title: "Жалоба в ОГП",
        bbcode: "[b]ЖАЛОБА[/b]",
      },
      {
        fetch: fetch as unknown as typeof globalThis.fetch,
      },
    );

    expect(result).toEqual({
      publicationUrl: "https://forum.gta5rp.com/threads/test-thread.100/",
      forumThreadId: "100",
      forumPostId: "200",
    });
  });

  it("без publish form token возвращает безопасную ошибку", async () => {
    await expect(
      createGta5RpForumThreadFromBbcode(
        {
          sessionPayload: {
            cookieHeader: "xf_user=501; xf_session=secret",
          },
          threadFormUrl: "https://forum.gta5rp.com/forums/ogp/post-thread",
          title: "Жалоба в ОГП",
          bbcode: "[b]ЖАЛОБА[/b]",
        },
        {
          fetch: vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: vi.fn().mockResolvedValue(`
              <html>
                <body data-logged-in="true">
                  <form class="message-form" action="/forums/ogp/post-thread"></form>
                </body>
              </html>
            `),
          }) as unknown as typeof globalThis.fetch,
        },
      ),
    ).rejects.toThrow("Форум не отдал publish form action или _xfToken.");
  });
});
