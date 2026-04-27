import { redirect } from "next/navigation";

import { ProductDashboard } from "@/components/product/home/product-dashboard";
import { PrimaryShell } from "@/components/product/shell/primary-shell";
import { PageContainer } from "@/components/ui/page-container";
import { requireProtectedAccountContext } from "@/server/auth/protected";
import { getCurrentUser } from "@/server/auth/helpers";
import { getHomeDashboardContext } from "@/server/home/dashboard";
import { getPrimaryShellContext } from "@/server/primary-shell/context";

export default async function HomePage() {
  const user = await getCurrentUser();

  if (!user) {
    return redirect("/sign-in");
  }

  const protectedContext = await requireProtectedAccountContext("/");
  const shellContext = await getPrimaryShellContext({
    currentPath: "/",
    protectedContext,
  });
  const dashboardContext = await getHomeDashboardContext({
    shellContext,
  });

  return (
    <PrimaryShell context={shellContext}>
      <PageContainer>
        <main className="min-h-screen px-6 py-10">
          <div className="mx-auto w-full max-w-6xl">
            <ProductDashboard context={dashboardContext} />
          </div>
        </main>
      </PageContainer>
    </PrimaryShell>
  );
}
