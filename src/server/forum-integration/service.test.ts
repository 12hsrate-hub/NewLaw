import { describe, expect, it, vi } from "vitest";

import {
  disableAccountForumConnection,
  ForumConnectionNotFoundError,
  getAccountForumConnectionSummary,
  saveAccountForumConnection,
  validateAccountForumConnection,
} from "@/server/forum-integration/service";

process.env.FORUM_SESSION_ENCRYPTION_KEY = "forum-encryption-key-1234567890-for-tests";

describe("forum integration service", () => {
  it("owner account может сохранить свою forum connection без утечки raw session в audit log", async () => {
    const upsertForumSessionConnection = vi.fn().mockResolvedValue({
      providerKey: "forum.gta5rp.com",
      state: "connected_unvalidated",
      forumUserId: null,
      forumUsername: null,
      validatedAt: null,
      lastValidationError: null,
      disabledAt: null,
    });
    const createAuditLog = vi.fn().mockResolvedValue(undefined);

    const result = await saveAccountForumConnection(
      {
        accountId: "00000000-0000-0000-0000-000000000001",
        rawSessionInput: "xf_user=501; xf_session=secret-cookie",
      },
      {
        upsertForumSessionConnection,
        encryptForumSessionPayload: vi.fn().mockReturnValue("ciphertext"),
        createAuditLog,
      },
    );

    expect(upsertForumSessionConnection).toHaveBeenCalledWith({
      accountId: "00000000-0000-0000-0000-000000000001",
      providerKey: "forum.gta5rp.com",
      encryptedSessionPayload: "ciphertext",
      state: "connected_unvalidated",
    });
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actionKey: "forum_connection_saved",
        status: "success",
        metadataJson: {
          providerKey: "forum.gta5rp.com",
          connectionState: "connected_unvalidated",
        },
      }),
    );
    expect(JSON.stringify(createAuditLog.mock.calls[0]?.[0])).not.toContain("secret-cookie");
    expect(result.state).toBe("connected_unvalidated");
  });

  it("validate flow корректно переводит connection в valid и сохраняет identity", async () => {
    const createAuditLog = vi.fn().mockResolvedValue(undefined);
    const updateForumSessionConnectionState = vi.fn().mockResolvedValue({
      providerKey: "forum.gta5rp.com",
      state: "valid",
      forumUserId: "501",
      forumUsername: "Forum User",
      validatedAt: new Date("2026-04-22T12:00:00.000Z"),
      lastValidationError: null,
      disabledAt: null,
    });

    const result = await validateAccountForumConnection(
      {
        accountId: "00000000-0000-0000-0000-000000000001",
      },
      {
        getForumSessionConnectionByAccount: vi.fn().mockResolvedValue({
          id: "connection-1",
          providerKey: "forum.gta5rp.com",
          state: "connected_unvalidated",
          encryptedSessionPayload: "ciphertext",
          forumUserId: null,
          forumUsername: null,
          validatedAt: null,
          lastValidationError: null,
          disabledAt: null,
        }),
        decryptForumSessionPayload: vi.fn().mockReturnValue({
          cookieHeader: "xf_user=501; xf_session=secret-cookie",
        }),
        validateGta5RpForumSession: vi.fn().mockResolvedValue({
          isValid: true,
          forumUserId: "501",
          forumUsername: "Forum User",
          errorSummary: null,
        }),
        updateForumSessionConnectionState,
        createAuditLog,
        now: () => new Date("2026-04-22T12:00:00.000Z"),
      },
    );

    expect(updateForumSessionConnectionState).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionId: "connection-1",
        state: "valid",
        forumUserId: "501",
        forumUsername: "Forum User",
      }),
    );
    expect(result.state).toBe("valid");
    expect(result.forumUsername).toBe("Forum User");
  });

  it("невалидная session даёт безопасную error summary и не содержит raw cookies", async () => {
    const createAuditLog = vi.fn().mockResolvedValue(undefined);
    const updateForumSessionConnectionState = vi.fn().mockResolvedValue({
      providerKey: "forum.gta5rp.com",
      state: "invalid",
      forumUserId: null,
      forumUsername: null,
      validatedAt: null,
      lastValidationError: "Форум не подтвердил авторизованную session.",
      disabledAt: null,
    });

    const result = await validateAccountForumConnection(
      {
        accountId: "00000000-0000-0000-0000-000000000001",
      },
      {
        getForumSessionConnectionByAccount: vi.fn().mockResolvedValue({
          id: "connection-1",
          providerKey: "forum.gta5rp.com",
          state: "connected_unvalidated",
          encryptedSessionPayload: "ciphertext",
          forumUserId: null,
          forumUsername: null,
          validatedAt: null,
          lastValidationError: null,
          disabledAt: null,
        }),
        decryptForumSessionPayload: vi.fn().mockReturnValue({
          cookieHeader: "xf_user=501; xf_session=secret-cookie",
        }),
        validateGta5RpForumSession: vi.fn().mockResolvedValue({
          isValid: false,
          forumUserId: null,
          forumUsername: null,
          errorSummary: "Форум не подтвердил авторизованную session.",
        }),
        updateForumSessionConnectionState,
        createAuditLog,
      },
    );

    expect(result.state).toBe("invalid");
    expect(result.lastValidationError).toBe("Форум не подтвердил авторизованную session.");
    expect(JSON.stringify(createAuditLog.mock.calls)).not.toContain("secret-cookie");
  });

  it("чужой account не может провалидировать connection другого и получает not found", async () => {
    await expect(
      validateAccountForumConnection(
        {
          accountId: "00000000-0000-0000-0000-000000000999",
        },
        {
          getForumSessionConnectionByAccount: vi.fn().mockResolvedValue(null),
          updateForumSessionConnectionState: vi.fn(),
          createAuditLog: vi.fn().mockResolvedValue(undefined),
        },
      ),
    ).rejects.toBeInstanceOf(ForumConnectionNotFoundError);
  });

  it("disable flow переводит connection в disabled и очищает encrypted payload", async () => {
    const updateForumSessionConnectionState = vi.fn().mockResolvedValue({
      providerKey: "forum.gta5rp.com",
      state: "disabled",
      forumUserId: "501",
      forumUsername: "Forum User",
      validatedAt: new Date("2026-04-22T12:00:00.000Z"),
      lastValidationError: null,
      disabledAt: new Date("2026-04-22T12:10:00.000Z"),
    });

    const result = await disableAccountForumConnection(
      {
        accountId: "00000000-0000-0000-0000-000000000001",
      },
      {
        getForumSessionConnectionByAccount: vi.fn().mockResolvedValue({
          id: "connection-1",
          providerKey: "forum.gta5rp.com",
          state: "valid",
          encryptedSessionPayload: "ciphertext",
          forumUserId: "501",
          forumUsername: "Forum User",
          validatedAt: new Date("2026-04-22T12:00:00.000Z"),
          lastValidationError: null,
          disabledAt: null,
        }),
        updateForumSessionConnectionState,
        createAuditLog: vi.fn().mockResolvedValue(undefined),
        now: () => new Date("2026-04-22T12:10:00.000Z"),
      },
    );

    expect(updateForumSessionConnectionState).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "disabled",
        encryptedSessionPayload: null,
      }),
    );
    expect(result.state).toBe("disabled");
  });

  it("summary без записи остаётся not_connected", async () => {
    const result = await getAccountForumConnectionSummary(
      "00000000-0000-0000-0000-000000000001",
      {
        getForumSessionConnectionByAccount: vi.fn().mockResolvedValue(null),
      },
    );

    expect(result).toEqual({
      providerKey: "forum.gta5rp.com",
      state: "not_connected",
      forumUserId: null,
      forumUsername: null,
      validatedAt: null,
      lastValidationError: null,
      disabledAt: null,
    });
  });
});
