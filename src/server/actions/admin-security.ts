"use server";

import { revalidatePath } from "next/cache";

import {
  adminChangeEmailUiInputSchema,
  adminSecurityUiInputBaseSchema,
} from "@/schemas/account-security";
import { requireProtectedAccountContext } from "@/server/auth/protected";
import {
  changeEmailAsAdmin,
  resetPasswordWithTempPassword,
  sendRecoveryEmail,
} from "@/server/auth/admin-security";

export type AdminUiActionResult = {
  status: "success" | "error" | "forbidden" | "placeholder";
  message: string;
};

export type AdminResetPasswordUiActionResult =
  | AdminUiActionResult
  | {
      status: "success";
      message: string;
      tempPassword: string;
    };

const adminSecurityReturnPaths = ["/app/admin-security", "/internal/security"] as const;

type AdminSecurityReturnPath = (typeof adminSecurityReturnPaths)[number];

function resolveAdminSecurityReturnPath(
  returnPath: string | undefined,
): AdminSecurityReturnPath {
  if (
    returnPath &&
    adminSecurityReturnPaths.includes(returnPath as AdminSecurityReturnPath)
  ) {
    return returnPath as AdminSecurityReturnPath;
  }

  return "/internal/security";
}

export async function sendRecoveryEmailAdminAction(input: {
  targetAccountId: string;
  comment: string;
  returnPath?: string;
}): Promise<AdminUiActionResult> {
  const returnPath = resolveAdminSecurityReturnPath(input.returnPath);
  const { account } = await requireProtectedAccountContext(returnPath);
  const parsed = adminSecurityUiInputBaseSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Проверь данные формы и попробуй ещё раз.",
    };
  }

  const result = await sendRecoveryEmail(account.id, parsed.data.targetAccountId, parsed.data.comment);

  if (result.status !== "success") {
    return result;
  }

  revalidatePath(returnPath);

  return {
    status: "success",
    message: "Recovery email отправлен на текущий подтверждённый email аккаунта.",
  };
}

export async function resetPasswordWithTempPasswordAdminAction(input: {
  targetAccountId: string;
  comment: string;
  returnPath?: string;
}): Promise<AdminResetPasswordUiActionResult> {
  const returnPath = resolveAdminSecurityReturnPath(input.returnPath);
  const { account } = await requireProtectedAccountContext(returnPath);
  const parsed = adminSecurityUiInputBaseSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Проверь данные формы и попробуй ещё раз.",
    };
  }

  const result = await resetPasswordWithTempPassword(
    account.id,
    parsed.data.targetAccountId,
    parsed.data.comment,
  );

  if (result.status !== "success") {
    return result;
  }

  revalidatePath(returnPath);

  return {
    status: "success",
    message:
      "Для аккаунта сгенерирован временный пароль. При следующем входе пользователь будет обязан сменить его.",
    tempPassword: result.tempPassword,
  };
}

export async function changeEmailAsAdminAction(input: {
  targetAccountId: string;
  newEmail: string;
  comment: string;
  returnPath?: string;
}): Promise<AdminUiActionResult> {
  const returnPath = resolveAdminSecurityReturnPath(input.returnPath);
  const { account } = await requireProtectedAccountContext(returnPath);
  const parsed = adminChangeEmailUiInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Проверь данные формы и попробуй ещё раз.",
    };
  }

  const result = await changeEmailAsAdmin(
    account.id,
    parsed.data.targetAccountId,
    parsed.data.newEmail,
    parsed.data.comment,
  );

  if (result.status !== "success") {
    return result;
  }

  revalidatePath(returnPath);

  return {
    status: "success",
    message: "Email аккаунта обновлён. Pending email очищен, login остался прежним.",
  };
}
