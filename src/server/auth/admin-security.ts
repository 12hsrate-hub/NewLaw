import { randomBytes } from "node:crypto";

import { createAuditLog } from "@/db/repositories/audit-log.repository";
import { getAccountById } from "@/db/repositories/account.repository";
import {
  syncAccountIdentityState,
  updateMustChangePasswordState,
} from "@/db/repositories/account-security.repository";
import { revokeAccountSessions } from "@/db/repositories/auth-session.repository";
import { buildPasswordRecoveryRedirectUrl } from "@/server/auth/recovery";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service-role";
import {
  adminChangeEmailInputSchema,
  adminSecurityInputBaseSchema,
} from "@/schemas/account-security";
import { getAppRuntimeEnv, hasLiveSupabaseServiceRoleEnv } from "@/schemas/env";

type AccountLike = {
  id: string;
  email: string;
  login: string;
  pendingEmail?: string | null;
  isSuperAdmin?: boolean;
};

type AuthErrorLike = {
  code?: string;
  message?: string;
  status?: number;
} | null;

type ServiceRoleAdminClientLike = {
  auth: {
    resetPasswordForEmail: (
      email: string,
      options: {
        redirectTo: string;
      },
    ) => Promise<{
      error: AuthErrorLike;
    }>;
    admin: {
      updateUserById: (
        uid: string,
        attributes: {
          password?: string;
          email?: string;
          email_confirm?: boolean;
        },
      ) => Promise<{
        error: AuthErrorLike;
      }>;
    };
  };
};

type AdminSecurityDependencies = {
  getAccountById: typeof getAccountById;
  createAuditLog: typeof createAuditLog;
  updateMustChangePasswordState: typeof updateMustChangePasswordState;
  syncAccountIdentityState: typeof syncAccountIdentityState;
  revokeAccountSessions: typeof revokeAccountSessions;
  createServiceRoleSupabaseClient: () => ServiceRoleAdminClientLike;
  getAppUrl: () => string;
  now: () => Date;
  generateTempPassword: () => string;
};

const defaultDependencies: AdminSecurityDependencies = {
  getAccountById,
  createAuditLog,
  updateMustChangePasswordState,
  syncAccountIdentityState,
  revokeAccountSessions,
  createServiceRoleSupabaseClient,
  getAppUrl: () => getAppRuntimeEnv().APP_URL,
  now: () => new Date(),
  generateTempPassword: () => `Tmp_${randomBytes(18).toString("base64url")}`,
};

type AdminSecurityFailureResult =
  | {
      status: "forbidden";
      message: string;
    }
  | {
      status: "error";
      message: string;
    }
  | {
      status: "placeholder";
      message: string;
    };

type AdminActionContext = {
  actor: AccountLike;
  target: AccountLike;
  comment: string;
};

function getAdminRuntimeConfig() {
  return {
    APP_URL: process.env.APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function buildPlaceholderResult(): AdminSecurityFailureResult {
  return {
    status: "placeholder",
    message:
      "Сейчас подключены placeholder-переменные Supabase. Без боевых APP_URL и service-role ключа admin security actions не сработают.",
  };
}

async function createFailureAuditLog(
  dependencies: AdminSecurityDependencies,
  input: {
    actionKey: "recovery_email_sent_admin" | "password_reset_admin_temp" | "email_changed_admin";
    actorAccountId?: string | null;
    targetAccountId?: string | null;
    comment: string;
    metadataJson: Record<string, unknown>;
  },
) {
  await dependencies.createAuditLog({
    actionKey: input.actionKey,
    status: "failure",
    actorAccountId: input.actorAccountId ?? null,
    targetAccountId: input.targetAccountId ?? null,
    comment: input.comment,
    metadataJson: input.metadataJson,
  });
}

async function getAdminActionContext(
  input: {
    actorAccountId: string;
    targetAccountId: string;
    comment: string;
  },
  actionKey: "recovery_email_sent_admin" | "password_reset_admin_temp" | "email_changed_admin",
  dependencies: AdminSecurityDependencies,
): Promise<
  | {
      ok: true;
      context: AdminActionContext;
    }
  | {
      ok: false;
      result: AdminSecurityFailureResult;
    }
> {
  const parsed = adminSecurityInputBaseSchema.parse(input);
  const [actor, target] = await Promise.all([
    dependencies.getAccountById(parsed.actorAccountId),
    dependencies.getAccountById(parsed.targetAccountId),
  ]);

  if (!actor?.isSuperAdmin) {
    await createFailureAuditLog(dependencies, {
      actionKey,
      actorAccountId: actor?.id ?? null,
      targetAccountId: target?.id ?? null,
      comment: parsed.comment,
      metadataJson: {
        flow: "admin",
        reason: "access_denied",
      },
    });

    return {
      ok: false,
      result: {
        status: "forbidden",
        message: "Только super_admin может выполнять это действие.",
      },
    };
  }

  if (!target) {
    await createFailureAuditLog(dependencies, {
      actionKey,
      actorAccountId: actor.id,
      targetAccountId: null,
      comment: parsed.comment,
      metadataJson: {
        flow: "admin",
        reason: "target_not_found",
      },
    });

    return {
      ok: false,
      result: {
        status: "error",
        message: "Не удалось найти целевой аккаунт для security-операции.",
      },
    };
  }

  return {
    ok: true,
    context: {
      actor,
      target,
      comment: parsed.comment,
    },
  };
}

export async function sendRecoveryEmail(
  actorAccountId: string,
  targetAccountId: string,
  comment: string,
  dependencies: AdminSecurityDependencies = defaultDependencies,
): Promise<
  | {
      status: "success";
    }
  | AdminSecurityFailureResult
> {
  if (!hasLiveSupabaseServiceRoleEnv(getAdminRuntimeConfig())) {
    return buildPlaceholderResult();
  }

  const access = await getAdminActionContext(
    {
      actorAccountId,
      targetAccountId,
      comment,
    },
    "recovery_email_sent_admin",
    dependencies,
  );

  if (!access.ok) {
    return access.result;
  }

  const client = dependencies.createServiceRoleSupabaseClient();
  const { actor, target } = access.context;
  const { error } = await client.auth.resetPasswordForEmail(target.email, {
    redirectTo: buildPasswordRecoveryRedirectUrl(dependencies.getAppUrl()),
  });

  if (error) {
    await createFailureAuditLog(dependencies, {
      actionKey: "recovery_email_sent_admin",
      actorAccountId: actor.id,
      targetAccountId: target.id,
      comment,
      metadataJson: {
        flow: "admin",
        stage: "send_recovery_email",
      },
    });

    return {
      status: "error",
      message: "Не удалось отправить письмо для восстановления. Попробуй ещё раз немного позже.",
    };
  }

  await dependencies.createAuditLog({
    actionKey: "recovery_email_sent_admin",
    status: "success",
    actorAccountId: actor.id,
    targetAccountId: target.id,
    comment,
    metadataJson: {
      flow: "admin",
      deliveryEmail: target.email,
    },
  });

  return {
    status: "success",
  };
}

export async function resetPasswordWithTempPassword(
  actorAccountId: string,
  targetAccountId: string,
  comment: string,
  dependencies: AdminSecurityDependencies = defaultDependencies,
): Promise<
  | {
      status: "success";
      tempPassword: string;
    }
  | AdminSecurityFailureResult
> {
  if (!hasLiveSupabaseServiceRoleEnv(getAdminRuntimeConfig())) {
    return buildPlaceholderResult();
  }

  const access = await getAdminActionContext(
    {
      actorAccountId,
      targetAccountId,
      comment,
    },
    "password_reset_admin_temp",
    dependencies,
  );

  if (!access.ok) {
    return access.result;
  }

  const { actor, target } = access.context;
  const tempPassword = dependencies.generateTempPassword();
  const client = dependencies.createServiceRoleSupabaseClient();
  const { error } = await client.auth.admin.updateUserById(target.id, {
    password: tempPassword,
  });

  if (error) {
    await createFailureAuditLog(dependencies, {
      actionKey: "password_reset_admin_temp",
      actorAccountId: actor.id,
      targetAccountId: target.id,
      comment,
      metadataJson: {
        flow: "admin",
        stage: "reset_password",
      },
    });

    return {
      status: "error",
      message: "Не удалось временно сбросить пароль. Попробуй ещё раз немного позже.",
    };
  }

  await dependencies.revokeAccountSessions(target.id);
  await dependencies.updateMustChangePasswordState({
    accountId: target.id,
    mustChangePassword: true,
    reason: "admin_reset",
    changedAt: null,
  });

  await dependencies.createAuditLog({
    actionKey: "password_reset_admin_temp",
    status: "success",
    actorAccountId: actor.id,
    targetAccountId: target.id,
    comment,
    metadataJson: {
      flow: "admin",
      sessionRevokeRequested: true,
      mustChangePassword: true,
      mustChangePasswordReason: "admin_reset",
    },
  });

  return {
    status: "success",
    tempPassword,
  };
}

export async function changeEmailAsAdmin(
  actorAccountId: string,
  targetAccountId: string,
  newEmail: string,
  comment: string,
  dependencies: AdminSecurityDependencies = defaultDependencies,
): Promise<
  | {
      status: "success";
    }
  | AdminSecurityFailureResult
> {
  if (!hasLiveSupabaseServiceRoleEnv(getAdminRuntimeConfig())) {
    return buildPlaceholderResult();
  }

  const parsed = adminChangeEmailInputSchema.parse({
    actorAccountId,
    targetAccountId,
    newEmail,
    comment,
  });
  const access = await getAdminActionContext(
    {
      actorAccountId: parsed.actorAccountId,
      targetAccountId: parsed.targetAccountId,
      comment: parsed.comment,
    },
    "email_changed_admin",
    dependencies,
  );

  if (!access.ok) {
    return access.result;
  }

  const { actor, target } = access.context;
  const client = dependencies.createServiceRoleSupabaseClient();
  const { error } = await client.auth.admin.updateUserById(target.id, {
    email: parsed.newEmail,
    email_confirm: true,
  });

  if (error) {
    await createFailureAuditLog(dependencies, {
      actionKey: "email_changed_admin",
      actorAccountId: actor.id,
      targetAccountId: target.id,
      comment: parsed.comment,
      metadataJson: {
        flow: "admin",
        stage: "update_email",
      },
    });

    return {
      status: "error",
      message: "Не удалось обновить email аккаунта. Попробуй ещё раз немного позже.",
    };
  }

  await dependencies.syncAccountIdentityState({
    accountId: target.id,
    email: parsed.newEmail,
    clearPendingEmail: true,
  });
  await dependencies.revokeAccountSessions(target.id);

  await dependencies.createAuditLog({
    actionKey: "email_changed_admin",
    status: "success",
    actorAccountId: actor.id,
    targetAccountId: target.id,
    comment: parsed.comment,
    metadataJson: {
      flow: "admin",
      sessionRevokeRequested: true,
    },
  });

  return {
    status: "success",
  };
}
