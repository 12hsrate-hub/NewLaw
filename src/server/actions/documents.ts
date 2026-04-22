"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { ZodError } from "zod";

import { requireProtectedAccountContext } from "@/server/auth/protected";
import {
  createInitialClaimDraft,
  createInitialOgpComplaintDraft,
  DocumentAccessDeniedError,
  DocumentCharacterUnavailableError,
  DocumentRepresentativeAccessError,
  DocumentServerUnavailableError,
  DocumentValidationError,
  saveOwnedDocumentDraft,
} from "@/server/document-area/persistence";
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
  mapGenerationBlockingReasonsToMessages,
  updateOwnedDocumentPublicationMetadata,
} from "@/server/document-area/generation";
import {
  mapPublicationBlockingReasonsToMessages,
  OgpPublicationBlockedError,
  publishOwnedOgpComplaintCreate,
  publishOwnedOgpComplaintUpdate,
} from "@/server/document-area/publication";
import {
  DocumentFieldRewriteBlockedError,
  DocumentFieldRewriteUnavailableError,
  mapDocumentFieldRewriteBlockingReasonsToMessages,
  rewriteOwnedDocumentField,
} from "@/server/document-ai/rewrite";
import { rewriteDocumentFieldActionInputSchema } from "@/schemas/document-ai";

function buildStatusRedirect(path: string, status: string) {
  const [pathname, queryString] = path.split("?");
  const params = new URLSearchParams(queryString ?? "");

  params.set("status", status);

  const nextQuery = params.toString();

  return nextQuery ? `${pathname}?${nextQuery}` : pathname;
}

function parsePayloadJson(payloadJson: FormDataEntryValue | null) {
  const payloadText = String(payloadJson ?? "").trim();

  if (payloadText.length === 0) {
    return {};
  }

  return JSON.parse(payloadText) as unknown;
}

function revalidateDocumentPaths(input: {
  documentId: string;
  serverCode: string;
  documentType: "ogp_complaint" | "rehabilitation" | "lawsuit";
}) {
  revalidatePath("/account/documents");
  revalidatePath(`/servers/${input.serverCode}/documents`);

  if (input.documentType === "ogp_complaint") {
    revalidatePath(`/servers/${input.serverCode}/documents/ogp-complaints`);
    revalidatePath(`/servers/${input.serverCode}/documents/ogp-complaints/${input.documentId}`);

    return;
  }

  revalidatePath(`/servers/${input.serverCode}/documents/claims`);
  revalidatePath(`/servers/${input.serverCode}/documents/claims/${input.documentId}`);
}

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

    if (error instanceof DocumentRepresentativeAccessError) {
      redirect(buildStatusRedirect(nextPath, "representative-not-allowed"));
    }

    if (error instanceof DocumentValidationError || error instanceof SyntaxError || error instanceof ZodError) {
      redirect(buildStatusRedirect(nextPath, "invalid-payload"));
    }

    redirect(buildStatusRedirect(nextPath, "document-create-error"));
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

    redirect(
      buildStatusRedirect(
        `/servers/${document.server.code}/documents/claims/${document.id}`,
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

    if (error instanceof DocumentRepresentativeAccessError) {
      redirect(buildStatusRedirect(nextPath, "representative-not-allowed"));
    }

    if (error instanceof DocumentValidationError || error instanceof SyntaxError || error instanceof ZodError) {
      redirect(buildStatusRedirect(nextPath, "invalid-payload"));
    }

    redirect(buildStatusRedirect(nextPath, "document-create-error"));
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

    revalidatePath("/account/documents");
    revalidatePath(`/servers/${document.server.code}/documents`);
    revalidatePath(`/servers/${document.server.code}/documents/ogp-complaints`);
    revalidatePath(`/servers/${document.server.code}/documents/ogp-complaints/${document.id}`);

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
        reasons: mapGenerationBlockingReasonsToMessages(error.reasons),
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

    revalidatePath("/account/documents");
    revalidatePath(`/servers/${document.server.code}/documents`);
    revalidatePath(`/servers/${document.server.code}/documents/ogp-complaints`);
    revalidatePath(`/servers/${document.server.code}/documents/ogp-complaints/${document.id}`);

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

    revalidatePath("/account/documents");
    revalidatePath(`/servers/${document.server.code}/documents`);
    revalidatePath(`/servers/${document.server.code}/documents/ogp-complaints`);
    revalidatePath(`/servers/${document.server.code}/documents/ogp-complaints/${document.id}`);

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
          : "Создать forum publication для OGP complaint не удалось.",
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

    revalidatePath("/account/documents");
    revalidatePath(`/servers/${document.server.code}/documents`);
    revalidatePath(`/servers/${document.server.code}/documents/ogp-complaints`);
    revalidatePath(`/servers/${document.server.code}/documents/ogp-complaints/${document.id}`);

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
          : "Обновить forum publication для OGP complaint не удалось.",
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
