import { describe, expect, it, vi } from "vitest";

import {
  buildPasswordChangedSuccessPath,
  buildProtectedSecurityPath,
  changePasswordSelfService,
  requestEmailChangeSelfService,
} from "@/server/auth/security";

function createSecurityClientMock() {
  return {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({
        error: null,
      }),
      updateUser: vi.fn().mockResolvedValue({
        error: null,
      }),
      signOut: vi.fn().mockResolvedValue(undefined),
    },
  };
}

const baseAccount = {
  id: "aaed77dd-a829-4282-ba45-7a47378b9f12",
  email: "user@example.com",
  login: "lawyer_user",
  pendingEmail: null,
  mustChangePassword: false,
};

describe("protected account security helpers", () => {
  it("успешно меняет пароль, снимает mustChangePassword и завершает сессию", async () => {
    const client = createSecurityClientMock();
    const updateMustChangePasswordState = vi.fn().mockResolvedValue(undefined);
    const createAuditLog = vi.fn().mockResolvedValue(undefined);

    const result = await changePasswordSelfService(
      client,
      {
        ...baseAccount,
        mustChangePassword: true,
      },
      {
        currentPassword: "old-password-123",
        newPassword: "new-password-123",
        confirmNewPassword: "new-password-123",
      },
      {
        updateMustChangePasswordState,
        updatePendingEmailState: vi.fn(),
        createAuditLog,
      },
    );

    expect(result).toEqual({
      status: "success",
      redirectPath: buildPasswordChangedSuccessPath(),
    });
    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "old-password-123",
    });
    expect(client.auth.updateUser).toHaveBeenCalledWith({
      password: "new-password-123",
    });
    expect(updateMustChangePasswordState).toHaveBeenCalledWith({
      accountId: "aaed77dd-a829-4282-ba45-7a47378b9f12",
      mustChangePassword: false,
      reason: null,
      changedAt: expect.any(Date),
    });
    expect(createAuditLog).toHaveBeenCalledWith({
      actionKey: "password_changed_self",
      status: "success",
      actorAccountId: "aaed77dd-a829-4282-ba45-7a47378b9f12",
      targetAccountId: "aaed77dd-a829-4282-ba45-7a47378b9f12",
      metadataJson: {
        flow: "self_service",
      },
    });
    expect(client.auth.signOut).toHaveBeenCalled();
  });

  it("не меняет пароль при ошибке подтверждения текущего пароля", async () => {
    const client = createSecurityClientMock();
    const createAuditLog = vi.fn().mockResolvedValue(undefined);

    client.auth.signInWithPassword.mockResolvedValue({
      error: {
        code: "invalid_credentials",
      },
    });

    const result = await changePasswordSelfService(
      client,
      baseAccount,
      {
        currentPassword: "wrong-password",
        newPassword: "new-password-123",
        confirmNewPassword: "new-password-123",
      },
      {
        updateMustChangePasswordState: vi.fn(),
        updatePendingEmailState: vi.fn(),
        createAuditLog,
      },
    );

    expect(result).toEqual({
      status: "error",
      message: "Не удалось подтвердить текущий пароль. Проверьте пароль и попробуйте снова. Код: ACCOUNT_CURRENT_PASSWORD_INVALID.",
    });
    expect(client.auth.updateUser).not.toHaveBeenCalled();
    expect(createAuditLog).toHaveBeenCalledWith({
      actionKey: "password_changed_self",
      status: "failure",
      actorAccountId: "aaed77dd-a829-4282-ba45-7a47378b9f12",
      targetAccountId: "aaed77dd-a829-4282-ba45-7a47378b9f12",
      metadataJson: {
        flow: "self_service",
        stage: "reauthentication",
      },
    });
  });

  it("при смене email не трогает Account.email сразу, а пишет pendingEmail", async () => {
    const client = createSecurityClientMock();
    const updatePendingEmailState = vi.fn().mockResolvedValue(undefined);
    const createAuditLog = vi.fn().mockResolvedValue(undefined);

    const result = await requestEmailChangeSelfService(
      client,
      baseAccount,
      {
        newEmail: "new@example.com",
        currentPassword: "old-password-123",
      },
      "https://lawyer5rp.ru",
      {
        updateMustChangePasswordState: vi.fn(),
        updatePendingEmailState,
        createAuditLog,
      },
    );

    expect(result).toEqual({
      status: "success",
      redirectPath: buildProtectedSecurityPath("email-change-requested"),
    });
    expect(client.auth.updateUser).toHaveBeenCalledWith(
      {
        email: "new@example.com",
      },
      {
        emailRedirectTo: "https://lawyer5rp.ru/auth/confirm?next=%2Faccount%2Fsecurity",
      },
    );
    expect(updatePendingEmailState).toHaveBeenCalledWith({
      accountId: "aaed77dd-a829-4282-ba45-7a47378b9f12",
      pendingEmail: "new@example.com",
      requestedAt: expect.any(Date),
    });
    expect(createAuditLog).toHaveBeenCalledWith({
      actionKey: "email_change_requested_self",
      status: "success",
      actorAccountId: "aaed77dd-a829-4282-ba45-7a47378b9f12",
      targetAccountId: "aaed77dd-a829-4282-ba45-7a47378b9f12",
      metadataJson: {
        flow: "self_service",
      },
    });
  });

  it("повторный запрос смены email заменяет pendingEmail", async () => {
    const client = createSecurityClientMock();
    const updatePendingEmailState = vi.fn().mockResolvedValue(undefined);

    await requestEmailChangeSelfService(
      client,
      {
        ...baseAccount,
        pendingEmail: "old-pending@example.com",
      },
      {
        newEmail: "latest@example.com",
        currentPassword: "old-password-123",
      },
      "https://lawyer5rp.ru",
      {
        updateMustChangePasswordState: vi.fn(),
        updatePendingEmailState,
        createAuditLog: vi.fn().mockResolvedValue(undefined),
      },
    );

    expect(updatePendingEmailState).toHaveBeenCalledWith({
      accountId: "aaed77dd-a829-4282-ba45-7a47378b9f12",
      pendingEmail: "latest@example.com",
      requestedAt: expect.any(Date),
    });
  });

  it("блокирует self email change, пока mustChangePassword=true", async () => {
    const client = createSecurityClientMock();

    const result = await requestEmailChangeSelfService(
      client,
      {
        ...baseAccount,
        mustChangePassword: true,
      },
      {
        newEmail: "new@example.com",
        currentPassword: "old-password-123",
      },
      "https://lawyer5rp.ru",
      {
        updateMustChangePasswordState: vi.fn(),
        updatePendingEmailState: vi.fn(),
        createAuditLog: vi.fn().mockResolvedValue(undefined),
      },
    );

    expect(result).toEqual({
      status: "blocked",
      message: "Сначала смените пароль аккаунта, а затем обновите email. Код: ACCOUNT_PASSWORD_CHANGE_REQUIRED.",
    });
    expect(client.auth.signInWithPassword).not.toHaveBeenCalled();
    expect(client.auth.updateUser).not.toHaveBeenCalled();
  });
});
