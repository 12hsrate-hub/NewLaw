import { describe, expect, it, vi } from "vitest";

import {
  buildForgotPasswordCheckEmailPath,
  buildPasswordResetSuccessPath,
  completeRecoveryPasswordReset,
  hasValidRecoveryAccess,
  requestPasswordRecovery,
} from "@/server/auth/recovery";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "sb_publishable_live_value";

function createRecoveryRequestClientMock() {
  return {
    auth: {
      resetPasswordForEmail: vi.fn().mockResolvedValue({
        error: null,
      }),
    },
  };
}

function createPasswordResetClientMock() {
  return {
    auth: {
      updateUser: vi.fn().mockResolvedValue({
        error: null,
      }),
      signOut: vi.fn().mockResolvedValue(undefined),
    },
  };
}

describe("public recovery helpers", () => {
  it("forgot password возвращает одинаковый публичный результат для существующего и несуществующего email", async () => {
    const existingClient = createRecoveryRequestClientMock();
    const missingClient = createRecoveryRequestClientMock();

    const existingResult = await requestPasswordRecovery(
      existingClient,
      {
        identifier: "user@example.com",
      },
      "https://lawyer5rp.ru",
      {
        getAccountByEmail: vi.fn().mockResolvedValue({
          id: "40f3348f-3147-449e-bdc0-6a88285a7df5",
          email: "user@example.com",
        }),
        getAccountByLogin: vi.fn(),
        createAuditLog: vi.fn(),
      },
    );

    const missingResult = await requestPasswordRecovery(
      missingClient,
      {
        identifier: "missing@example.com",
      },
      "https://lawyer5rp.ru",
      {
        getAccountByEmail: vi.fn().mockResolvedValue(null),
        getAccountByLogin: vi.fn(),
        createAuditLog: vi.fn(),
      },
    );

    expect(existingResult).toEqual({
      status: "check-email",
      checkEmailPath: buildForgotPasswordCheckEmailPath(),
    });
    expect(missingResult).toEqual({
      status: "check-email",
      checkEmailPath: buildForgotPasswordCheckEmailPath(),
    });
  });

  it("forgot password возвращает одинаковый публичный результат для существующего и несуществующего login", async () => {
    const existingClient = createRecoveryRequestClientMock();
    const missingClient = createRecoveryRequestClientMock();

    const existingResult = await requestPasswordRecovery(
      existingClient,
      {
        identifier: "lawyer_user",
      },
      "https://lawyer5rp.ru",
      {
        getAccountByEmail: vi.fn(),
        getAccountByLogin: vi.fn().mockResolvedValue({
          id: "40f3348f-3147-449e-bdc0-6a88285a7df5",
          email: "user@example.com",
        }),
        createAuditLog: vi.fn(),
      },
    );

    const missingResult = await requestPasswordRecovery(
      missingClient,
      {
        identifier: "missing_user",
      },
      "https://lawyer5rp.ru",
      {
        getAccountByEmail: vi.fn(),
        getAccountByLogin: vi.fn().mockResolvedValue(null),
        createAuditLog: vi.fn(),
      },
    );

    expect(existingResult).toEqual({
      status: "check-email",
      checkEmailPath: buildForgotPasswordCheckEmailPath(),
    });
    expect(missingResult).toEqual({
      status: "check-email",
      checkEmailPath: buildForgotPasswordCheckEmailPath(),
    });
  });

  it("recovery не делает lookup по character-like identifier и падает на валидации до репозитория", async () => {
    const client = createRecoveryRequestClientMock();
    const getAccountByEmail = vi.fn();
    const getAccountByLogin = vi.fn();

    await expect(
      requestPasswordRecovery(
        client,
        {
          identifier: "AA 123456",
        },
        "https://lawyer5rp.ru",
        {
          getAccountByEmail,
          getAccountByLogin,
          createAuditLog: vi.fn(),
        },
      ),
    ).rejects.toThrow();

    expect(getAccountByEmail).not.toHaveBeenCalled();
    expect(getAccountByLogin).not.toHaveBeenCalled();
  });

  it("reset-password недоступен без recovery-cookie", () => {
    expect(
      hasValidRecoveryAccess({
        hasRecoveryCookie: false,
        userId: "40f3348f-3147-449e-bdc0-6a88285a7df5",
        accessToken: "token",
      }),
    ).toBe(false);
  });

  it("после успешного reset обновляет security-state, пишет audit log и готовит redirect", async () => {
    const client = createPasswordResetClientMock();
    const syncAccountFromSupabaseUser = vi.fn().mockResolvedValue({
      id: "40f3348f-3147-449e-bdc0-6a88285a7df5",
      email: "user@example.com",
      login: "lawyer_user",
    });
    const updateMustChangePasswordState = vi.fn().mockResolvedValue(undefined);
    const createAuditLog = vi.fn().mockResolvedValue(undefined);

    const result = await completeRecoveryPasswordReset(
      client,
      {
        id: "40f3348f-3147-449e-bdc0-6a88285a7df5",
        email: "user@example.com",
        user_metadata: {
          login: "lawyer_user",
        },
      },
      {
        newPassword: "new-password-123",
        confirmNewPassword: "new-password-123",
      },
      {
        syncAccountFromSupabaseUser,
        updateMustChangePasswordState,
        createAuditLog,
      },
    );

    expect(result).toEqual({
      status: "success",
      redirectPath: buildPasswordResetSuccessPath(),
    });
    expect(client.auth.updateUser).toHaveBeenCalledWith({
      password: "new-password-123",
    });
    expect(updateMustChangePasswordState).toHaveBeenCalledWith({
      accountId: "40f3348f-3147-449e-bdc0-6a88285a7df5",
      mustChangePassword: false,
      reason: null,
      changedAt: expect.any(Date),
    });
    expect(createAuditLog).toHaveBeenCalledWith({
      actionKey: "password_reset_completed",
      status: "success",
      actorAccountId: "40f3348f-3147-449e-bdc0-6a88285a7df5",
      targetAccountId: "40f3348f-3147-449e-bdc0-6a88285a7df5",
      metadataJson: {
        flow: "recovery",
      },
    });
    expect(client.auth.signOut).toHaveBeenCalled();
  });
});
