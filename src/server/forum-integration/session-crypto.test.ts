import { describe, expect, it } from "vitest";

import {
  decryptForumSessionPayload,
  encryptForumSessionPayload,
} from "@/server/forum-integration/session-crypto";

describe("forum session crypto", () => {
  it("сохраняет session payload только в зашифрованном виде и умеет читать его обратно", () => {
    const encrypted = encryptForumSessionPayload(
      {
        cookieHeader: "xf_user=100; xf_session=very-secret-session",
      },
      "forum-encryption-key-1234567890-for-tests",
    );

    expect(encrypted).not.toContain("xf_session=very-secret-session");
    expect(
      decryptForumSessionPayload(
        encrypted,
        "forum-encryption-key-1234567890-for-tests",
      ),
    ).toEqual({
      cookieHeader: "xf_user=100; xf_session=very-secret-session",
    });
  });
});
