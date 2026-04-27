import {
  DocumentServerNotFoundState,
  ServerDocumentsHub,
} from "@/components/product/document-area/document-area-foundation";
import {
  buildCharactersBridgePath,
  getServerDocumentsRouteContext,
} from "@/server/document-area/context";

export const dynamic = "force-dynamic";

type ServerDocumentsPageProps = {
  params: Promise<{
    serverSlug: string;
  }>;
};

export default async function ServerDocumentsPage({ params }: ServerDocumentsPageProps) {
  const resolvedParams = await params;
  const context = await getServerDocumentsRouteContext({
    serverSlug: resolvedParams.serverSlug,
    nextPath: `/servers/${resolvedParams.serverSlug}/documents`,
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
      <ServerDocumentsHub
        attorneyRequestDocumentCount={context.attorneyRequestDocumentCount}
        bridgeHref={buildCharactersBridgePath(context.server.code)}
        documentEntryCapabilities={context.documentEntryCapabilities}
        legalServicesAgreementDocumentCount={context.legalServicesAgreementDocumentCount}
        ogpComplaintDocumentCount={context.ogpComplaintDocumentCount}
        selectedCharacter={null}
        server={context.server}
        workspaceCapabilities={context.workspaceCapabilities}
      />
    );
  }

  return (
    <ServerDocumentsHub
      attorneyRequestDocumentCount={context.attorneyRequestDocumentCount}
      documentEntryCapabilities={context.documentEntryCapabilities}
      legalServicesAgreementDocumentCount={context.legalServicesAgreementDocumentCount}
      ogpComplaintDocumentCount={context.ogpComplaintDocumentCount}
      selectedCharacter={context.selectedCharacter}
      server={context.server}
      workspaceCapabilities={context.workspaceCapabilities}
    />
  );
}
