"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";

import { requireProtectedAccountContext } from "@/server/auth/protected";
import {
  approveCharacterAccessRequestAsAdmin,
  rejectCharacterAccessRequestAsAdmin,
} from "@/server/characters/access-request-review";

function buildStatusRedirect(path: string, status: string) {
  const [pathname, queryString] = path.split("?");
  const params = new URLSearchParams(queryString ?? "");

  params.set("status", status);

  const nextQuery = params.toString();

  return nextQuery ? `${pathname}?${nextQuery}` : pathname;
}

function resolveReturnPath(input: FormData) {
  const returnPath = input.get("returnPath");

  if (returnPath === "/internal/access-requests") {
    return returnPath;
  }

  return "/internal/access-requests";
}

function readReviewForm(input: FormData) {
  return {
    requestId: String(input.get("requestId") ?? ""),
    reviewComment: String(input.get("reviewComment") ?? ""),
  };
}

function revalidateAccessRequestRoutes() {
  revalidatePath("/account");
  revalidatePath("/account/characters");
  revalidatePath("/internal");
  revalidatePath("/internal/access-requests");
}

export async function approveCharacterAccessRequestAction(formData: FormData) {
  const returnPath = resolveReturnPath(formData);
  const { account } = await requireProtectedAccountContext(returnPath);

  try {
    const reviewFields = readReviewForm(formData);
    const result = await approveCharacterAccessRequestAsAdmin({
      actorAccountId: account.id,
      requestId: reviewFields.requestId,
      reviewComment: reviewFields.reviewComment,
    });

    if (result.status === "forbidden") {
      redirect(buildStatusRedirect(returnPath, "character-access-request-review-forbidden"));
    }

    if (result.status === "error") {
      redirect(buildStatusRedirect(returnPath, "character-access-request-review-error"));
    }

    revalidateAccessRequestRoutes();
    redirect(buildStatusRedirect(returnPath, "character-access-request-approved"));
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirect(buildStatusRedirect(returnPath, "character-access-request-review-error"));
  }
}

export async function rejectCharacterAccessRequestAction(formData: FormData) {
  const returnPath = resolveReturnPath(formData);
  const { account } = await requireProtectedAccountContext(returnPath);

  try {
    const reviewFields = readReviewForm(formData);
    const result = await rejectCharacterAccessRequestAsAdmin({
      actorAccountId: account.id,
      requestId: reviewFields.requestId,
      reviewComment: reviewFields.reviewComment,
    });

    if (result.status === "forbidden") {
      redirect(buildStatusRedirect(returnPath, "character-access-request-review-forbidden"));
    }

    if (result.status === "error") {
      redirect(buildStatusRedirect(returnPath, "character-access-request-review-error"));
    }

    revalidateAccessRequestRoutes();
    redirect(buildStatusRedirect(returnPath, "character-access-request-rejected"));
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirect(buildStatusRedirect(returnPath, "character-access-request-review-error"));
  }
}
