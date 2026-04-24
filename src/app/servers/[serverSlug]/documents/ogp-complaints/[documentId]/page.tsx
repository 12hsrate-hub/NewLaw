import {
  DocumentServerNotFoundState,
} from "@/components/product/document-area/document-area-foundation";
import {
  InvalidDocumentDataState,
  OgpComplaintPersistedEditor,
  OwnedDocumentUnavailableState,
} from "@/components/product/document-area/document-persistence";
import {
  getOgpComplaintEditorRouteContext,
} from "@/server/document-area/context";

export const dynamic = "force-dynamic";

type OgpComplaintEditorFoundationPageProps = {
  params: Promise<{
    serverSlug: string;
    documentId: string;
  }>;
  searchParams?: Promise<{
    status?: string;
  }>;
};

export default async function OgpComplaintEditorFoundationPage({
  params,
  searchParams,
}: OgpComplaintEditorFoundationPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const context = await getOgpComplaintEditorRouteContext({
    serverSlug: resolvedParams.serverSlug,
    documentId: resolvedParams.documentId,
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

  if (context.status === "document_not_found") {
    return (
      <OwnedDocumentUnavailableState
        documentId={context.documentId}
        server={context.server}
      />
    );
  }

  if (context.status === "invalid_document_data") {
    return (
      <InvalidDocumentDataState
        document={context.document}
        familyHref={`/servers/${context.server.code}/documents/ogp-complaints`}
        familyLabel="жалобам в ОГП"
        server={context.server}
      />
    );
  }

  return (
    <OgpComplaintPersistedEditor
      document={context.document}
      status={resolvedSearchParams?.status}
    />
  );
}
