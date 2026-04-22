import { PrecedentSourceFoundationSection } from "@/components/product/precedent-sources/precedent-source-foundation-section";
import { InternalAccessDeniedState } from "@/components/product/internal/internal-shell";
import { getInternalAccessContext } from "@/server/internal/access";
import { getInternalPrecedentCorpusPageData } from "@/server/internal/corpus";

type InternalPrecedentsPageProps = {
  searchParams?: Promise<{
    status?: string;
  }>;
};

export default async function InternalPrecedentsPage({
  searchParams,
}: InternalPrecedentsPageProps) {
  const accessContext = await getInternalAccessContext("/internal/precedents");

  if (accessContext.status === "denied") {
    return <InternalAccessDeniedState accountLogin={accessContext.viewer.login} />;
  }

  const resolvedSearchParams = await searchParams;
  const precedentCorpusPageData = await getInternalPrecedentCorpusPageData();

  return (
    <PrecedentSourceFoundationSection
      redirectTo="/internal/precedents"
      servers={precedentCorpusPageData.servers}
      sourceIndexes={precedentCorpusPageData.sourceIndexes}
      sourceTopics={precedentCorpusPageData.sourceTopics}
      status={resolvedSearchParams?.status}
    />
  );
}
