"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";

import { requireSuperAdminAccountContext } from "@/server/auth/protected";
import {
  LawImportExcludedError,
  LawImportNoPostsError,
  LawImportTargetMissingError,
  LawSourceIndexMissingError,
  runLawSourceDiscovery,
  runLawTopicImport,
} from "@/server/law-corpus/discovery-import";
import { LawImportRunConflictError } from "@/server/law-corpus/foundation";
import {
  runLawSourceDiscoveryInputSchema,
  runLawTopicImportInputSchema,
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

export async function runLawSourceDiscoveryAction(formData: FormData) {
  const redirectTo = getRedirectTarget(formData);
  await requireSuperAdminAccountContext(redirectTo);

  try {
    await runLawSourceDiscovery(
      runLawSourceDiscoveryInputSchema.parse({
        sourceIndexId: String(formData.get("sourceIndexId") ?? ""),
      }).sourceIndexId,
    );

    revalidatePath("/app/admin-laws");
    redirect(buildStatusRedirect(redirectTo, "law-discovery-success"));
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    if (error instanceof LawImportRunConflictError) {
      redirect(buildStatusRedirect(redirectTo, "law-discovery-running"));
    }

    if (error instanceof LawSourceIndexMissingError) {
      redirect(buildStatusRedirect(redirectTo, "law-source-not-found"));
    }

    redirect(buildStatusRedirect(redirectTo, "law-discovery-error"));
  }
}

export async function runLawTopicImportAction(formData: FormData) {
  const redirectTo = getRedirectTarget(formData);
  await requireSuperAdminAccountContext(redirectTo);

  try {
    const result = await runLawTopicImport(
      runLawTopicImportInputSchema.parse({
        lawId: String(formData.get("lawId") ?? ""),
      }).lawId,
    );

    revalidatePath("/app/admin-laws");
    redirect(
      buildStatusRedirect(
        redirectTo,
        result.createdNewVersion ? "law-import-created" : "law-import-unchanged",
      ),
    );
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    if (error instanceof LawImportRunConflictError) {
      redirect(buildStatusRedirect(redirectTo, "law-import-running"));
    }

    if (error instanceof LawImportTargetMissingError) {
      redirect(buildStatusRedirect(redirectTo, "law-import-target-not-found"));
    }

    if (error instanceof LawImportNoPostsError) {
      redirect(buildStatusRedirect(redirectTo, "law-import-no-posts"));
    }

    if (error instanceof LawImportExcludedError) {
      redirect(buildStatusRedirect(redirectTo, "law-import-excluded"));
    }

    redirect(buildStatusRedirect(redirectTo, "law-import-error"));
  }
}
