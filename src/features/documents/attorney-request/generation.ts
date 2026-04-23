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
  buildCharacterSignatureSnapshotFromActiveSignature,
  loadCharacterSignatureDataUrl,
} from "@/server/character-signatures/service";
import {
  DocumentAccessDeniedError,
  readAttorneyRequestDraftPayload,
  readDocumentAuthorSnapshot,
  readDocumentSignatureSnapshot,
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
  const frozenSignatureSnapshot = readDocumentSignatureSnapshot(document.signatureSnapshotJson);
  const signatureSnapshot =
    frozenSignatureSnapshot ??
    buildCharacterSignatureSnapshotFromActiveSignature({
      activeSignature: document.character.activeSignature,
    });
  const payload = readAttorneyRequestDraftPayload(document.formPayloadJson);

  if (!signatureSnapshot) {
    throw new AttorneyRequestGenerationBlockedError([
      "Для генерации адвокатского запроса необходимо загрузить подпись персонажа.",
    ]);
  }

  const signatureDataUrl = await loadCharacterSignatureDataUrl(signatureSnapshot);

  if (!signatureDataUrl) {
    throw new AttorneyRequestGenerationBlockedError([
      "Файл подписи персонажа недоступен в хранилище. Загрузите подпись заново в профиле персонажа.",
    ]);
  }

  const artifact = attorneyRequestRenderedArtifactSchema.parse(
    await renderAttorneyRequestArtifact({
      title: document.title,
      authorSnapshot,
      payload,
      signatureDataUrl,
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
    signatureSnapshotJson: frozenSignatureSnapshot ? undefined : signatureSnapshot,
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
