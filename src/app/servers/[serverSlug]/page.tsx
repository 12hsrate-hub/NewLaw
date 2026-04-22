import { AuthenticatedServerHub } from "@/components/product/server-directory/server-hub";
import { PageContainer } from "@/components/ui/page-container";
import { getProtectedServerHubContext } from "@/server/server-directory/hub";

export const dynamic = "force-dynamic";

type ServerHubPageProps = {
  params: Promise<{
    serverSlug: string;
  }>;
};

export default async function ServerHubPage({ params }: ServerHubPageProps) {
  const resolvedParams = await params;
  const context = await getProtectedServerHubContext({
    serverSlug: resolvedParams.serverSlug,
    nextPath: `/servers/${resolvedParams.serverSlug}`,
  });

  return (
    <PageContainer>
      <main className="min-h-screen px-6 py-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
          <AuthenticatedServerHub context={context} />
        </div>
      </main>
    </PageContainer>
  );
}
