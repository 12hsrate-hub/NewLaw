import { revalidatePath } from "next/cache";
import { redirect, RedirectType } from "next/navigation";

import { buildDocumentEditorHref, buildDocumentFamilyHref } from "@/lib/documents/family-registry";

export function buildStatusRedirect(path: string, status: string) {
  const [pathname, queryString] = path.split("?");
  const params = new URLSearchParams(queryString ?? "");

  params.set("status", status);

  const nextQuery = params.toString();

  return nextQuery ? `${pathname}?${nextQuery}` : pathname;
}

export function replaceRedirectWithStatus(path: string, status: string): never {
  redirect(buildStatusRedirect(path, status), RedirectType.replace);
}

export function parsePayloadJson(payloadJson: FormDataEntryValue | null) {
  const payloadText = String(payloadJson ?? "").trim();

  if (payloadText.length === 0) {
    return {};
  }

  return JSON.parse(payloadText) as unknown;
}

export function revalidateDocumentPaths(input: {
  documentId: string;
  serverCode: string;
  documentType:
    | "ogp_complaint"
    | "rehabilitation"
    | "lawsuit"
    | "attorney_request"
    | "legal_services_agreement";
}) {
  revalidatePath("/account/documents");
  revalidatePath(`/servers/${input.serverCode}/documents`);
  revalidatePath(
    buildDocumentFamilyHref({
      serverCode: input.serverCode,
      documentType: input.documentType,
    }),
  );
  revalidatePath(
    buildDocumentEditorHref({
      serverCode: input.serverCode,
      documentId: input.documentId,
      documentType: input.documentType,
    }),
  );

  if (
    input.documentType === "attorney_request" ||
    input.documentType === "legal_services_agreement"
  ) {
    revalidatePath("/account/trustors");
  }
}

export function revalidateOgpDocumentPaths(input: {
  documentId: string;
  serverCode: string;
}) {
  revalidatePath("/account/documents");
  revalidatePath(`/servers/${input.serverCode}/documents`);
  revalidatePath(`/servers/${input.serverCode}/documents/ogp-complaints`);
  revalidatePath(`/servers/${input.serverCode}/documents/ogp-complaints/${input.documentId}`);
}
