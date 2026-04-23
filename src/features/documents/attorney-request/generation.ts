import {
  getDocumentByIdForAccount,
  markAttorneyRequestGeneratedRecord,
} from "@/db/repositories/document.repository";
import {
  attorneyRequestRenderedArtifactSchema,
} from "@/features/documents/attorney-request/schemas";
import {
  AttorneyRequestGenerationBlockedError,
  renderAttorneyRequestArtifact,
} from "@/features/documents/attorney-request/render";
import {
  ATTORNEY_REQUEST_FORM_SCHEMA_VERSION,
} from "@/features/documents/attorney-request/types";
import {
  DocumentAccessDeniedError,
  readAttorneyRequestDraftPayload,
  readDocumentAuthorSnapshot,
} from "@/server/document-area/persistence";

type AttorneyRequestGenerationDependencies = {
  getDocumentByIdForAccount: typeof getDocumentByIdForAccount;
  markAttorneyRequestGeneratedRecord: typeof markAttorneyRequestGeneratedRecord;
  now: () => Date;
};

const defaultDependencies: AttorneyRequestGenerationDependencies = {
  getDocumentByIdForAccount,
  markAttorneyRequestGeneratedRecord,
  now: () => new Date(),
};

export async function generateOwnedAttorneyRequestArtifacts(
  input: {
    accountId: string;
    documentId: string;
  },
  dependencies: AttorneyRequestGenerationDependencies = defaultDependencies,
) {
  const document = await dependencies.getDocumentByIdForAccount({
    accountId: input.accountId,
    documentId: input.documentId,
  });

  if (!document || document.documentType !== "attorney_request") {
    throw new DocumentAccessDeniedError();
  }

  const authorSnapshot = readDocumentAuthorSnapshot(document.authorSnapshotJson);
  const payload = readAttorneyRequestDraftPayload(document.formPayloadJson);
  const artifact = attorneyRequestRenderedArtifactSchema.parse(
    await renderAttorneyRequestArtifact({
      title: document.title,
      authorSnapshot,
      payload,
    }),
  );
  const generatedDocument = await dependencies.markAttorneyRequestGeneratedRecord({
    documentId: document.id,
    generatedArtifactJson: artifact,
    generatedArtifactText: artifact.previewText,
    generatedAt: dependencies.now(),
    generatedFormSchemaVersion: document.formSchemaVersion || ATTORNEY_REQUEST_FORM_SCHEMA_VERSION,
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

export { AttorneyRequestGenerationBlockedError };
