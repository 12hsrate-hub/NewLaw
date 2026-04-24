import {
  DocumentServerNotFoundState,
} from "@/components/product/document-area/document-area-foundation";
import {
  ClaimsPersistedEditor,
  InvalidDocumentDataState,
  OwnedDocumentUnavailableState,
} from "@/components/product/document-area/document-persistence";
import { getClaimsEditorRouteContext } from "@/server/document-area/context";

export const dynamic = "force-dynamic";

type ClaimsEditorFoundationPageProps = {
  params: Promise<{
    serverSlug: string;
    documentId: string;
  }>;
  searchParams?: Promise<{
    status?: string;
  }>;
};

export default async function ClaimsEditorFoundationPage({
  params,
  searchParams,
}: ClaimsEditorFoundationPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const context = await getClaimsEditorRouteContext({
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

  if (context.status === "document_not_found") {
    return (
      <OwnedDocumentUnavailableState
        documentId={context.documentId}
        familyHref={`/servers/${context.server.code}/documents/claims`}
        familyLabel="persisted claims"
        server={context.server}
      />
    );
  }

  if (context.status === "invalid_document_data") {
    return (
      <InvalidDocumentDataState
        document={context.document}
        familyHref={`/servers/${context.server.code}/documents/claims`}
        familyLabel="документам раздела исков"
        server={context.server}
      />
    );
  }

  return (
    <ClaimsPersistedEditor
      document={context.document}
      status={resolvedSearchParams?.status}
    />
  );
}
