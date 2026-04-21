"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";

import { requireProtectedAccountContext } from "@/server/auth/protected";
import {
  createInitialOgpComplaintDraft,
  DocumentAccessDeniedError,
  DocumentCharacterUnavailableError,
  DocumentServerUnavailableError,
  saveOwnedDocumentDraft,
} from "@/server/document-area/persistence";

function buildStatusRedirect(path: string, status: string) {
  const [pathname, queryString] = path.split("?");
  const params = new URLSearchParams(queryString ?? "");

  params.set("status", status);

  const nextQuery = params.toString();

  return nextQuery ? `${pathname}?${nextQuery}` : pathname;
}

export async function createOgpComplaintDraftAction(formData: FormData) {
  const serverSlug = String(formData.get("serverSlug") ?? "");
  const characterId = String(formData.get("characterId") ?? "");
  const title = String(formData.get("title") ?? "");
  const workingNotes = String(formData.get("workingNotes") ?? "");
  const nextPath = `/servers/${serverSlug}/documents/ogp-complaints/new`;
  const { account } = await requireProtectedAccountContext(nextPath, undefined, {
    allowMustChangePassword: true,
  });

  try {
    const document = await createInitialOgpComplaintDraft({
      accountId: account.id,
      serverSlug,
      characterId,
      title,
      workingNotes,
    });

    revalidatePath("/account/documents");
    revalidatePath(`/servers/${document.server.code}/documents`);
    revalidatePath(`/servers/${document.server.code}/documents/ogp-complaints`);

    redirect(
      buildStatusRedirect(
        `/servers/${document.server.code}/documents/ogp-complaints/${document.id}`,
        "draft-created",
      ),
    );
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    if (error instanceof DocumentServerUnavailableError) {
      redirect(buildStatusRedirect(nextPath, "server-unavailable"));
    }

    if (error instanceof DocumentCharacterUnavailableError) {
      redirect(buildStatusRedirect(nextPath, "character-unavailable"));
    }

    redirect(buildStatusRedirect(nextPath, "document-create-error"));
  }
}

export async function saveDocumentDraftAction(input: {
  documentId: string;
  title: string;
  workingNotes: string;
}) {
  const { account } = await requireProtectedAccountContext("/account/documents", undefined, {
    allowMustChangePassword: true,
  });

  try {
    const document = await saveOwnedDocumentDraft({
      accountId: account.id,
      documentId: input.documentId,
      title: input.title,
      workingNotes: input.workingNotes,
    });

    revalidatePath("/account/documents");
    revalidatePath(`/servers/${document.server.code}/documents`);
    revalidatePath(`/servers/${document.server.code}/documents/ogp-complaints`);
    revalidatePath(`/servers/${document.server.code}/documents/ogp-complaints/${document.id}`);

    return {
      ok: true as const,
      updatedAt: document.updatedAt.toISOString(),
      status: document.status,
    };
  } catch (error) {
    if (error instanceof DocumentAccessDeniedError) {
      return {
        ok: false as const,
        error: "document-access-denied",
      };
    }

    throw error;
  }
}
