import { describe, expect, it, vi } from "vitest";

import {
  changeEmailAsAdmin,
  resetPasswordWithTempPassword,
  sendRecoveryEmail,
} from "@/server/auth/admin-security";

process.env.APP_URL = "https://lawyer5rp.ru";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_service_role_live_value";

function createServiceRoleClientMock() {
  return {
    auth: {
      resetPasswordForEmail: vi.fn().mockResolvedValue({
        error: null,
      }),
      admin: {
        updateUserById: vi.fn().mockResolvedValue({
          error: null,
        }),
      },
    },
  };
}

const superAdminAccount = {
  id: "58eb3d4f-c98e-4665-812b-4cb2b980e88c",
  email: "admin@example.com",
  login: "main_admin",
  pendingEmail: null,
  isSuperAdmin: true,
};

const regularAccount = {
  id: "05f627a4-33a4-4fbb-a3d8-d7e9bb7b7af7",
  email: "staff@example.com",
  login: "staff_user",
  pendingEmail: null,
  isSuperAdmin: false,
};

const targetAccount = {
  id: "f3b6dccf-1780-45e0-94bf-f6d10d162657",
  email: "user@example.com",
  login: "target_login",
  pendingEmail: "pending@example.com",
  isSuperAdmin: false,
};

describe("admin account security actions", () => {
  it("доступны только super_admin", async () => {
    const serviceRoleClient = createServiceRoleClientMock();
    const createAuditLog = vi.fn().mockResolvedValue(undefined);
    const getAccountById = vi
      .fn()
      .mockResolvedValueOnce(regularAccount)
      .mockResolvedValueOnce(targetAccount);

    const sendRecoveryResult = await sendRecoveryEmail(
      regularAccount.id,
      targetAccount.id,
      "Support recovery request",
      {
        getAccountById,
        createAuditLog,
        updateMustChangePasswordState: vi.fn(),
        syncAccountIdentityState: vi.fn(),
        revokeAccountSessions: vi.fn(),
        createServiceRoleSupabaseClient: () => serviceRoleClient,
        getAppUrl: () => "https://lawyer5rp.ru",
        now: () => new Date("2026-04-20T10:00:00.000Z"),
        generateTempPassword: () => "Temp_password_should_not_be_used",
      },
    );

    const resetPasswordResult = await resetPasswordWithTempPassword(
      regularAccount.id,
      targetAccount.id,
      "Support reset request",
      {
        getAccountById: vi
          .fn()
          .mockResolvedValueOnce(regularAccount)
          .mockResolvedValueOnce(targetAccount),
        createAuditLog,
        updateMustChangePasswordState: vi.fn(),
        syncAccountIdentityState: vi.fn(),
        revokeAccountSessions: vi.fn(),
        createServiceRoleSupabaseClient: () => serviceRoleClient,
        getAppUrl: () => "https://lawyer5rp.ru",
        now: () => new Date("2026-04-20T10:00:00.000Z"),
        generateTempPassword: () => "Temp_password_should_not_be_used",
      },
    );

    const changeEmailResult = await changeEmailAsAdmin(
      regularAccount.id,
      targetAccount.id,
      "renamed@example.com",
      "Support email change",
      {
        getAccountById: vi
          .fn()
          .mockResolvedValueOnce(regularAccount)
          .mockResolvedValueOnce(targetAccount),
        createAuditLog,
        updateMustChangePasswordState: vi.fn(),
        syncAccountIdentityState: vi.fn(),
        revokeAccountSessions: vi.fn(),
        createServiceRoleSupabaseClient: () => serviceRoleClient,
        getAppUrl: () => "https://lawyer5rp.ru",
        now: () => new Date("2026-04-20T10:00:00.000Z"),
        generateTempPassword: () => "Temp_password_should_not_be_used",
      },
    );

    expect(sendRecoveryResult).toEqual({
      status: "forbidden",
      message: "Только super_admin может выполнять это действие.",
    });
    expect(resetPasswordResult).toEqual({
      status: "forbidden",
      message: "Только super_admin может выполнять это действие.",
    });
    expect(changeEmailResult).toEqual({
      status: "forbidden",
      message: "Только super_admin может выполнять это действие.",
    });
    expect(serviceRoleClient.auth.resetPasswordForEmail).not.toHaveBeenCalled();
    expect(serviceRoleClient.auth.admin.updateUserById).not.toHaveBeenCalled();
    expect(createAuditLog).toHaveBeenCalledTimes(3);
    expect(createAuditLog).toHaveBeenNthCalledWith(1, {
      actionKey: "recovery_email_sent_admin",
      status: "failure",
      actorAccountId: regularAccount.id,
      targetAccountId: targetAccount.id,
      comment: "Support recovery request",
      metadataJson: {
        flow: "admin",
        reason: "access_denied",
      },
    });
  });

  it("sendRecoveryEmail использует текущий подтвержденный email, а не pendingEmail", async () => {
    const serviceRoleClient = createServiceRoleClientMock();
    const createAuditLog = vi.fn().mockResolvedValue(undefined);

    const result = await sendRecoveryEmail(
      superAdminAccount.id,
      targetAccount.id,
      "Support recovery request",
      {
        getAccountById: vi
          .fn()
          .mockResolvedValueOnce(superAdminAccount)
          .mockResolvedValueOnce(targetAccount),
        createAuditLog,
        updateMustChangePasswordState: vi.fn(),
        syncAccountIdentityState: vi.fn(),
        revokeAccountSessions: vi.fn(),
        createServiceRoleSupabaseClient: () => serviceRoleClient,
        getAppUrl: () => "https://lawyer5rp.ru",
        now: () => new Date("2026-04-20T10:00:00.000Z"),
        generateTempPassword: () => "Temp_password_should_not_be_used",
      },
    );

    expect(result).toEqual({
      status: "success",
    });
    expect(serviceRoleClient.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      "user@example.com",
      {
        redirectTo: "https://lawyer5rp.ru/auth/confirm?next=%2Freset-password",
      },
    );
    expect(createAuditLog).toHaveBeenCalledWith({
      actionKey: "recovery_email_sent_admin",
      status: "success",
      actorAccountId: superAdminAccount.id,
      targetAccountId: targetAccount.id,
      comment: "Support recovery request",
      metadataJson: {
        flow: "admin",
        deliveryEmail: "user@example.com",
      },
    });
  });

  it("resetPasswordWithTempPassword ставит mustChangePassword и не пишет temp password в audit log", async () => {
    const serviceRoleClient = createServiceRoleClientMock();
    const createAuditLog = vi.fn().mockResolvedValue(undefined);
    const updateMustChangePasswordState = vi.fn().mockResolvedValue(undefined);
    const revokeAccountSessions = vi.fn().mockResolvedValue({
      revokedSessions: 1,
      revokedRefreshTokens: 1,
    });

    const result = await resetPasswordWithTempPassword(
      superAdminAccount.id,
      targetAccount.id,
      "Manual security reset",
      {
        getAccountById: vi
          .fn()
          .mockResolvedValueOnce(superAdminAccount)
          .mockResolvedValueOnce(targetAccount),
        createAuditLog,
        updateMustChangePasswordState,
        syncAccountIdentityState: vi.fn(),
        revokeAccountSessions,
        createServiceRoleSupabaseClient: () => serviceRoleClient,
        getAppUrl: () => "https://lawyer5rp.ru",
        now: () => new Date("2026-04-20T10:00:00.000Z"),
        generateTempPassword: () => "Tmp_super_secret_value",
      },
    );

    expect(result).toEqual({
      status: "success",
      tempPassword: "Tmp_super_secret_value",
    });
    expect(serviceRoleClient.auth.admin.updateUserById).toHaveBeenCalledWith(
      targetAccount.id,
      {
        password: "Tmp_super_secret_value",
      },
    );
    expect(updateMustChangePasswordState).toHaveBeenCalledWith({
      accountId: targetAccount.id,
      mustChangePassword: true,
      reason: "admin_reset",
      changedAt: null,
    });
    expect(revokeAccountSessions).toHaveBeenCalledWith(targetAccount.id);
    expect(createAuditLog).toHaveBeenCalledWith({
      actionKey: "password_reset_admin_temp",
      status: "success",
      actorAccountId: superAdminAccount.id,
      targetAccountId: targetAccount.id,
      comment: "Manual security reset",
      metadataJson: {
        flow: "admin",
        sessionRevokeRequested: true,
        mustChangePassword: true,
        mustChangePasswordReason: "admin_reset",
      },
    });
    expect(JSON.stringify(createAuditLog.mock.calls)).not.toContain("Tmp_super_secret_value");
  });

  it("changeEmailAsAdmin обновляет Account.email, очищает pendingEmail и не меняет login", async () => {
    const serviceRoleClient = createServiceRoleClientMock();
    const syncAccountIdentityState = vi.fn().mockResolvedValue({
      ...targetAccount,
      email: "updated@example.com",
      pendingEmail: null,
    });
    const revokeAccountSessions = vi.fn().mockResolvedValue({
      revokedSessions: 1,
      revokedRefreshTokens: 1,
    });

    const result = await changeEmailAsAdmin(
      superAdminAccount.id,
      targetAccount.id,
      "updated@example.com",
      "Correct the account email",
      {
        getAccountById: vi
          .fn()
          .mockResolvedValueOnce(superAdminAccount)
          .mockResolvedValueOnce(targetAccount),
        createAuditLog: vi.fn().mockResolvedValue(undefined),
        updateMustChangePasswordState: vi.fn(),
        syncAccountIdentityState,
        revokeAccountSessions,
        createServiceRoleSupabaseClient: () => serviceRoleClient,
        getAppUrl: () => "https://lawyer5rp.ru",
        now: () => new Date("2026-04-20T10:00:00.000Z"),
        generateTempPassword: () => "Temp_password_should_not_be_used",
      },
    );

    expect(result).toEqual({
      status: "success",
    });
    expect(serviceRoleClient.auth.admin.updateUserById).toHaveBeenCalledWith(
      targetAccount.id,
      {
        email: "updated@example.com",
        email_confirm: true,
      },
    );
    expect(syncAccountIdentityState).toHaveBeenCalledWith({
      accountId: targetAccount.id,
      email: "updated@example.com",
      clearPendingEmail: true,
    });
    expect(syncAccountIdentityState.mock.calls[0]?.[0]).not.toHaveProperty("login");
    expect(revokeAccountSessions).toHaveBeenCalledWith(targetAccount.id);
  });

  it("ошибки admin security действий корректно отрабатываются и логируются", async () => {
    const serviceRoleClient = createServiceRoleClientMock();
    const createAuditLog = vi.fn().mockResolvedValue(undefined);
    serviceRoleClient.auth.admin.updateUserById.mockResolvedValue({
      error: {
        code: "unexpected_failure",
      },
    });

    const result = await changeEmailAsAdmin(
      superAdminAccount.id,
      targetAccount.id,
      "broken@example.com",
      "Broken flow check",
      {
        getAccountById: vi
          .fn()
          .mockResolvedValueOnce(superAdminAccount)
          .mockResolvedValueOnce(targetAccount),
        createAuditLog,
        updateMustChangePasswordState: vi.fn(),
        syncAccountIdentityState: vi.fn(),
        revokeAccountSessions: vi.fn(),
        createServiceRoleSupabaseClient: () => serviceRoleClient,
        getAppUrl: () => "https://lawyer5rp.ru",
        now: () => new Date("2026-04-20T10:00:00.000Z"),
        generateTempPassword: () => "Temp_password_should_not_be_used",
      },
    );

    expect(result).toEqual({
      status: "error",
      message: "Не удалось обновить email аккаунта. Попробуй ещё раз немного позже.",
    });
    expect(createAuditLog).toHaveBeenCalledWith({
      actionKey: "email_changed_admin",
      status: "failure",
      actorAccountId: superAdminAccount.id,
      targetAccountId: targetAccount.id,
      comment: "Broken flow check",
      metadataJson: {
        flow: "admin",
        stage: "update_email",
      },
    });
  });
});
