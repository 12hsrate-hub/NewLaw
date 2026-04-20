import { describe, expect, it, vi } from "vitest";

import { confirmEmailFromUrl, readAuthConfirmQuery } from "@/server/auth/confirm";

function createConfirmClientMock() {
  return {
    auth: {
      verifyOtp: vi.fn(),
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: null,
        },
        error: null,
      }),
    },
  };
}

describe("auth confirm helpers", () => {
  it("читает token_hash, type и next из URL", () => {
    const parsed = readAuthConfirmQuery(
      new URL(
        "https://lawyer5rp.ru/auth/confirm?token_hash=abc123&type=email&next=%2Fapp",
      ),
    );

    expect(parsed).toEqual({
      tokenHash: "abc123",
      type: "email",
      nextPath: "/app",
    });
  });

  it("подтверждает email и возвращает redirect в защищённую часть", async () => {
    const client = createConfirmClientMock();

    client.auth.verifyOtp.mockResolvedValue({
      error: null,
    });

    const result = await confirmEmailFromUrl(
      client,
      new URL(
        "https://lawyer5rp.ru/auth/confirm?token_hash=abc123&type=email&next=%2Fapp",
      ),
    );

    expect(result).toEqual({
      status: "success",
      redirectPath: "/app",
    });
    expect(client.auth.verifyOtp).toHaveBeenCalledWith({
      token_hash: "abc123",
      type: "email",
    });
  });

  it("успешно подтверждает recovery flow и просит выставить recovery cookie", async () => {
    const client = createConfirmClientMock();

    client.auth.verifyOtp.mockResolvedValue({
      error: null,
    });

    const result = await confirmEmailFromUrl(
      client,
      new URL("https://lawyer5rp.ru/auth/confirm?token_hash=abc123&type=recovery"),
    );

    expect(result).toEqual({
      status: "success",
      redirectPath: "/reset-password",
      setRecoveryAccessCookie: true,
    });
  });

  it("синхронизирует account после успешного email_change confirm", async () => {
    const client = createConfirmClientMock();
    const syncAccountFromSupabaseUser = vi.fn().mockResolvedValue({
      id: "f4e09227-1e8f-470d-8c4e-c61ad16d8d58",
    });
    const createAuditLog = vi.fn().mockResolvedValue(undefined);

    client.auth.verifyOtp.mockResolvedValue({
      error: null,
    });
    client.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: "f4e09227-1e8f-470d-8c4e-c61ad16d8d58",
          email: "user@example.com",
          user_metadata: {
            login: "lawyer_user",
          },
        },
      },
      error: null,
    });

    const result = await confirmEmailFromUrl(
      client,
      new URL("https://lawyer5rp.ru/auth/confirm?token_hash=abc123&type=email_change"),
      {
        syncAccountFromSupabaseUser,
        createAuditLog,
      },
    );

    expect(result).toEqual({
      status: "success",
      redirectPath: "/app/security?status=email-change-confirmed",
    });
    expect(syncAccountFromSupabaseUser).toHaveBeenCalledWith({
      id: "f4e09227-1e8f-470d-8c4e-c61ad16d8d58",
      email: "user@example.com",
      user_metadata: {
        login: "lawyer_user",
      },
    });
    expect(createAuditLog).toHaveBeenCalledWith({
      actionKey: "email_change_completed",
      status: "success",
      actorAccountId: "f4e09227-1e8f-470d-8c4e-c61ad16d8d58",
      targetAccountId: "f4e09227-1e8f-470d-8c4e-c61ad16d8d58",
      metadataJson: {
        flow: "self_service",
      },
    });
  });

  it("возвращает invalid-сценарий для битой ссылки", async () => {
    const client = createConfirmClientMock();

    const result = await confirmEmailFromUrl(
      client,
      new URL("https://lawyer5rp.ru/auth/confirm?type=email"),
    );

    expect(result).toEqual({
      status: "invalid",
      redirectPath: "/sign-in?status=confirmation-invalid",
    });
    expect(client.auth.verifyOtp).not.toHaveBeenCalled();
  });

  it("возвращает expired-сценарий для протухшей recovery-ссылки", async () => {
    const client = createConfirmClientMock();

    client.auth.verifyOtp.mockResolvedValue({
      error: {
        code: "otp_expired",
        message: "OTP expired",
      },
    });

    const result = await confirmEmailFromUrl(
      client,
      new URL("https://lawyer5rp.ru/auth/confirm?token_hash=abc123&type=recovery"),
    );

    expect(result).toEqual({
      status: "expired",
      redirectPath: "/sign-in?status=recovery-expired",
    });
  });
});
