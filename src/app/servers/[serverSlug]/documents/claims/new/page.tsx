import {
  ClaimsFamilyFoundation,
  DocumentNoCharactersState,
  DocumentServerNotFoundState,
} from "@/components/product/document-area/document-area-foundation";
import { ClaimsDraftCreateEntry } from "@/components/product/document-area/document-persistence";
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
    status?: string;
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

  const selectedSubtype = readSelectedSubtype(resolvedSearchParams?.subtype);

  if (!selectedSubtype) {
    return (
      <ClaimsFamilyFoundation
        mode="new"
        selectedCharacter={context.selectedCharacter}
        selectedSubtype={selectedSubtype}
        server={context.server}
      />
    );
  }

  return (
    <ClaimsDraftCreateEntry
      characters={context.characters}
      documentType={selectedSubtype}
      selectedCharacter={context.selectedCharacter}
      server={context.server}
      status={resolvedSearchParams?.status}
    />
  );
}
