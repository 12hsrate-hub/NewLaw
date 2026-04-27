import { LawyerWorkspaceFoundation } from "@/components/product/lawyer-workspace/lawyer-workspace-foundation";
import { PageContainer } from "@/components/ui/page-container";
import { getLawyerWorkspaceRouteContext } from "@/server/lawyer-workspace/context";

export const dynamic = "force-dynamic";

type LawyerWorkspacePageProps = {
  params: Promise<{
    serverSlug: string;
  }>;
};

export default async function LawyerWorkspacePage({ params }: LawyerWorkspacePageProps) {
  const resolvedParams = await params;
  const context = await getLawyerWorkspaceRouteContext({
    serverSlug: resolvedParams.serverSlug,
    nextPath: `/servers/${resolvedParams.serverSlug}/lawyer`,
  });

  return (
    <PageContainer as="main" contentClassName="flex flex-col gap-6" variant="wide">
      <LawyerWorkspaceFoundation context={context} />
    </PageContainer>
  );
}
