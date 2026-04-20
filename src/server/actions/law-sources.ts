"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";

import { requireSuperAdminAccountContext } from "@/server/auth/protected";
import {
  LawSourceIndexDuplicateError,
  LawSourceIndexLimitExceededError,
  LawSourceIndexNotFoundError,
  LawSourceServerNotFoundError,
  addLawSourceIndexForServer,
  setLawSourceIndexEnabledState,
} from "@/server/law-corpus/source-management";
import {
  createLawSourceIndexInputSchema,
  updateLawSourceIndexEnabledInputSchema,
} from "@/schemas/law-corpus";

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

export async function createLawSourceIndexAction(formData: FormData) {
  const redirectTo = getRedirectTarget(formData);
  await requireSuperAdminAccountContext(redirectTo);

  try {
    await addLawSourceIndexForServer(
      createLawSourceIndexInputSchema.parse({
        serverId: String(formData.get("serverId") ?? ""),
        indexUrl: String(formData.get("indexUrl") ?? ""),
      }),
    );

    revalidatePath("/app/admin-laws");
    redirect(buildStatusRedirect(redirectTo, "law-source-created"));
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    if (error instanceof LawSourceIndexLimitExceededError) {
      redirect(buildStatusRedirect(redirectTo, "law-source-limit"));
    }

    if (error instanceof LawSourceIndexDuplicateError) {
      redirect(buildStatusRedirect(redirectTo, "law-source-duplicate"));
    }

    if (error instanceof LawSourceServerNotFoundError) {
      redirect(buildStatusRedirect(redirectTo, "law-source-server-not-found"));
    }

    redirect(buildStatusRedirect(redirectTo, "law-source-create-error"));
  }
}

export async function toggleLawSourceIndexAction(formData: FormData) {
  const redirectTo = getRedirectTarget(formData);
  await requireSuperAdminAccountContext(redirectTo);

  try {
    await setLawSourceIndexEnabledState(
      updateLawSourceIndexEnabledInputSchema.parse({
        sourceIndexId: String(formData.get("sourceIndexId") ?? ""),
        isEnabled: String(formData.get("isEnabled") ?? "") === "true",
      }),
    );

    revalidatePath("/app/admin-laws");
    redirect(buildStatusRedirect(redirectTo, "law-source-updated"));
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    if (error instanceof LawSourceIndexNotFoundError) {
      redirect(buildStatusRedirect(redirectTo, "law-source-not-found"));
    }

    redirect(buildStatusRedirect(redirectTo, "law-source-update-error"));
  }
}
