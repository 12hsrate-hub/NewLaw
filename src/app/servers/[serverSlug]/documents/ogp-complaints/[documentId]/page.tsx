import {
  DocumentNoCharactersState,
  DocumentServerNotFoundState,
  OgpComplaintFoundation,
} from "@/components/product/document-area/document-area-foundation";
import {
  buildCharactersBridgePath,
  getServerDocumentsRouteContext,
} from "@/server/document-area/context";

export const dynamic = "force-dynamic";

type OgpComplaintEditorFoundationPageProps = {
  params: Promise<{
    serverSlug: string;
    documentId: string;
  }>;
};

export default async function OgpComplaintEditorFoundationPage({
  params,
}: OgpComplaintEditorFoundationPageProps) {
  const resolvedParams = await params;
  const context = await getServerDocumentsRouteContext({
    serverSlug: resolvedParams.serverSlug,
    nextPath: `/servers/${resolvedParams.serverSlug}/documents/ogp-complaints/${resolvedParams.documentId}`,
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
    <OgpComplaintFoundation
      documentId={resolvedParams.documentId}
      mode="editor"
      selectedCharacter={context.selectedCharacter}
      server={context.server}
    />
  );
}
