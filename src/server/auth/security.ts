import { buildEmailConfirmationRedirectUrl, buildStatusPath } from "@/lib/auth/email-auth";
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
  return "Не удалось подтвердить текущий пароль. Проверь пароль и попробуй ещё раз.";
}

function mapPasswordChangeErrorToMessage(error: AuthErrorLike) {
  if (error?.code === "same_password") {
    return "Новый пароль должен отличаться от текущего.";
  }

  if (error?.code === "reauthentication_needed" || error?.code === "reauthentication_not_valid") {
    return "Не удалось безопасно сменить пароль. Войди в аккаунт заново и повтори попытку.";
  }

  return "Не удалось сохранить новый пароль. Попробуй ещё раз немного позже.";
}

function mapEmailChangeErrorToMessage(error: AuthErrorLike) {
  if (error?.code === "email_exists") {
    return "Этот email уже занят другим аккаунтом.";
  }

  if (error?.code === "email_address_invalid") {
    return "Укажи корректный новый email.";
  }

  return "Не удалось запустить подтверждение нового email. Попробуй ещё раз немного позже.";
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
  if (!status) {
    return "/app/security";
  }

  return buildStatusPath("/app/security", status);
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
      message: "Сначала смени пароль аккаунта, а потом уже меняй email.",
    };
  }

  const parsed = changeEmailInputSchema.parse(input);

  if (parsed.newEmail === account.email) {
    return {
      status: "error" as const,
      message: "Новый email должен отличаться от текущего подтверждённого адреса.",
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
      emailRedirectTo: buildEmailConfirmationRedirectUrl(appUrl, "/app/security"),
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
