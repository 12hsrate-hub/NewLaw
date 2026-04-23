import {
  DocumentNoCharactersState,
  DocumentServerNotFoundState,
} from "@/components/product/document-area/document-area-foundation";
import { AttorneyRequestDraftCreateEntry } from "@/components/product/document-area/document-persistence";
import {
  buildCharactersBridgePath,
  getServerDocumentsRouteContext,
} from "@/server/document-area/context";

export const dynamic = "force-dynamic";

type AttorneyRequestNewPageProps = {
  params: Promise<{
    serverSlug: string;
  }>;
  searchParams?: Promise<{
    status?: string;
    trustorId?: string;
  }>;
};

export default async function AttorneyRequestNewPage({
  params,
  searchParams,
}: AttorneyRequestNewPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const context = await getServerDocumentsRouteContext({
    serverSlug: resolvedParams.serverSlug,
    nextPath: `/servers/${resolvedParams.serverSlug}/documents/attorney-requests/new`,
  });

  if (context.status === "server_not_found") {
    return (
      <DocumentServerNotFoundState
        requestedServerSlug={context.requestedServerSlug}
        servers={context.servers}
      />
    );
  }

  if (context.status === "no_characters") {
    return (
      <DocumentNoCharactersState
        bridgeHref={buildCharactersBridgePath(context.server.code)}
        server={context.server}
      />
    );
  }

  return (
    <AttorneyRequestDraftCreateEntry
      characters={context.characters}
      initialTrustorId={resolvedSearchParams?.trustorId}
      selectedCharacter={context.selectedCharacter}
      server={context.server}
      status={resolvedSearchParams?.status}
      trustorRegistry={context.trustorRegistry}
    />
  );
}
