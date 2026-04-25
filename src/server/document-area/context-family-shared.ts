import { listDocumentsByAccount, listDocumentsByAccountAndServerAndType } from "@/db/repositories/document.repository";
import { type DocumentAreaPersistedListItem, buildPersistedDocumentListItem } from "@/server/document-area/context-persisted-documents";

type ServerDocumentRecord = Awaited<ReturnType<typeof listDocumentsByAccountAndServerAndType>>[number];
type PersistedDocumentServerRecord = Awaited<ReturnType<typeof listDocumentsByAccount>>[number]["server"];

export function buildDocumentRouteServerSummary(server: {
  id: string;
  code: string;
  name: string;
}) {
  return {
    id: server.id,
    code: server.code,
    name: server.name,
  };
}

export function buildPersistedServerDocumentItems(
  documents: ReadonlyArray<ServerDocumentRecord>,
  server: PersistedDocumentServerRecord,
): DocumentAreaPersistedListItem[] {
  return documents.map((document) =>
    buildPersistedDocumentListItem({
      ...document,
      server,
    }),
  );
}

export function sortDocumentsByUpdatedAtDesc<T extends { updatedAt: Date; createdAt: Date }>(
  documents: ReadonlyArray<T>,
): T[] {
  return [...documents].sort((left, right) => {
    const updatedAtDiff = right.updatedAt.getTime() - left.updatedAt.getTime();

    if (updatedAtDiff !== 0) {
      return updatedAtDiff;
    }

    return right.createdAt.getTime() - left.createdAt.getTime();
  });
}
