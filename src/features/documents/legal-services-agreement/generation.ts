import {
  getDocumentByIdForAccount,
  markLegalServicesAgreementGeneratedRecord,
} from "@/db/repositories/document.repository";
import { legalServicesAgreementRenderedArtifactSchema } from "@/features/documents/legal-services-agreement/schemas";
import {
  LegalServicesAgreementGenerationBlockedError,
  renderLegalServicesAgreementArtifact,
} from "@/features/documents/legal-services-agreement/render";
import { LEGAL_SERVICES_AGREEMENT_FORM_SCHEMA_VERSION } from "@/features/documents/legal-services-agreement/types";
import {
  DocumentAccessDeniedError,
  readDocumentAuthorSnapshot,
  readLegalServicesAgreementDraftPayload,
} from "@/server/document-area/persistence";

type LegalServicesAgreementGenerationDependencies = {
  getDocumentByIdForAccount: typeof getDocumentByIdForAccount;
  markLegalServicesAgreementGeneratedRecord: typeof markLegalServicesAgreementGeneratedRecord;
  now: () => Date;
};

const defaultDependencies: LegalServicesAgreementGenerationDependencies = {
  getDocumentByIdForAccount,
  markLegalServicesAgreementGeneratedRecord,
  now: () => new Date(),
};

export async function generateOwnedLegalServicesAgreementPreview(
  input: {
    accountId: string;
    documentId: string;
  },
  dependencies: LegalServicesAgreementGenerationDependencies = defaultDependencies,
) {
  const document = await dependencies.getDocumentByIdForAccount({
    accountId: input.accountId,
    documentId: input.documentId,
  });

  if (!document || document.documentType !== "legal_services_agreement") {
    throw new DocumentAccessDeniedError();
  }

  const authorSnapshot = readDocumentAuthorSnapshot(document.authorSnapshotJson);
  const payload = readLegalServicesAgreementDraftPayload(document.formPayloadJson);
  const artifact = legalServicesAgreementRenderedArtifactSchema.parse(
    await renderLegalServicesAgreementArtifact({
      title: document.title,
      authorSnapshot,
      payload,
    }),
  );

  if (artifact.referenceState === "missing") {
    throw new LegalServicesAgreementGenerationBlockedError(artifact.blockingReasons);
  }

  const generatedDocument = await dependencies.markLegalServicesAgreementGeneratedRecord({
    documentId: document.id,
    generatedArtifactJson: artifact,
    generatedArtifactText: artifact.previewText,
    generatedAt: dependencies.now(),
    generatedFormSchemaVersion:
      document.formSchemaVersion || LEGAL_SERVICES_AGREEMENT_FORM_SCHEMA_VERSION,
    generatedOutputFormat: artifact.format,
    generatedRendererVersion: artifact.rendererVersion,
  });

  if (!generatedDocument) {
    throw new DocumentAccessDeniedError();
  }

  return {
    document: generatedDocument,
    artifact,
  };
}

export { LegalServicesAgreementGenerationBlockedError };
