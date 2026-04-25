"use server";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import { ZodError } from "zod";

import { buildDocumentEditorHref } from "@/lib/documents/family-registry";
import { requireProtectedAccountContext } from "@/server/auth/protected";
import {
  parsePayloadJson,
  replaceRedirectWithStatus,
  revalidateDocumentPaths,
} from "@/server/actions/documents-shared";
import {
  createInitialClaimDraft,
  createInitialAttorneyRequestDraft,
  createInitialLegalServicesAgreementDraft,
  createInitialOgpComplaintDraft,
  DocumentAttorneyRoleRequiredError,
  DocumentCharacterUnavailableError,
  DocumentRepresentativeAccessError,
  DocumentServerUnavailableError,
  DocumentValidationError,
} from "@/server/document-area/persistence";

export async function createOgpComplaintDraftActionImpl(formData: FormData) {
  const serverSlug = String(formData.get("serverSlug") ?? "");
  const characterId = String(formData.get("characterId") ?? "");
  const title = String(formData.get("title") ?? "");
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
      payload: parsePayloadJson(formData.get("payloadJson")),
    });

    revalidateDocumentPaths({
      documentId: document.id,
      serverCode: document.server.code,
      documentType: "ogp_complaint",
    });

    replaceRedirectWithStatus(
      buildDocumentEditorHref({
        serverCode: document.server.code,
        documentId: document.id,
        documentType: "ogp_complaint",
      }),
      "draft-created",
    );
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    if (error instanceof DocumentServerUnavailableError) {
      replaceRedirectWithStatus(nextPath, "server-unavailable");
    }

    if (error instanceof DocumentCharacterUnavailableError) {
      replaceRedirectWithStatus(nextPath, "character-unavailable");
    }

    if (error instanceof DocumentRepresentativeAccessError) {
      replaceRedirectWithStatus(nextPath, "representative-not-allowed");
    }

    if (error instanceof DocumentValidationError || error instanceof SyntaxError || error instanceof ZodError) {
      replaceRedirectWithStatus(nextPath, "invalid-payload");
    }

    replaceRedirectWithStatus(nextPath, "document-create-error");
  }
}

export async function createClaimDraftActionImpl(formData: FormData) {
  const serverSlug = String(formData.get("serverSlug") ?? "");
  const characterId = String(formData.get("characterId") ?? "");
  const documentType = String(formData.get("documentType") ?? "");
  const title = String(formData.get("title") ?? "");
  const nextPath = documentType
    ? `/servers/${serverSlug}/documents/claims/new?subtype=${documentType}`
    : `/servers/${serverSlug}/documents/claims/new`;
  const { account } = await requireProtectedAccountContext(nextPath, undefined, {
    allowMustChangePassword: true,
  });

  try {
    const document = await createInitialClaimDraft({
      accountId: account.id,
      serverSlug,
      characterId,
      documentType: documentType as "rehabilitation" | "lawsuit",
      title,
      payload: parsePayloadJson(formData.get("payloadJson")),
    });

    revalidateDocumentPaths({
      documentId: document.id,
      serverCode: document.server.code,
      documentType: document.documentType,
    });

    replaceRedirectWithStatus(
      buildDocumentEditorHref({
        serverCode: document.server.code,
        documentId: document.id,
        documentType: document.documentType,
      }),
      "draft-created",
    );
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    if (error instanceof DocumentServerUnavailableError) {
      replaceRedirectWithStatus(nextPath, "server-unavailable");
    }

    if (error instanceof DocumentCharacterUnavailableError) {
      replaceRedirectWithStatus(nextPath, "character-unavailable");
    }

    if (error instanceof DocumentRepresentativeAccessError) {
      replaceRedirectWithStatus(nextPath, "representative-not-allowed");
    }

    if (error instanceof DocumentValidationError || error instanceof SyntaxError || error instanceof ZodError) {
      replaceRedirectWithStatus(nextPath, "invalid-payload");
    }

    replaceRedirectWithStatus(nextPath, "document-create-error");
  }
}

export async function createAttorneyRequestDraftActionImpl(formData: FormData) {
  const serverSlug = String(formData.get("serverSlug") ?? "");
  const characterId = String(formData.get("characterId") ?? "");
  const trustorId = String(formData.get("trustorId") ?? "");
  const title = String(formData.get("title") ?? "");
  const nextPath = `/servers/${serverSlug}/documents/attorney-requests/new`;
  const { account } = await requireProtectedAccountContext(nextPath, undefined, {
    allowMustChangePassword: true,
  });

  try {
    const document = await createInitialAttorneyRequestDraft({
      accountId: account.id,
      serverSlug,
      characterId,
      trustorId,
      title,
      payload: parsePayloadJson(formData.get("payloadJson")),
    });

    revalidateDocumentPaths({
      documentId: document.id,
      serverCode: document.server.code,
      documentType: "attorney_request",
    });

    replaceRedirectWithStatus(
      buildDocumentEditorHref({
        serverCode: document.server.code,
        documentId: document.id,
        documentType: "attorney_request",
      }),
      "draft-created",
    );
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    if (error instanceof DocumentServerUnavailableError) {
      replaceRedirectWithStatus(nextPath, "server-unavailable");
    }

    if (error instanceof DocumentCharacterUnavailableError) {
      replaceRedirectWithStatus(nextPath, "character-unavailable");
    }

    if (error instanceof DocumentAttorneyRoleRequiredError) {
      replaceRedirectWithStatus(nextPath, "attorney-role-required");
    }

    if (error instanceof DocumentValidationError || error instanceof SyntaxError || error instanceof ZodError) {
      replaceRedirectWithStatus(nextPath, "invalid-payload");
    }

    replaceRedirectWithStatus(nextPath, "document-create-error");
  }
}

export async function createLegalServicesAgreementDraftActionImpl(formData: FormData) {
  const serverSlug = String(formData.get("serverSlug") ?? "");
  const characterId = String(formData.get("characterId") ?? "");
  const trustorId = String(formData.get("trustorId") ?? "");
  const title = String(formData.get("title") ?? "");
  const nextPath = `/servers/${serverSlug}/documents/legal-services-agreements/new`;
  const { account } = await requireProtectedAccountContext(nextPath, undefined, {
    allowMustChangePassword: true,
  });

  try {
    const document = await createInitialLegalServicesAgreementDraft({
      accountId: account.id,
      serverSlug,
      characterId,
      trustorId,
      title,
      payload: parsePayloadJson(formData.get("payloadJson")),
    });

    revalidateDocumentPaths({
      documentId: document.id,
      serverCode: document.server.code,
      documentType: "legal_services_agreement",
    });

    replaceRedirectWithStatus(
      buildDocumentEditorHref({
        serverCode: document.server.code,
        documentId: document.id,
        documentType: "legal_services_agreement",
      }),
      "draft-created",
    );
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    if (error instanceof DocumentServerUnavailableError) {
      replaceRedirectWithStatus(nextPath, "server-unavailable");
    }

    if (error instanceof DocumentCharacterUnavailableError) {
      replaceRedirectWithStatus(nextPath, "character-unavailable");
    }

    if (error instanceof DocumentValidationError || error instanceof SyntaxError || error instanceof ZodError) {
      replaceRedirectWithStatus(nextPath, "invalid-payload");
    }

    replaceRedirectWithStatus(nextPath, "document-create-error");
  }
}
