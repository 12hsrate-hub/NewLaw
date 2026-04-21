import { DocumentServerNotFoundState, ClaimsFamilyFoundation } from "@/components/product/document-area/document-area-foundation";
import { getClaimsFamilyFoundationRouteContext } from "@/server/document-area/context";

export const dynamic = "force-dynamic";

type ClaimsFamilyPageProps = {
  params: Promise<{
    serverSlug: string;
  }>;
};

export default async function ClaimsFamilyPage({ params }: ClaimsFamilyPageProps) {
  const resolvedParams = await params;
  const context = await getClaimsFamilyFoundationRouteContext({
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
    <ClaimsFamilyFoundation
      mode="index"
      selectedCharacter={context.selectedCharacter}
      server={context.server}
    />
  );
}
