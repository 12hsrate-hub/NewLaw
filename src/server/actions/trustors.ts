"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";

import { requireProtectedAccountContext } from "@/server/auth/protected";
import {
  createTrustorManually,
  softDeleteTrustorManually,
  TrustorNotFoundError,
  updateTrustorManually,
} from "@/server/trustors/manual-trustor";

function getRedirectTarget(formData: FormData) {
  const redirectTo = formData.get("redirectTo");

  if (typeof redirectTo === "string" && redirectTo.startsWith("/")) {
    return redirectTo;
  }

  return "/account/trustors";
}

function buildStatusRedirect(path: string, status: string) {
  const [pathname, queryString] = path.split("?");
  const params = new URLSearchParams(queryString ?? "");

  params.set("status", status);

  const nextQuery = params.toString();

  return nextQuery ? `${pathname}?${nextQuery}` : pathname;
}

function readTrustorFormFields(formData: FormData) {
  return {
    fullName: String(formData.get("fullName") ?? ""),
    passportNumber: String(formData.get("passportNumber") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    icEmail: String(formData.get("icEmail") ?? ""),
    passportImageUrl: String(formData.get("passportImageUrl") ?? ""),
    note: String(formData.get("note") ?? ""),
  };
}

function revalidateTrustorRoutes(redirectTo: string) {
  revalidatePath("/account");
  revalidatePath("/account/trustors");
  revalidatePath(redirectTo);
}

export async function createTrustorAction(formData: FormData) {
  const redirectTo = getRedirectTarget(formData);
  const { account } = await requireProtectedAccountContext(redirectTo, undefined, {
    allowMustChangePassword: true,
  });

  try {
    const serverId = String(formData.get("serverId") ?? "");
    const trustorFormFields = readTrustorFormFields(formData);

    await createTrustorManually({
      accountId: account.id,
      serverId,
      fullName: trustorFormFields.fullName,
      passportNumber: trustorFormFields.passportNumber,
      phone: trustorFormFields.phone,
      icEmail: trustorFormFields.icEmail,
      passportImageUrl: trustorFormFields.passportImageUrl,
      note: trustorFormFields.note,
    });

    revalidateTrustorRoutes(redirectTo);
    redirect(buildStatusRedirect(redirectTo, "trustor-created"));
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirect(buildStatusRedirect(redirectTo, "trustor-create-error"));
  }
}

export async function updateTrustorAction(formData: FormData) {
  const redirectTo = getRedirectTarget(formData);
  const { account } = await requireProtectedAccountContext(redirectTo, undefined, {
    allowMustChangePassword: true,
  });

  try {
    const serverId = String(formData.get("serverId") ?? "");
    const trustorId = String(formData.get("trustorId") ?? "");
    const trustorFormFields = readTrustorFormFields(formData);

    await updateTrustorManually({
      accountId: account.id,
      serverId,
      trustorId,
      fullName: trustorFormFields.fullName,
      passportNumber: trustorFormFields.passportNumber,
      phone: trustorFormFields.phone,
      icEmail: trustorFormFields.icEmail,
      passportImageUrl: trustorFormFields.passportImageUrl,
      note: trustorFormFields.note,
    });

    revalidateTrustorRoutes(redirectTo);
    redirect(buildStatusRedirect(redirectTo, "trustor-updated"));
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    if (error instanceof TrustorNotFoundError) {
      redirect(buildStatusRedirect(redirectTo, "trustor-not-found"));
    }

    redirect(buildStatusRedirect(redirectTo, "trustor-update-error"));
  }
}

export async function softDeleteTrustorAction(formData: FormData) {
  const redirectTo = getRedirectTarget(formData);
  const { account } = await requireProtectedAccountContext(redirectTo, undefined, {
    allowMustChangePassword: true,
  });

  try {
    const trustorId = String(formData.get("trustorId") ?? "");

    await softDeleteTrustorManually({
      accountId: account.id,
      trustorId,
    });

    revalidateTrustorRoutes(redirectTo);
    redirect(buildStatusRedirect(redirectTo, "trustor-deleted"));
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    if (error instanceof TrustorNotFoundError) {
      redirect(buildStatusRedirect(redirectTo, "trustor-not-found"));
    }

    redirect(buildStatusRedirect(redirectTo, "trustor-delete-error"));
  }
}
