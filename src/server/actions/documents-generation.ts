"use server";

import { ZodError } from "zod";

import { requireProtectedAccountContext } from "@/server/auth/protected";
import {
  revalidateDocumentPaths,
  revalidateOgpDocumentPaths,
} from "@/server/actions/documents-shared";
import { AttorneyRequestGenerationBlockedError, generateOwnedAttorneyRequestArtifacts } from "@/features/documents/attorney-request/generation";
import {
  LegalServicesAgreementGenerationBlockedError,
  generateOwnedLegalServicesAgreementPreview,
} from "@/features/documents/legal-services-agreement/generation";
import {
  ClaimsOutputBlockedError,
  mapClaimsOutputBlockingReasonsToMessages,
  renderOwnedClaimsStructuredPreview,
} from "@/server/document-area/claims-rendering";
import { generateOwnedClaimsStructuredCheckpoint } from "@/server/document-area/claims-generation";
import {
  DocumentGenerationBlockedError,
  DocumentPublicationMetadataStateError,
  generateOwnedOgpComplaintBbcode,
  updateOwnedDocumentPublicationMetadata,
} from "@/server/document-area/generation";
import { DocumentAccessDeniedError, DocumentValidationError } from "@/server/document-area/persistence";
import {
  mapPublicationBlockingReasonsToMessages,
  OgpPublicationBlockedError,
  publishOwnedOgpComplaintCreate,
  publishOwnedOgpComplaintUpdate,
} from "@/server/document-area/publication";

export async function generateOgpComplaintBbcodeActionImpl(input: {
  documentId: string;
}) {
  const { account } = await requireProtectedAccountContext("/account/documents", undefined, {
    allowMustChangePassword: true,
  });

  try {
    const document = await generateOwnedOgpComplaintBbcode({
      accountId: account.id,
      documentId: input.documentId,
    });

    revalidateOgpDocumentPaths({
      documentId: document.id,
      serverCode: document.server.code,
    });

    return {
      ok: true as const,
      status: document.status,
      updatedAt: document.updatedAt.toISOString(),
      generatedAt: document.generatedAt?.toISOString() ?? null,
      lastGeneratedBbcode: document.lastGeneratedBbcode,
      generatedLawVersion: document.generatedLawVersion,
      generatedTemplateVersion: document.generatedTemplateVersion,
      generatedFormSchemaVersion: document.generatedFormSchemaVersion,
      publicationUrl: document.publicationUrl,
      isSiteForumSynced: document.isSiteForumSynced,
      isModifiedAfterGeneration: document.isModifiedAfterGeneration,
    };
  } catch (error) {
    if (error instanceof DocumentAccessDeniedError) {
      return {
        ok: false as const,
        error: "document-access-denied" as const,
      };
    }

    if (error instanceof DocumentGenerationBlockedError) {
      return {
        ok: false as const,
        error: "generation-blocked" as const,
        validation: error.validation,
      };
    }

    throw error;
  }
}

export async function generateClaimsStructuredPreviewActionImpl(input: {
  documentId: string;
}) {
  const { account } = await requireProtectedAccountContext("/account/documents", undefined, {
    allowMustChangePassword: true,
  });

  try {
    const output = await renderOwnedClaimsStructuredPreview({
      accountId: account.id,
      documentId: input.documentId,
    });

    return {
      ok: true as const,
      output,
    };
  } catch (error) {
    if (error instanceof DocumentAccessDeniedError) {
      return {
        ok: false as const,
        error: "document-access-denied" as const,
      };
    }

    if (error instanceof ClaimsOutputBlockedError) {
      return {
        ok: false as const,
        error: "preview-blocked" as const,
        reasons: mapClaimsOutputBlockingReasonsToMessages(error.reasons),
      };
    }

    throw error;
  }
}

export async function generateClaimsStructuredCheckpointActionImpl(input: {
  documentId: string;
}) {
  const { account } = await requireProtectedAccountContext("/account/documents", undefined, {
    allowMustChangePassword: true,
  });

  try {
    const { document, output } = await generateOwnedClaimsStructuredCheckpoint({
      accountId: account.id,
      documentId: input.documentId,
    });

    revalidateDocumentPaths({
      documentId: document.id,
      serverCode: document.server.code,
      documentType: document.documentType,
    });

    return {
      ok: true as const,
      status: document.status,
      updatedAt: document.updatedAt.toISOString(),
      generatedAt: document.generatedAt?.toISOString() ?? null,
      generatedFormSchemaVersion: document.generatedFormSchemaVersion,
      generatedOutputFormat: document.generatedOutputFormat,
      generatedRendererVersion: document.generatedRendererVersion,
      isModifiedAfterGeneration: document.isModifiedAfterGeneration,
      output,
    };
  } catch (error) {
    if (error instanceof DocumentAccessDeniedError) {
      return {
        ok: false as const,
        error: "document-access-denied" as const,
      };
    }

    if (error instanceof ClaimsOutputBlockedError) {
      return {
        ok: false as const,
        error: "generation-blocked" as const,
        reasons: mapClaimsOutputBlockingReasonsToMessages(error.reasons),
      };
    }

    throw error;
  }
}

export async function generateAttorneyRequestActionImpl(input: {
  documentId: string;
}) {
  const { account } = await requireProtectedAccountContext("/account/documents", undefined, {
    allowMustChangePassword: true,
  });

  try {
    const result = await generateOwnedAttorneyRequestArtifacts({
      accountId: account.id,
      documentId: input.documentId,
    });

    revalidateDocumentPaths({
      documentId: result.document.id,
      serverCode: result.document.server.code,
      documentType: "attorney_request",
    });

    return {
      ok: true as const,
      status: result.document.status,
      generatedAt: result.document.generatedAt?.toISOString() ?? null,
      generatedOutputFormat: result.document.generatedOutputFormat,
      generatedRendererVersion: result.document.generatedRendererVersion,
      generatedArtifact: result.artifact,
      isModifiedAfterGeneration: result.document.isModifiedAfterGeneration,
    };
  } catch (error) {
    if (error instanceof DocumentAccessDeniedError) {
      return {
        ok: false as const,
        error: "document-access-denied" as const,
      };
    }

    if (error instanceof AttorneyRequestGenerationBlockedError) {
      return {
        ok: false as const,
        error: "generation-blocked" as const,
        messages: error.reasons,
      };
    }

    return {
      ok: false as const,
      error: "generation-failed" as const,
    };
  }
}

export async function generateLegalServicesAgreementPreviewActionImpl(input: {
  documentId: string;
}) {
  const { account } = await requireProtectedAccountContext("/account/documents", undefined, {
    allowMustChangePassword: true,
  });

  try {
    const result = await generateOwnedLegalServicesAgreementPreview({
      accountId: account.id,
      documentId: input.documentId,
    });

    revalidateDocumentPaths({
      documentId: result.document.id,
      serverCode: result.document.server.code,
      documentType: "legal_services_agreement",
    });

    return {
      ok: true as const,
      status: result.document.status,
      generatedAt: result.document.generatedAt?.toISOString() ?? null,
      generatedOutputFormat: result.document.generatedOutputFormat,
      generatedRendererVersion: result.document.generatedRendererVersion,
      generatedArtifact: result.artifact,
      isModifiedAfterGeneration: result.document.isModifiedAfterGeneration,
    };
  } catch (error) {
    if (error instanceof DocumentAccessDeniedError) {
      return {
        ok: false as const,
        error: "document-access-denied" as const,
      };
    }

    if (error instanceof LegalServicesAgreementGenerationBlockedError) {
      return {
        ok: false as const,
        error: "generation-blocked" as const,
        messages: error.reasons,
      };
    }

    return {
      ok: false as const,
      error: "generation-failed" as const,
    };
  }
}

export async function updateDocumentPublicationMetadataActionImpl(input: {
  documentId: string;
  publicationUrl: string;
  isSiteForumSynced: boolean;
}) {
  const { account } = await requireProtectedAccountContext("/account/documents", undefined, {
    allowMustChangePassword: true,
  });

  try {
    const document = await updateOwnedDocumentPublicationMetadata({
      accountId: account.id,
      documentId: input.documentId,
      publicationUrl: input.publicationUrl,
      isSiteForumSynced: input.isSiteForumSynced,
    });

    revalidateOgpDocumentPaths({
      documentId: document.id,
      serverCode: document.server.code,
    });

    return {
      ok: true as const,
      status: document.status,
      updatedAt: document.updatedAt.toISOString(),
      publicationUrl: document.publicationUrl,
      isSiteForumSynced: document.isSiteForumSynced,
    };
  } catch (error) {
    if (error instanceof DocumentAccessDeniedError) {
      return {
        ok: false as const,
        error: "document-access-denied" as const,
      };
    }

    if (error instanceof DocumentPublicationMetadataStateError) {
      return {
        ok: false as const,
        error: "publication-before-generation" as const,
      };
    }

    if (error instanceof DocumentValidationError || error instanceof ZodError) {
      return {
        ok: false as const,
        error: "invalid-publication-url" as const,
      };
    }

    throw error;
  }
}

export async function publishOgpComplaintCreateActionImpl(input: {
  documentId: string;
}) {
  const { account } = await requireProtectedAccountContext("/account/documents", undefined, {
    allowMustChangePassword: true,
  });

  try {
    const document = await publishOwnedOgpComplaintCreate({
      accountId: account.id,
      documentId: input.documentId,
    });

    revalidateOgpDocumentPaths({
      documentId: document.id,
      serverCode: document.server.code,
    });

    return {
      ok: true as const,
      status: document.status,
      updatedAt: document.updatedAt.toISOString(),
      publicationUrl: document.publicationUrl,
      isSiteForumSynced: document.isSiteForumSynced,
      forumSyncState: document.forumSyncState,
      forumThreadId: document.forumThreadId,
      forumPostId: document.forumPostId,
      forumPublishedBbcodeHash: document.forumPublishedBbcodeHash,
      forumLastPublishedAt: document.forumLastPublishedAt?.toISOString() ?? null,
      forumLastSyncError: document.forumLastSyncError,
      generatedAt: document.generatedAt?.toISOString() ?? null,
      isModifiedAfterGeneration: document.isModifiedAfterGeneration,
    };
  } catch (error) {
    if (error instanceof DocumentAccessDeniedError) {
      return {
        ok: false as const,
        error: "document-access-denied" as const,
      };
    }

    if (error instanceof OgpPublicationBlockedError) {
      return {
        ok: false as const,
        error: "publication-blocked" as const,
        reasons: mapPublicationBlockingReasonsToMessages(error.reasons),
      };
    }

    return {
      ok: false as const,
      error: "publication-failed" as const,
      message:
        error instanceof Error
          ? error.message
          : "Не удалось опубликовать жалобу в ОГП на форуме. Код: OGP_FORUM_PUBLISH_CREATE_FAILED.",
    };
  }
}

export async function publishOgpComplaintUpdateActionImpl(input: {
  documentId: string;
}) {
  const { account } = await requireProtectedAccountContext("/account/documents", undefined, {
    allowMustChangePassword: true,
  });

  try {
    const document = await publishOwnedOgpComplaintUpdate({
      accountId: account.id,
      documentId: input.documentId,
    });

    revalidateOgpDocumentPaths({
      documentId: document.id,
      serverCode: document.server.code,
    });

    return {
      ok: true as const,
      status: document.status,
      updatedAt: document.updatedAt.toISOString(),
      publicationUrl: document.publicationUrl,
      isSiteForumSynced: document.isSiteForumSynced,
      forumSyncState: document.forumSyncState,
      forumThreadId: document.forumThreadId,
      forumPostId: document.forumPostId,
      forumPublishedBbcodeHash: document.forumPublishedBbcodeHash,
      forumLastPublishedAt: document.forumLastPublishedAt?.toISOString() ?? null,
      forumLastSyncError: document.forumLastSyncError,
      generatedAt: document.generatedAt?.toISOString() ?? null,
      isModifiedAfterGeneration: document.isModifiedAfterGeneration,
    };
  } catch (error) {
    if (error instanceof DocumentAccessDeniedError) {
      return {
        ok: false as const,
        error: "document-access-denied" as const,
      };
    }

    if (error instanceof OgpPublicationBlockedError) {
      return {
        ok: false as const,
        error: "publication-blocked" as const,
        reasons: mapPublicationBlockingReasonsToMessages(error.reasons),
      };
    }

    return {
      ok: false as const,
      error: "publication-failed" as const,
      message:
        error instanceof Error
          ? error.message
          : "Не удалось обновить публикацию жалобы в ОГП на форуме. Код: OGP_FORUM_PUBLISH_UPDATE_FAILED.",
    };
  }
}
