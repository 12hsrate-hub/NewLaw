"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";

import { requireSuperAdminAccountContext } from "@/server/auth/protected";
import {
  PrecedentSourceIndexNotFoundError,
  PrecedentSourceTopicDuplicateError,
  PrecedentSourceTopicNotFoundError,
  addPrecedentSourceTopic,
  updatePrecedentSourceTopicOverrides,
} from "@/server/precedent-corpus/source-management";
import {
  createPrecedentSourceTopicInputSchema,
  precedentSourceTopicManualOverrideSchema,
} from "@/schemas/precedent-corpus";

function getRedirectTarget(formData: FormData) {
  const redirectTo = formData.get("redirectTo");

  if (typeof redirectTo === "string" && redirectTo.startsWith("/")) {
    return redirectTo;
  }

  return "/app/admin-laws";
}

function buildStatusRedirect(path: string, status: string) {
  const [pathname, queryString] = path.split("?");
  const params = new URLSearchParams(queryString ?? "");

  params.set("status", status);

  const nextQuery = params.toString();

  return nextQuery ? `${pathname}?${nextQuery}` : pathname;
}

export async function createPrecedentSourceTopicAction(formData: FormData) {
  const redirectTo = getRedirectTarget(formData);
  await requireSuperAdminAccountContext(redirectTo);

  try {
    await addPrecedentSourceTopic(
      createPrecedentSourceTopicInputSchema.parse({
        sourceIndexId: String(formData.get("sourceIndexId") ?? ""),
        topicUrl: String(formData.get("topicUrl") ?? ""),
        title: String(formData.get("title") ?? ""),
      }),
    );

    revalidatePath("/app/admin-laws");
    redirect(buildStatusRedirect(redirectTo, "precedent-source-created"));
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    if (error instanceof PrecedentSourceIndexNotFoundError) {
      redirect(buildStatusRedirect(redirectTo, "precedent-source-index-not-found"));
    }

    if (error instanceof PrecedentSourceTopicDuplicateError) {
      redirect(buildStatusRedirect(redirectTo, "precedent-source-duplicate"));
    }

    redirect(buildStatusRedirect(redirectTo, "precedent-source-create-error"));
  }
}

export async function updatePrecedentSourceTopicAction(formData: FormData) {
  const redirectTo = getRedirectTarget(formData);
  await requireSuperAdminAccountContext(redirectTo);

  try {
    await updatePrecedentSourceTopicOverrides(
      precedentSourceTopicManualOverrideSchema.parse({
        sourceTopicId: String(formData.get("sourceTopicId") ?? ""),
        isExcluded: String(formData.get("isExcluded") ?? "") === "true",
        classificationOverride:
          formData.get("classificationOverride") === ""
            ? null
            : String(formData.get("classificationOverride") ?? ""),
        internalNote:
          formData.get("internalNote") === "" ? null : String(formData.get("internalNote") ?? ""),
      }),
    );

    revalidatePath("/app/admin-laws");
    redirect(buildStatusRedirect(redirectTo, "precedent-source-updated"));
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    if (error instanceof PrecedentSourceTopicNotFoundError) {
      redirect(buildStatusRedirect(redirectTo, "precedent-source-not-found"));
    }

    redirect(buildStatusRedirect(redirectTo, "precedent-source-update-error"));
  }
}
