import {
  DocumentServerNotFoundState,
} from "@/components/product/document-area/document-area-foundation";
import { OgpComplaintFamilyPersistedList } from "@/components/product/document-area/document-persistence";
import {
  getOgpComplaintFamilyRouteContext,
} from "@/server/document-area/context";

export const dynamic = "force-dynamic";

type OgpComplaintFamilyPageProps = {
  params: Promise<{
    serverSlug: string;
  }>;
};

export default async function OgpComplaintFamilyPage({
  params,
}: OgpComplaintFamilyPageProps) {
  const resolvedParams = await params;
  const context = await getOgpComplaintFamilyRouteContext({
    serverSlug: resolvedParams.serverSlug,
    nextPath: `/servers/${resolvedParams.serverSlug}/documents/ogp-complaints`,
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
    <OgpComplaintFamilyPersistedList
      canCreateDocuments={context.canCreateDocuments}
      documents={context.documents}
      selectedCharacter={context.selectedCharacter}
      server={context.server}
    />
  );
}
