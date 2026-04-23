import { buildEmailConfirmationRedirectUrl, buildStatusPath } from "@/lib/auth/email-auth";
import { buildAccountSecurityPath } from "@/lib/routes/account-security";
import { createAuditLog } from "@/db/repositories/audit-log.repository";
import {
  updateMustChangePasswordState,
  updatePendingEmailState,
} from "@/db/repositories/account-security.repository";
import {
  type ChangeEmailInput,
  changeEmailInputSchema,
  type ChangePasswordInput,
  changePasswordInputSchema,
} from "@/schemas/account-security";

type AuthErrorLike = {
  code?: string;
  message?: string;
  status?: number;
} | null;

type AccountSecurityAccount = {
  id: string;
  email: string;
  login: string;
  pendingEmail?: string | null;
  mustChangePassword: boolean;
};

type AuthenticatedSecurityClientLike = {
  auth: {
    signInWithPassword: (input: {
      email: string;
      password: string;
    }) => Promise<{
      error: AuthErrorLike;
    }>;
    updateUser: (
      attributes: {
        email?: string;
        password?: string;
      },
      options?: {
        emailRedirectTo?: string;
      },
    ) => Promise<{
      error: AuthErrorLike;
    }>;
    signOut: () => Promise<unknown>;
  };
};

type ProtectedSecurityDependencies = {
  updateMustChangePasswordState: typeof updateMustChangePasswordState;
  updatePendingEmailState: typeof updatePendingEmailState;
  createAuditLog: typeof createAuditLog;
};

const defaultDependencies: ProtectedSecurityDependencies = {
  updateMustChangePasswordState,
  updatePendingEmailState,
  createAuditLog,
};

function mapCurrentPasswordErrorToMessage() {
  return "Не удалось подтвердить текущий пароль. Проверьте пароль и попробуйте снова. Код: ACCOUNT_CURRENT_PASSWORD_INVALID.";
}

function mapPasswordChangeErrorToMessage(error: AuthErrorLike) {
  if (error?.code === "same_password") {
    return "Новый пароль должен отличаться от текущего. Код: ACCOUNT_PASSWORD_SAME_AS_CURRENT.";
  }

  if (error?.code === "reauthentication_needed" || error?.code === "reauthentication_not_valid") {
    return "Не удалось безопасно сменить пароль. Войдите в аккаунт заново и повторите попытку. Код: ACCOUNT_PASSWORD_REAUTH_REQUIRED.";
  }

  return "Не удалось сохранить новый пароль. Попробуйте снова немного позже. Код: ACCOUNT_PASSWORD_CHANGE_FAILED.";
}

function mapEmailChangeErrorToMessage(error: AuthErrorLike) {
  if (error?.code === "email_exists") {
    return "Этот email уже занят другим аккаунтом. Код: ACCOUNT_EMAIL_ALREADY_USED.";
  }

  if (error?.code === "email_address_invalid") {
    return "Укажите корректный новый email. Код: ACCOUNT_EMAIL_INVALID.";
  }

  return "Не удалось отправить подтверждение нового email. Попробуйте снова немного позже. Код: ACCOUNT_EMAIL_CHANGE_FAILED.";
}

async function reauthenticateCurrentPassword(
  client: AuthenticatedSecurityClientLike,
  accountEmail: string,
  currentPassword: string,
) {
  const { error } = await client.auth.signInWithPassword({
    email: accountEmail,
    password: currentPassword,
  });

  return {
    ok: !error,
    error,
  };
}

export function buildProtectedSecurityPath(status?: string) {
  return buildAccountSecurityPath(status);
}

export function buildPasswordChangedSuccessPath() {
  return buildStatusPath("/sign-in", "password-changed-success");
}

export async function changePasswordSelfService(
  client: AuthenticatedSecurityClientLike,
  account: AccountSecurityAccount,
  input: ChangePasswordInput,
  dependencies: ProtectedSecurityDependencies = defaultDependencies,
) {
  const parsed = changePasswordInputSchema.parse(input);
  const reauthentication = await reauthenticateCurrentPassword(
    client,
    account.email,
    parsed.currentPassword,
  );

  if (!reauthentication.ok) {
    await dependencies.createAuditLog({
      actionKey: "password_changed_self",
      status: "failure",
      actorAccountId: account.id,
      targetAccountId: account.id,
      metadataJson: {
        flow: "self_service",
        stage: "reauthentication",
      },
    });

    return {
      status: "error" as const,
      message: mapCurrentPasswordErrorToMessage(),
    };
  }

  const { error } = await client.auth.updateUser({
    password: parsed.newPassword,
  });

  if (error) {
    await dependencies.createAuditLog({
      actionKey: "password_changed_self",
      status: "failure",
      actorAccountId: account.id,
      targetAccountId: account.id,
      metadataJson: {
        flow: "self_service",
        stage: "update_user",
      },
    });

    return {
      status: "error" as const,
      message: mapPasswordChangeErrorToMessage(error),
    };
  }

  const changedAt = new Date();

  await dependencies.updateMustChangePasswordState({
    accountId: account.id,
    mustChangePassword: false,
    reason: null,
    changedAt,
  });

  await dependencies.createAuditLog({
    actionKey: "password_changed_self",
    status: "success",
    actorAccountId: account.id,
    targetAccountId: account.id,
    metadataJson: {
      flow: "self_service",
    },
  });

  await client.auth.signOut();

  return {
    status: "success" as const,
    redirectPath: buildPasswordChangedSuccessPath(),
  };
}

export async function requestEmailChangeSelfService(
  client: AuthenticatedSecurityClientLike,
  account: AccountSecurityAccount,
  input: ChangeEmailInput,
  appUrl: string,
  dependencies: ProtectedSecurityDependencies = defaultDependencies,
) {
  if (account.mustChangePassword) {
    return {
      status: "blocked" as const,
      message: "Сначала смените пароль аккаунта, а затем обновите email. Код: ACCOUNT_PASSWORD_CHANGE_REQUIRED.",
    };
  }

  const parsed = changeEmailInputSchema.parse(input);

  if (parsed.newEmail === account.email) {
    return {
      status: "error" as const,
      message: "Новый email должен отличаться от текущего подтверждённого адреса. Код: ACCOUNT_EMAIL_SAME_AS_CURRENT.",
    };
  }

  const reauthentication = await reauthenticateCurrentPassword(
    client,
    account.email,
    parsed.currentPassword,
  );

  if (!reauthentication.ok) {
    await dependencies.createAuditLog({
      actionKey: "email_change_requested_self",
      status: "failure",
      actorAccountId: account.id,
      targetAccountId: account.id,
      metadataJson: {
        flow: "self_service",
        stage: "reauthentication",
      },
    });

    return {
      status: "error" as const,
      message: mapCurrentPasswordErrorToMessage(),
    };
  }

  const { error } = await client.auth.updateUser(
    {
      email: parsed.newEmail,
    },
    {
      emailRedirectTo: buildEmailConfirmationRedirectUrl(appUrl, "/account/security"),
    },
  );

  if (error) {
    await dependencies.createAuditLog({
      actionKey: "email_change_requested_self",
      status: "failure",
      actorAccountId: account.id,
      targetAccountId: account.id,
      metadataJson: {
        flow: "self_service",
        stage: "update_user",
      },
    });

    return {
      status: "error" as const,
      message: mapEmailChangeErrorToMessage(error),
    };
  }

  await dependencies.updatePendingEmailState({
    accountId: account.id,
    pendingEmail: parsed.newEmail,
    requestedAt: new Date(),
  });

  await dependencies.createAuditLog({
    actionKey: "email_change_requested_self",
    status: "success",
    actorAccountId: account.id,
    targetAccountId: account.id,
    metadataJson: {
      flow: "self_service",
    },
  });

  return {
    status: "success" as const,
    redirectPath: buildProtectedSecurityPath("email-change-requested"),
  };
}
