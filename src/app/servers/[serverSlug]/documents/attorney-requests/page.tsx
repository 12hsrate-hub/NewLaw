import { DocumentServerNotFoundState } from "@/components/product/document-area/document-area-foundation";
import { AttorneyRequestFamilyPersistedList } from "@/components/product/document-area/document-persistence";
import { getAttorneyRequestFamilyRouteContext } from "@/server/document-area/context";

export const dynamic = "force-dynamic";

type AttorneyRequestFamilyPageProps = {
  params: Promise<{
    serverSlug: string;
  }>;
};

export default async function AttorneyRequestFamilyPage({
  params,
}: AttorneyRequestFamilyPageProps) {
  const resolvedParams = await params;
  const context = await getAttorneyRequestFamilyRouteContext({
    serverSlug: resolvedParams.serverSlug,
    nextPath: `/servers/${resolvedParams.serverSlug}/documents/attorney-requests`,
  });

  if (context.status === "server_not_found") {
    return (
      <DocumentServerNotFoundState
        requestedServerSlug={context.requestedServerSlug}
        servers={context.servers}
      />
    );
  }

  return (
    <AttorneyRequestFamilyPersistedList
      canCreateDocuments={context.canCreateDocuments}
      documents={context.documents}
      selectedCharacter={context.selectedCharacter}
      server={context.server}
      trustorRegistry={context.trustorRegistry}
    />
  );
}
