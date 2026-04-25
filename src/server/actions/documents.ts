"use server";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import { ZodError } from "zod";

import { buildDocumentEditorHref } from "@/lib/documents/family-registry";
import { requireProtectedAccountContext } from "@/server/auth/protected";
import {
  parsePayloadJson,
  replaceRedirectWithStatus,
  revalidateDocumentPaths,
  revalidateOgpDocumentPaths,
} from "@/server/actions/documents-shared";
import {
  createInitialClaimDraft,
  createInitialAttorneyRequestDraft,
  createInitialLegalServicesAgreementDraft,
  createInitialOgpComplaintDraft,
  DocumentAccessDeniedError,
  DocumentAttorneyRoleRequiredError,
  DocumentCharacterUnavailableError,
  DocumentRepresentativeAccessError,
  DocumentServerUnavailableError,
  DocumentValidationError,
  refreshOwnedOgpComplaintAuthorSnapshot,
  saveOwnedDocumentDraft,
} from "@/server/document-area/persistence";
import {
  AttorneyRequestGenerationBlockedError,
  generateOwnedAttorneyRequestArtifacts,
} from "@/features/documents/attorney-request/generation";
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
import {
  mapPublicationBlockingReasonsToMessages,
  OgpPublicationBlockedError,
  publishOwnedOgpComplaintCreate,
  publishOwnedOgpComplaintUpdate,
} from "@/server/document-area/publication";
import {
  GroundedDocumentFieldRewriteBlockedError,
  GroundedDocumentFieldRewriteInsufficientCorpusError,
  GroundedDocumentFieldRewriteUnavailableError,
  mapGroundedDocumentFieldRewriteBlockingReasonsToMessages,
  rewriteOwnedGroundedDocumentField,
} from "@/server/document-ai/grounded-rewrite";
import {
  DocumentFieldRewriteBlockedError,
  DocumentFieldRewriteUnavailableError,
  mapDocumentFieldRewriteBlockingReasonsToMessages,
  rewriteOwnedDocumentField,
} from "@/server/document-ai/rewrite";
import {
  rewriteDocumentFieldActionInputSchema,
  rewriteGroundedDocumentFieldActionInputSchema,
} from "@/schemas/document-ai";

export async function createOgpComplaintDraftAction(formData: FormData) {
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

export async function createClaimDraftAction(formData: FormData) {
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

export async function createAttorneyRequestDraftAction(formData: FormData) {
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

export async function createLegalServicesAgreementDraftAction(formData: FormData) {
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

export async function generateClaimsStructuredCheckpointAction(input: {
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

export async function generateAttorneyRequestAction(input: {
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

export async function generateLegalServicesAgreementPreviewAction(input: {
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

export async function updateDocumentPublicationMetadataAction(input: {
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

export async function publishOgpComplaintCreateAction(input: {
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

export async function publishOgpComplaintUpdateAction(input: {
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

export async function rewriteDocumentFieldAction(input: {
  documentId: string;
  sectionKey: string;
}) {
  const { account } = await requireProtectedAccountContext("/account/documents", undefined, {
    allowMustChangePassword: true,
  });

  try {
    const parsed = rewriteDocumentFieldActionInputSchema.parse(input);
    const result = await rewriteOwnedDocumentField({
      accountId: account.id,
      documentId: parsed.documentId,
      sectionKey: parsed.sectionKey,
    });

    return {
      ok: true as const,
      sourceText: result.sourceText,
      suggestionText: result.suggestionText,
      basedOnUpdatedAt: result.basedOnUpdatedAt,
      usageMeta: result.usageMeta,
    };
  } catch (error) {
    if (error instanceof DocumentAccessDeniedError) {
      return {
        ok: false as const,
        error: "document-access-denied" as const,
      };
    }

    if (error instanceof DocumentFieldRewriteBlockedError) {
      return {
        ok: false as const,
        error: "rewrite-blocked" as const,
        reasons: mapDocumentFieldRewriteBlockingReasonsToMessages(error.reasons),
      };
    }

    if (error instanceof DocumentFieldRewriteUnavailableError) {
      return {
        ok: false as const,
        error: "rewrite-unavailable" as const,
        message: error.message,
      };
    }

    if (error instanceof ZodError) {
      return {
        ok: false as const,
        error: "invalid-input" as const,
      };
    }

    throw error;
  }
}

export async function rewriteGroundedDocumentFieldAction(input: {
  documentId: string;
  sectionKey: string;
}) {
  const { account } = await requireProtectedAccountContext("/account/documents", undefined, {
    allowMustChangePassword: true,
  });

  try {
    const parsed = rewriteGroundedDocumentFieldActionInputSchema.parse(input);
    const result = await rewriteOwnedGroundedDocumentField({
      accountId: account.id,
      documentId: parsed.documentId,
      sectionKey: parsed.sectionKey,
    });

    return {
      ok: true as const,
      sourceText: result.sourceText,
      suggestionText: result.suggestionText,
      basedOnUpdatedAt: result.basedOnUpdatedAt,
      groundingMode: result.groundingMode,
      references: result.references,
      usageMeta: result.usageMeta,
    };
  } catch (error) {
    if (error instanceof DocumentAccessDeniedError) {
      return {
        ok: false as const,
        error: "document-access-denied" as const,
      };
    }

    if (error instanceof GroundedDocumentFieldRewriteBlockedError) {
      return {
        ok: false as const,
        error: "rewrite-blocked" as const,
        reasons: mapGroundedDocumentFieldRewriteBlockingReasonsToMessages(error.reasons),
      };
    }

    if (error instanceof GroundedDocumentFieldRewriteInsufficientCorpusError) {
      return {
        ok: false as const,
        error: "insufficient-corpus" as const,
        message: error.message,
      };
    }

    if (error instanceof GroundedDocumentFieldRewriteUnavailableError) {
      return {
        ok: false as const,
        error: "rewrite-unavailable" as const,
        message: error.message,
      };
    }

    if (error instanceof ZodError) {
      return {
        ok: false as const,
        error: "invalid-input" as const,
      };
    }

    throw error;
  }
}
