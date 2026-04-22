import {
  DocumentNoCharactersState,
  DocumentServerNotFoundState,
} from "@/components/product/document-area/document-area-foundation";
import { OgpComplaintDraftCreateEntry } from "@/components/product/document-area/document-persistence";
import {
  buildCharactersBridgePath,
  getServerDocumentsRouteContext,
} from "@/server/document-area/context";

export const dynamic = "force-dynamic";

type OgpComplaintNewPageProps = {
  params: Promise<{
    serverSlug: string;
  }>;
  searchParams?: Promise<{
    status?: string;
  }>;
};

export default async function OgpComplaintNewPage({
  params,
  searchParams,
}: OgpComplaintNewPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const context = await getServerDocumentsRouteContext({
    serverSlug: resolvedParams.serverSlug,
    nextPath: `/servers/${resolvedParams.serverSlug}/documents/ogp-complaints/new`,
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
    <OgpComplaintDraftCreateEntry
      characters={context.characters}
      selectedCharacter={context.selectedCharacter}
      server={context.server}
      trustorRegistry={context.trustorRegistry}
      status={resolvedSearchParams?.status}
    />
  );
}
