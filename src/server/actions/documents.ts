"use server";

import { ZodError } from "zod";

import { requireProtectedAccountContext } from "@/server/auth/protected";
import { revalidateDocumentPaths } from "@/server/actions/documents-shared";
import {
  createAttorneyRequestDraftActionImpl,
  createClaimDraftActionImpl,
  createLegalServicesAgreementDraftActionImpl,
  createOgpComplaintDraftActionImpl,
} from "@/server/actions/documents-create";
import {
  generateAttorneyRequestActionImpl,
  generateClaimsStructuredCheckpointActionImpl,
  generateClaimsStructuredPreviewActionImpl,
  generateLegalServicesAgreementPreviewActionImpl,
  generateOgpComplaintBbcodeActionImpl,
  publishOgpComplaintCreateActionImpl,
  publishOgpComplaintUpdateActionImpl,
  updateDocumentPublicationMetadataActionImpl,
} from "@/server/actions/documents-generation";
import {
  improveComplaintNarrativeActionImpl,
  rewriteDocumentFieldActionImpl,
  rewriteGroundedDocumentFieldActionImpl,
} from "@/server/actions/documents-rewrite";
import {
  DocumentAccessDeniedError,
  DocumentCharacterUnavailableError,
  DocumentRepresentativeAccessError,
  DocumentValidationError,
  refreshOwnedOgpComplaintAuthorSnapshot,
  saveOwnedDocumentDraft,
} from "@/server/document-area/persistence";

export async function createOgpComplaintDraftAction(formData: FormData) {
  return createOgpComplaintDraftActionImpl(formData);
}

export async function createClaimDraftAction(formData: FormData) {
  return createClaimDraftActionImpl(formData);
}

export async function createAttorneyRequestDraftAction(formData: FormData) {
  return createAttorneyRequestDraftActionImpl(formData);
}

export async function createLegalServicesAgreementDraftAction(formData: FormData) {
  return createLegalServicesAgreementDraftActionImpl(formData);
}

export async function saveDocumentDraftAction(input: {
  documentId: string;
  title: string;
  payload: unknown;
}) {
  const { account } = await requireProtectedAccountContext("/account/documents", undefined, {
    allowMustChangePassword: true,
  });

  try {
    const document = await saveOwnedDocumentDraft({
      accountId: account.id,
      documentId: input.documentId,
      title: input.title,
      payload: input.payload,
    });

    revalidateDocumentPaths({
      documentId: document.id,
      serverCode: document.server.code,
      documentType: document.documentType,
    });

    return {
      ok: true as const,
      updatedAt: document.updatedAt.toISOString(),
      status: document.status,
      isModifiedAfterGeneration: document.isModifiedAfterGeneration,
    };
  } catch (error) {
    if (error instanceof DocumentAccessDeniedError) {
      return {
        ok: false as const,
        error: "document-access-denied" as const,
      };
    }

    if (error instanceof DocumentRepresentativeAccessError) {
      return {
        ok: false as const,
        error: "representative-not-allowed" as const,
      };
    }

    if (error instanceof DocumentValidationError || error instanceof ZodError) {
      return {
        ok: false as const,
        error: "invalid-payload" as const,
      };
    }

    throw error;
  }
}

export async function generateOgpComplaintBbcodeAction(input: {
  documentId: string;
}) {
  return generateOgpComplaintBbcodeActionImpl(input);
}

export async function refreshOgpComplaintAuthorSnapshotAction(input: {
  documentId: string;
}) {
  const { account } = await requireProtectedAccountContext("/account/documents", undefined, {
    allowMustChangePassword: true,
  });

  try {
    const { document, authorSnapshot } = await refreshOwnedOgpComplaintAuthorSnapshot({
      accountId: account.id,
      documentId: input.documentId,
    });

    revalidateDocumentPaths({
      documentId: document.id,
      serverCode: document.server.code,
      documentType: "ogp_complaint",
    });

    return {
      ok: true as const,
      updatedAt: document.updatedAt.toISOString(),
      snapshotCapturedAt: document.snapshotCapturedAt.toISOString(),
      status: document.status,
      isModifiedAfterGeneration: document.isModifiedAfterGeneration,
      authorSnapshot: {
        fullName: authorSnapshot.fullName,
        passportNumber: authorSnapshot.passportNumber,
        position: authorSnapshot.position,
        phone: authorSnapshot.phone,
        icEmail: authorSnapshot.icEmail,
        passportImageUrl: authorSnapshot.passportImageUrl,
        isProfileComplete: authorSnapshot.isProfileComplete,
        canUseRepresentative: authorSnapshot.accessFlags.includes("advocate"),
      },
    };
  } catch (error) {
    if (error instanceof DocumentAccessDeniedError) {
      return {
        ok: false as const,
        error: "document-access-denied" as const,
      };
    }

    if (error instanceof DocumentCharacterUnavailableError) {
      return {
        ok: false as const,
        error: "character-unavailable" as const,
      };
    }

    if (error instanceof DocumentValidationError || error instanceof ZodError) {
      return {
        ok: false as const,
        error: "invalid-profile" as const,
      };
    }

    throw error;
  }
}

export async function generateClaimsStructuredPreviewAction(input: {
  documentId: string;
}) {
  return generateClaimsStructuredPreviewActionImpl(input);
}

export async function generateClaimsStructuredCheckpointAction(input: {
  documentId: string;
}) {
  return generateClaimsStructuredCheckpointActionImpl(input);
}

export async function generateAttorneyRequestAction(input: {
  documentId: string;
}) {
  return generateAttorneyRequestActionImpl(input);
}

export async function generateLegalServicesAgreementPreviewAction(input: {
  documentId: string;
}) {
  return generateLegalServicesAgreementPreviewActionImpl(input);
}

export async function updateDocumentPublicationMetadataAction(input: {
  documentId: string;
  publicationUrl: string;
  isSiteForumSynced: boolean;
}) {
  return updateDocumentPublicationMetadataActionImpl(input);
}

export async function publishOgpComplaintCreateAction(input: {
  documentId: string;
}) {
  return publishOgpComplaintCreateActionImpl(input);
}

export async function publishOgpComplaintUpdateAction(input: {
  documentId: string;
}) {
  return publishOgpComplaintUpdateActionImpl(input);
}

export async function rewriteDocumentFieldAction(input: {
  documentId: string;
  sectionKey: string;
}) {
  return rewriteDocumentFieldActionImpl(input);
}

export async function rewriteGroundedDocumentFieldAction(input: {
  documentId: string;
  sectionKey: string;
}) {
  return rewriteGroundedDocumentFieldActionImpl(input);
}

export async function improveComplaintNarrativeAction(input: {
  documentId: string;
  lengthMode?: string;
}) {
  return improveComplaintNarrativeActionImpl(input);
}
