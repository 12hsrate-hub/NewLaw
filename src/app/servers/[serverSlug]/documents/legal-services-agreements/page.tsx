import { DocumentServerNotFoundState } from "@/components/product/document-area/document-area-foundation";
import { LegalServicesAgreementFamilyPersistedList } from "@/components/product/document-area/document-persistence";
import { getLegalServicesAgreementFamilyRouteContext } from "@/server/document-area/context";

export const dynamic = "force-dynamic";

type LegalServicesAgreementFamilyPageProps = {
  params: Promise<{
    serverSlug: string;
  }>;
};

export default async function LegalServicesAgreementFamilyPage({
  params,
}: LegalServicesAgreementFamilyPageProps) {
  const resolvedParams = await params;
  const context = await getLegalServicesAgreementFamilyRouteContext({
    serverSlug: resolvedParams.serverSlug,
    nextPath: `/servers/${resolvedParams.serverSlug}/documents/legal-services-agreements`,
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
    <LegalServicesAgreementFamilyPersistedList
      canCreateDocuments={context.canCreateDocuments}
      documents={context.documents}
      selectedCharacter={context.selectedCharacter}
      server={context.server}
      trustorRegistry={context.trustorRegistry}
    />
  );
}
