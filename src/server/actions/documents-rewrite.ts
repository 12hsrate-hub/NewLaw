"use server";

import { ZodError } from "zod";

import { requireProtectedAccountContext } from "@/server/auth/protected";
import { DocumentAccessDeniedError } from "@/server/document-area/persistence";
import {
  GroundedDocumentFieldRewriteBlockedError,
  GroundedDocumentFieldRewriteInsufficientCorpusError,
  GroundedDocumentFieldRewriteUnavailableError,
  mapGroundedDocumentFieldRewriteBlockingReasonsToMessages,
  rewriteOwnedGroundedDocumentField,
} from "@/server/document-ai/grounded-rewrite";
import {
  ComplaintNarrativeImprovementBlockedError,
  ComplaintNarrativeImprovementInvalidOutputError,
  ComplaintNarrativeImprovementUnavailableError,
  improveOwnedComplaintNarrative,
  mapComplaintNarrativeImprovementBlockingReasonsToMessages,
} from "@/server/document-ai/complaint-narrative-improvement";
import {
  DocumentFieldRewriteBlockedError,
  DocumentFieldRewriteUnavailableError,
  mapDocumentFieldRewriteBlockingReasonsToMessages,
  rewriteOwnedDocumentField,
} from "@/server/document-ai/rewrite";
import {
  complaintNarrativeImprovementActionInputSchema,
  rewriteDocumentFieldActionInputSchema,
  rewriteGroundedDocumentFieldActionInputSchema,
} from "@/schemas/document-ai";

export async function rewriteDocumentFieldActionImpl(input: {
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

export async function rewriteGroundedDocumentFieldActionImpl(input: {
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

export async function improveComplaintNarrativeActionImpl(input: {
  documentId: string;
  lengthMode?: string;
}) {
  const { account } = await requireProtectedAccountContext("/account/documents", undefined, {
    allowMustChangePassword: true,
  });

  try {
    const parsed = complaintNarrativeImprovementActionInputSchema.parse(input);
    const result = await improveOwnedComplaintNarrative({
      accountId: account.id,
      documentId: parsed.documentId,
      lengthMode: parsed.lengthMode,
    });

    return {
      ok: true as const,
      sourceText: result.sourceText,
      improvedText: result.result.improved_text,
      legalBasisUsed: result.result.legal_basis_used,
      usedFacts: result.result.used_facts,
      missingFacts: result.result.missing_facts,
      reviewNotes: result.result.review_notes,
      riskFlags: result.result.risk_flags,
      shouldSendToReview: result.result.should_send_to_review,
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

    if (error instanceof ComplaintNarrativeImprovementBlockedError) {
      return {
        ok: false as const,
        error: "rewrite-blocked" as const,
        reasons: mapComplaintNarrativeImprovementBlockingReasonsToMessages(error.reasons),
      };
    }

    if (error instanceof ComplaintNarrativeImprovementUnavailableError) {
      return {
        ok: false as const,
        error: "rewrite-unavailable" as const,
        message: error.message,
      };
    }

    if (error instanceof ComplaintNarrativeImprovementInvalidOutputError) {
      return {
        ok: false as const,
        error: "invalid-output" as const,
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
