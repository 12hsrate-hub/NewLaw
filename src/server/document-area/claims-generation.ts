import {
  getDocumentByIdForAccount,
  markClaimsDocumentGeneratedRecord,
} from "@/db/repositories/document.repository";
import {
  ClaimsOutputBlockedError,
  renderClaimsStructuredPreviewFromDocument,
} from "@/server/document-area/claims-rendering";
import {
  DocumentAccessDeniedError,
  isClaimsDocumentType,
} from "@/server/document-area/persistence";

type ClaimsGenerationDependencies = {
  getDocumentByIdForAccount: typeof getDocumentByIdForAccount;
  markClaimsDocumentGeneratedRecord: typeof markClaimsDocumentGeneratedRecord;
  now: () => Date;
};

const defaultDependencies: ClaimsGenerationDependencies = {
  getDocumentByIdForAccount,
  markClaimsDocumentGeneratedRecord,
  now: () => new Date(),
};

export async function generateOwnedClaimsStructuredCheckpoint(
  input: {
    accountId: string;
    documentId: string;
  },
  dependencies: ClaimsGenerationDependencies = defaultDependencies,
) {
  const document = await dependencies.getDocumentByIdForAccount({
    accountId: input.accountId,
    documentId: input.documentId,
  });

  if (!document || !isClaimsDocumentType(document.documentType)) {
    throw new DocumentAccessDeniedError();
  }

  const output = renderClaimsStructuredPreviewFromDocument({
    document: {
      title: document.title,
      documentType: document.documentType,
      server: {
        code: document.server.code,
        name: document.server.name,
      },
      authorSnapshotJson: document.authorSnapshotJson,
      formPayloadJson: document.formPayloadJson,
    },
  });

  const generatedDocument = await dependencies.markClaimsDocumentGeneratedRecord({
    documentId: document.id,
    generatedArtifactJson: output,
    generatedArtifactText: output.copyText,
    generatedAt: dependencies.now(),
    generatedFormSchemaVersion: document.formSchemaVersion,
    generatedOutputFormat: output.format,
    generatedRendererVersion: output.rendererVersion,
  });

  if (!generatedDocument) {
    throw new DocumentAccessDeniedError();
  }

  return {
    document: generatedDocument,
    output,
  };
}

export { ClaimsOutputBlockedError };
