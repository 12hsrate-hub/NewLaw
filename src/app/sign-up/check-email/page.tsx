import { redirect } from "next/navigation";

import { CheckEmailCard } from "@/components/product/auth/check-email-card";
import { PageContainer } from "@/components/ui/page-container";
import { getCurrentUser } from "@/server/auth/helpers";

type CheckEmailPageProps = {
  searchParams?: Promise<{
    next?: string;
  }>;
};

export default async function CheckEmailPage({ searchParams }: CheckEmailPageProps) {
  const user = await getCurrentUser();

  if (user) {
    redirect("/app");
  }

  const resolvedSearchParams = await searchParams;
  const nextPath =
    typeof resolvedSearchParams?.next === "string" && resolvedSearchParams.next.startsWith("/")
      ? resolvedSearchParams.next
      : "/app";

  return (
    <PageContainer>
      <main className="flex min-h-screen items-center justify-center px-6 py-16">
        <CheckEmailCard flow="signup" nextPath={nextPath} />
      </main>
    </PageContainer>
  );
}
