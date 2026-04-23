"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

import { requireProtectedAccountContext } from "@/server/auth/protected";
import {
  disableAccountForumConnection,
  ForumConnectionNotFoundError,
  ForumIntegrationUnavailableError,
  saveAccountForumConnection,
  validateAccountForumConnection,
} from "@/server/forum-integration/service";

export type ForumIntegrationActionState = {
  errorMessage: string | null;
  successMessage: string | null;
  fieldErrors: {
    rawSessionInput?: string;
  };
};

function revalidateForumIntegrationPaths() {
  revalidatePath("/account");
  revalidatePath("/account/security");
}

export async function saveForumConnectionAction(
  previousState: ForumIntegrationActionState | null,
  formData: FormData,
): Promise<ForumIntegrationActionState> {
  void previousState;
  const { account } = await requireProtectedAccountContext("/account/security", undefined, {
    allowMustChangePassword: true,
  });
  const rawSessionInput =
    typeof formData.get("rawSessionInput") === "string" ? String(formData.get("rawSessionInput")) : "";

  try {
    const summary = await saveAccountForumConnection({
      accountId: account.id,
      rawSessionInput,
    });

    revalidateForumIntegrationPaths();

    return {
      errorMessage: null,
      successMessage:
        summary.state === "connected_unvalidated"
          ? "Подключение форума сохранено. Теперь проверьте, что оно работает."
          : "Подключение форума обновлено.",
      fieldErrors: {},
    };
  } catch (error) {
    if (error instanceof ZodError) {
      const fieldErrors = error.flatten().fieldErrors;

      return {
        errorMessage: null,
        successMessage: null,
        fieldErrors: {
          rawSessionInput: fieldErrors.rawSessionInput?.[0],
        },
      };
    }

    if (error instanceof ForumIntegrationUnavailableError) {
      return {
        errorMessage:
          "Подключение форума временно недоступно из-за настройки сервера. Код: FORUM_CONNECTION_CONFIG_MISSING.",
        successMessage: null,
        fieldErrors: {},
      };
    }

    return {
      errorMessage: "Не удалось сохранить подключение форума. Проверьте Cookie header и попробуйте снова. Код: FORUM_CONNECTION_SAVE_FAILED.",
      successMessage: null,
      fieldErrors: {},
    };
  }
}

export async function validateForumConnectionAction(
  previousState: ForumIntegrationActionState | null,
  formData: FormData,
): Promise<ForumIntegrationActionState> {
  void previousState;
  void formData;
  const { account } = await requireProtectedAccountContext("/account/security", undefined, {
    allowMustChangePassword: true,
  });

  try {
    const summary = await validateAccountForumConnection({
      accountId: account.id,
    });

    revalidateForumIntegrationPaths();

    if (summary.state === "valid") {
      return {
        errorMessage: null,
        successMessage:
          summary.forumUsername
            ? `Подключение форума работает. Подтверждённый аккаунт: ${summary.forumUsername}.`
            : "Подключение форума работает.",
        fieldErrors: {},
      };
    }

    return {
      errorMessage:
        summary.lastValidationError ??
        "Подключение форума требует повторной настройки. Код: FORUM_CONNECTION_RECONNECT_REQUIRED.",
      successMessage: null,
      fieldErrors: {},
    };
  } catch (error) {
    if (error instanceof ForumConnectionNotFoundError) {
      return {
        errorMessage: "Сначала подключите форум, а потом запустите проверку. Код: FORUM_CONNECTION_NOT_FOUND.",
        successMessage: null,
        fieldErrors: {},
      };
    }

    if (error instanceof ForumIntegrationUnavailableError) {
      return {
        errorMessage:
          "Проверка форума временно недоступна из-за настройки сервера. Код: FORUM_CONNECTION_CONFIG_MISSING.",
        successMessage: null,
        fieldErrors: {},
      };
    }

    return {
      errorMessage: "Не удалось проверить подключение форума. Попробуйте снова. Код: FORUM_CONNECTION_VALIDATE_FAILED.",
      successMessage: null,
      fieldErrors: {},
    };
  }
}

export async function disableForumConnectionAction(
  previousState: ForumIntegrationActionState | null,
  formData: FormData,
): Promise<ForumIntegrationActionState> {
  void previousState;
  void formData;
  const { account } = await requireProtectedAccountContext("/account/security", undefined, {
    allowMustChangePassword: true,
  });

  const summary = await disableAccountForumConnection({
    accountId: account.id,
  });

  revalidateForumIntegrationPaths();

  return {
    errorMessage: null,
    successMessage:
      summary.state === "not_connected"
        ? "Форум ещё не был подключён."
        : "Подключение форума отключено.",
    fieldErrors: {},
  };
}
