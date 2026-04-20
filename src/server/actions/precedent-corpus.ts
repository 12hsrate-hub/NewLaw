"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";

import { requireSuperAdminAccountContext } from "@/server/auth/protected";
import {
  PrecedentImportExcludedError,
  PrecedentImportNoPostsError,
  PrecedentSourceIndexMissingError,
  PrecedentSourceTopicMissingError,
  runPrecedentSourceDiscovery,
  runPrecedentSourceTopicImport,
} from "@/server/precedent-corpus/discovery-import";
import { PrecedentImportRunConflictError } from "@/server/precedent-corpus/foundation";
import {
  runPrecedentSourceDiscoveryInputSchema,
  runPrecedentSourceTopicImportInputSchema,
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

export async function runPrecedentSourceDiscoveryAction(formData: FormData) {
  const redirectTo = getRedirectTarget(formData);
  await requireSuperAdminAccountContext(redirectTo);

  try {
    await runPrecedentSourceDiscovery(
      runPrecedentSourceDiscoveryInputSchema.parse({
        sourceIndexId: String(formData.get("sourceIndexId") ?? ""),
      }).sourceIndexId,
    );

    revalidatePath("/app/admin-laws");
    redirect(buildStatusRedirect(redirectTo, "precedent-discovery-success"));
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    if (error instanceof PrecedentImportRunConflictError) {
      redirect(buildStatusRedirect(redirectTo, "precedent-discovery-running"));
    }

    if (error instanceof PrecedentSourceIndexMissingError) {
      redirect(buildStatusRedirect(redirectTo, "precedent-source-index-not-found"));
    }

    redirect(buildStatusRedirect(redirectTo, "precedent-discovery-error"));
  }
}

export async function runPrecedentSourceTopicImportAction(formData: FormData) {
  const redirectTo = getRedirectTarget(formData);
  await requireSuperAdminAccountContext(redirectTo);

  try {
    const result = await runPrecedentSourceTopicImport(
      runPrecedentSourceTopicImportInputSchema.parse({
        sourceTopicId: String(formData.get("sourceTopicId") ?? ""),
      }).sourceTopicId,
    );

    revalidatePath("/app/admin-laws");
    redirect(
      buildStatusRedirect(
        redirectTo,
        result.createdVersions > 0 ? "precedent-import-created" : "precedent-import-unchanged",
      ),
    );
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    if (error instanceof PrecedentImportRunConflictError) {
      redirect(buildStatusRedirect(redirectTo, "precedent-import-running"));
    }

    if (error instanceof PrecedentSourceTopicMissingError) {
      redirect(buildStatusRedirect(redirectTo, "precedent-source-topic-not-found"));
    }

    if (error instanceof PrecedentImportNoPostsError) {
      redirect(buildStatusRedirect(redirectTo, "precedent-import-no-posts"));
    }

    if (error instanceof PrecedentImportExcludedError) {
      redirect(buildStatusRedirect(redirectTo, "precedent-import-excluded"));
    }

    redirect(buildStatusRedirect(redirectTo, "precedent-import-error"));
  }
}
