import { DocumentServerNotFoundState } from "@/components/product/document-area/document-area-foundation";
import {
  InvalidDocumentDataState,
  LegalServicesAgreementPersistedEditor,
  OwnedDocumentUnavailableState,
} from "@/components/product/document-area/document-persistence";
import { getLegalServicesAgreementEditorRouteContext } from "@/server/document-area/context";

export const dynamic = "force-dynamic";

type LegalServicesAgreementEditorPageProps = {
  params: Promise<{
    serverSlug: string;
    documentId: string;
  }>;
  searchParams?: Promise<{
    status?: string;
  }>;
};

export default async function LegalServicesAgreementEditorPage({
  params,
  searchParams,
}: LegalServicesAgreementEditorPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const context = await getLegalServicesAgreementEditorRouteContext({
    serverSlug: resolvedParams.serverSlug,
    documentId: resolvedParams.documentId,
    nextPath: `/servers/${resolvedParams.serverSlug}/documents/legal-services-agreements/${resolvedParams.documentId}`,
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
        familyHref={`/servers/${context.server.code}/documents/legal-services-agreements`}
        familyLabel="договорам"
        server={context.server}
      />
    );
  }

  if (context.status === "invalid_document_data") {
    return (
      <InvalidDocumentDataState
        document={context.document}
        familyHref={`/servers/${context.server.code}/documents/legal-services-agreements`}
        familyLabel="договорам"
        server={context.server}
      />
    );
  }

  return (
    <LegalServicesAgreementPersistedEditor
      document={context.document}
      status={resolvedSearchParams?.status}
    />
  );
}
