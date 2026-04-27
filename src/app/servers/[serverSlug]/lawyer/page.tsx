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
    <PageContainer>
      <main className="min-h-screen px-6 py-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
          <LawyerWorkspaceFoundation context={context} />
        </div>
      </main>
    </PageContainer>
  );
}
