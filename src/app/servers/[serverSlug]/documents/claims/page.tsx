import { DocumentServerNotFoundState } from "@/components/product/document-area/document-area-foundation";
import { ClaimsFamilyPersistedList } from "@/components/product/document-area/document-persistence";
import { getClaimsFamilyRouteContext } from "@/server/document-area/context";

export const dynamic = "force-dynamic";

type ClaimsFamilyPageProps = {
  params: Promise<{
    serverSlug: string;
  }>;
};

export default async function ClaimsFamilyPage({ params }: ClaimsFamilyPageProps) {
  const resolvedParams = await params;
  const context = await getClaimsFamilyRouteContext({
    serverSlug: resolvedParams.serverSlug,
    nextPath: `/servers/${resolvedParams.serverSlug}/documents/claims`,
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
    <ClaimsFamilyPersistedList
      canCreateDocuments={context.canCreateDocuments}
      documents={context.documents}
      selectedCharacter={context.selectedCharacter}
      server={context.server}
    />
  );
}
