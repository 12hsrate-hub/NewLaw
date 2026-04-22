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
          ? "Forum session сохранена. Теперь её можно отдельно провалидировать."
          : "Forum session обновлена.",
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
          "Server-side encryption key для forum integration не настроен. Подключение session пока недоступно.",
        successMessage: null,
        fieldErrors: {},
      };
    }

    return {
      errorMessage: "Сохранить forum session не удалось. Проверьте Cookie header и попробуйте ещё раз.",
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
            ? `Forum session валидна. Подтверждённый аккаунт: ${summary.forumUsername}.`
            : "Forum session валидна и готова для будущей automation foundation.",
        fieldErrors: {},
      };
    }

    return {
      errorMessage: summary.lastValidationError ?? "Forum session требует переподключения.",
      successMessage: null,
      fieldErrors: {},
    };
  } catch (error) {
    if (error instanceof ForumConnectionNotFoundError) {
      return {
        errorMessage: "Сначала подключите forum session, а потом запускайте validate.",
        successMessage: null,
        fieldErrors: {},
      };
    }

    if (error instanceof ForumIntegrationUnavailableError) {
      return {
        errorMessage:
          "Server-side encryption key для forum integration не настроен. Validate пока недоступен.",
        successMessage: null,
        fieldErrors: {},
      };
    }

    return {
      errorMessage: "Проверить forum session не удалось.",
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
        ? "Forum session ещё не была подключена."
        : "Forum session отключена и больше не доступна для будущей automation.",
    fieldErrors: {},
  };
}
