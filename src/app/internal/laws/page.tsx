import { LawSourceManagementSection } from "@/components/product/law-sources/law-source-management-section";
import { InternalAccessDeniedState } from "@/components/product/internal/internal-shell";
import { getInternalAccessContext } from "@/server/internal/access";
import { getInternalLawCorpusPageData } from "@/server/internal/corpus";

type InternalLawsPageProps = {
  searchParams?: Promise<{
    status?: string;
    previewQuery?: string;
    previewServerId?: string;
  }>;
};

export default async function InternalLawsPage({
  searchParams,
}: InternalLawsPageProps) {
  const accessContext = await getInternalAccessContext("/internal/laws");

  if (accessContext.status === "denied") {
    return <InternalAccessDeniedState accountLogin={accessContext.viewer.login} />;
  }

  const resolvedSearchParams = await searchParams;
  const lawCorpusPageData = await getInternalLawCorpusPageData({
    previewQuery: resolvedSearchParams?.previewQuery,
    previewServerId: resolvedSearchParams?.previewServerId,
  });

  return (
    <LawSourceManagementSection
      bootstrapHealthByServerId={lawCorpusPageData.bootstrapHealthByServerId}
      laws={lawCorpusPageData.laws}
      previewQuery={lawCorpusPageData.previewQuery}
      redirectTo="/internal/laws"
      retrievalPreview={lawCorpusPageData.retrievalPreview}
      selectedPreviewServerId={lawCorpusPageData.selectedPreviewServerId}
      servers={lawCorpusPageData.servers}
      sourceIndexes={lawCorpusPageData.sourceIndexes}
      status={resolvedSearchParams?.status}
    />
  );
}
