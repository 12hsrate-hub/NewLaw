import {
  getDocumentByIdForAccount,
  updateDocumentAuthorSnapshotRecord,
} from "@/db/repositories/document.repository";
import { getCharacterByIdForAccount } from "@/db/repositories/character.repository";
import {
  buildAuthorSnapshot,
} from "@/server/document-area/persistence-policy";
import {
  DocumentAccessDeniedError,
  DocumentCharacterUnavailableError,
} from "@/server/document-area/persistence-errors";

type RefreshDependencies = {
  getDocumentByIdForAccount: typeof getDocumentByIdForAccount;
  getCharacterByIdForAccount: typeof getCharacterByIdForAccount;
  updateDocumentAuthorSnapshotRecord?: typeof updateDocumentAuthorSnapshotRecord;
  now: () => Date;
};

const defaultDependencies: RefreshDependencies = {
  getDocumentByIdForAccount,
  getCharacterByIdForAccount,
  updateDocumentAuthorSnapshotRecord,
  now: () => new Date(),
};

export async function refreshOwnedOgpComplaintAuthorSnapshotImpl(
  input: {
    accountId: string;
    documentId: string;
  },
  dependencies: RefreshDependencies = defaultDependencies,
) {
  const existingDocument = await dependencies.getDocumentByIdForAccount({
    accountId: input.accountId,
    documentId: input.documentId,
  });

  if (!existingDocument || existingDocument.documentType !== "ogp_complaint") {
    throw new DocumentAccessDeniedError();
  }

  const character = await dependencies.getCharacterByIdForAccount({
    accountId: input.accountId,
    characterId: existingDocument.characterId,
  });

  if (!character || character.serverId !== existingDocument.serverId) {
    throw new DocumentCharacterUnavailableError();
  }

  const capturedAt = dependencies.now();
  const authorSnapshot = buildAuthorSnapshot({
    character,
    server: existingDocument.server,
    capturedAt,
  });
  const updateAuthorSnapshot =
    dependencies.updateDocumentAuthorSnapshotRecord ??
    updateDocumentAuthorSnapshotRecord;
  const refreshedDocument = await updateAuthorSnapshot({
    documentId: existingDocument.id,
    authorSnapshotJson: authorSnapshot,
    snapshotCapturedAt: capturedAt,
  });

  if (!refreshedDocument) {
    throw new DocumentAccessDeniedError();
  }

  return {
    document: refreshedDocument,
    authorSnapshot,
  };
}
