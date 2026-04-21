import {
  ClaimsFamilyFoundation,
  DocumentNoCharactersState,
  DocumentServerNotFoundState,
} from "@/components/product/document-area/document-area-foundation";
import {
  buildCharactersBridgePath,
  getServerDocumentsRouteContext,
} from "@/server/document-area/context";

export const dynamic = "force-dynamic";

type ClaimsNewPageProps = {
  params: Promise<{
    serverSlug: string;
  }>;
  searchParams?: Promise<{
    subtype?: string;
  }>;
};

function readSelectedSubtype(value: string | undefined) {
  if (value === "rehabilitation" || value === "lawsuit") {
    return value;
  }

  return null;
}

export default async function ClaimsNewPage({
  params,
  searchParams,
}: ClaimsNewPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const context = await getServerDocumentsRouteContext({
    serverSlug: resolvedParams.serverSlug,
    nextPath: `/servers/${resolvedParams.serverSlug}/documents/claims/new`,
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
        bridgeHref={buildCharactersBridgePath()}
        server={context.server}
      />
    );
  }

  return (
    <ClaimsFamilyFoundation
      mode="new"
      selectedCharacter={context.selectedCharacter}
      selectedSubtype={readSelectedSubtype(resolvedSearchParams?.subtype)}
      server={context.server}
    />
  );
}
