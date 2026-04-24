import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  RedirectType: {
    push: "push",
    replace: "replace",
  },
}));

vi.mock("next/dist/client/components/redirect-error", () => ({
  isRedirectError: () => false,
}));

vi.mock("@/server/auth/protected", () => ({
  requireProtectedAccountContext: vi.fn(),
}));

vi.mock("@/server/document-area/persistence", () => ({
  createInitialClaimDraft: vi.fn(),
  createInitialAttorneyRequestDraft: vi.fn(),
  createInitialLegalServicesAgreementDraft: vi.fn(),
  createInitialOgpComplaintDraft: vi.fn(),
  refreshOwnedOgpComplaintAuthorSnapshot: vi.fn(),
  saveOwnedDocumentDraft: vi.fn(),
  DocumentAccessDeniedError: class DocumentAccessDeniedError extends Error {},
  DocumentAttorneyRoleRequiredError: class DocumentAttorneyRoleRequiredError extends Error {},
  DocumentCharacterUnavailableError: class DocumentCharacterUnavailableError extends Error {},
  DocumentRepresentativeAccessError: class DocumentRepresentativeAccessError extends Error {},
  DocumentServerUnavailableError: class DocumentServerUnavailableError extends Error {},
  DocumentValidationError: class DocumentValidationError extends Error {},
}));

vi.mock("@/features/documents/attorney-request/generation", () => ({
  AttorneyRequestGenerationBlockedError: class AttorneyRequestGenerationBlockedError extends Error {
    reasons: string[] = [];
  },
  generateOwnedAttorneyRequestArtifacts: vi.fn(),
}));

vi.mock("@/features/documents/legal-services-agreement/generation", () => ({
  LegalServicesAgreementGenerationBlockedError:
    class LegalServicesAgreementGenerationBlockedError extends Error {
      reasons: string[] = [];
    },
  generateOwnedLegalServicesAgreementPreview: vi.fn(),
}));

vi.mock("@/server/document-area/claims-rendering", () => ({
  ClaimsOutputBlockedError: class ClaimsOutputBlockedError extends Error {
    reasons: string[] = [];
  },
  mapClaimsOutputBlockingReasonsToMessages: vi.fn(),
  renderOwnedClaimsStructuredPreview: vi.fn(),
}));

vi.mock("@/server/document-area/claims-generation", () => ({
  generateOwnedClaimsStructuredCheckpoint: vi.fn(),
}));

vi.mock("@/server/document-area/generation", () => ({
  DocumentGenerationBlockedError: class DocumentGenerationBlockedError extends Error {
    validation = null;
  },
  DocumentPublicationMetadataStateError: class DocumentPublicationMetadataStateError extends Error {},
  generateOwnedOgpComplaintBbcode: vi.fn(),
  updateOwnedDocumentPublicationMetadata: vi.fn(),
}));

vi.mock("@/server/document-area/publication", () => ({
  mapPublicationBlockingReasonsToMessages: vi.fn(),
  OgpPublicationBlockedError: class OgpPublicationBlockedError extends Error {
    reasons: string[] = [];
  },
  publishOwnedOgpComplaintCreate: vi.fn(),
  publishOwnedOgpComplaintUpdate: vi.fn(),
}));

vi.mock("@/server/document-ai/grounded-rewrite", () => ({
  GroundedDocumentFieldRewriteBlockedError: class GroundedDocumentFieldRewriteBlockedError extends Error {
    reasons: string[] = [];
  },
  GroundedDocumentFieldRewriteInsufficientCorpusError:
    class GroundedDocumentFieldRewriteInsufficientCorpusError extends Error {},
  GroundedDocumentFieldRewriteUnavailableError:
    class GroundedDocumentFieldRewriteUnavailableError extends Error {},
  mapGroundedDocumentFieldRewriteBlockingReasonsToMessages: vi.fn(),
  rewriteOwnedGroundedDocumentField: vi.fn(),
}));

vi.mock("@/server/document-ai/rewrite", () => ({
  DocumentFieldRewriteBlockedError: class DocumentFieldRewriteBlockedError extends Error {
    reasons: string[] = [];
  },
  DocumentFieldRewriteUnavailableError: class DocumentFieldRewriteUnavailableError extends Error {},
  mapDocumentFieldRewriteBlockingReasonsToMessages: vi.fn(),
  rewriteOwnedDocumentField: vi.fn(),
}));

import { redirect, RedirectType } from "next/navigation";

import { requireProtectedAccountContext } from "@/server/auth/protected";
import {
  createAttorneyRequestDraftAction,
  createClaimDraftAction,
  createLegalServicesAgreementDraftAction,
  createOgpComplaintDraftAction,
} from "@/server/actions/documents";
import {
  createInitialAttorneyRequestDraft,
  createInitialClaimDraft,
  createInitialLegalServicesAgreementDraft,
  createInitialOgpComplaintDraft,
} from "@/server/document-area/persistence";

function buildBaseFormData() {
  const formData = new FormData();
  formData.set("serverSlug", "blackberry");
  formData.set("characterId", "character-1");
  formData.set("title", "Черновик");
  formData.set("payloadJson", "{}");

  return formData;
}

describe("document create navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireProtectedAccountContext).mockResolvedValue({
      account: { id: "account-1" },
    } as never);
  });

  it("использует replace redirect после создания жалобы в ОГП", async () => {
    vi.mocked(createInitialOgpComplaintDraft).mockResolvedValue({
      id: "document-1",
      server: { code: "blackberry" },
    } as never);

    await createOgpComplaintDraftAction(buildBaseFormData());

    expect(redirect).toHaveBeenCalledWith(
      "/servers/blackberry/documents/ogp-complaints/document-1?status=draft-created",
      RedirectType.replace,
    );
  });

  it("использует replace redirect после создания иска", async () => {
    vi.mocked(createInitialClaimDraft).mockResolvedValue({
      id: "document-2",
      documentType: "lawsuit",
      server: { code: "blackberry" },
    } as never);

    const formData = buildBaseFormData();
    formData.set("documentType", "lawsuit");

    await createClaimDraftAction(formData);

    expect(redirect).toHaveBeenCalledWith(
      "/servers/blackberry/documents/claims/document-2?status=draft-created",
      RedirectType.replace,
    );
  });

  it("использует replace redirect после создания адвокатского запроса", async () => {
    vi.mocked(createInitialAttorneyRequestDraft).mockResolvedValue({
      id: "document-3",
      server: { code: "blackberry" },
    } as never);

    const formData = buildBaseFormData();
    formData.set("trustorId", "trustor-1");

    await createAttorneyRequestDraftAction(formData);

    expect(redirect).toHaveBeenCalledWith(
      "/servers/blackberry/documents/attorney-requests/document-3?status=draft-created",
      RedirectType.replace,
    );
  });

  it("использует replace redirect после создания договора", async () => {
    vi.mocked(createInitialLegalServicesAgreementDraft).mockResolvedValue({
      id: "document-4",
      server: { code: "blackberry" },
    } as never);

    const formData = buildBaseFormData();
    formData.set("trustorId", "trustor-2");

    await createLegalServicesAgreementDraftAction(formData);

    expect(redirect).toHaveBeenCalledWith(
      "/servers/blackberry/documents/legal-services-agreements/document-4?status=draft-created",
      RedirectType.replace,
    );
  });
});
