import {
  ClaimsFamilyFoundation,
  DocumentServerNotFoundState,
} from "@/components/product/document-area/document-area-foundation";
import { getClaimsEditorFoundationRouteContext } from "@/server/document-area/context";

export const dynamic = "force-dynamic";

type ClaimsEditorFoundationPageProps = {
  params: Promise<{
    serverSlug: string;
    documentId: string;
  }>;
};

export default async function ClaimsEditorFoundationPage({
  params,
}: ClaimsEditorFoundationPageProps) {
  const resolvedParams = await params;
  const context = await getClaimsEditorFoundationRouteContext({
    serverSlug: resolvedParams.serverSlug,
    documentId: resolvedParams.documentId,
    nextPath: `/servers/${resolvedParams.serverSlug}/documents/claims/${resolvedParams.documentId}`,
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
      documentId={context.documentId}
      mode="editor"
      selectedCharacter={context.selectedCharacter}
      server={context.server}
    />
  );
}
