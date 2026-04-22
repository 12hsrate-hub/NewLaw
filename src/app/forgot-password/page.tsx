import { redirect } from "next/navigation";

import { sanitizeNextPath } from "@/lib/auth/email-auth";
import { ForgotPasswordForm } from "@/components/product/auth/forgot-password-form";
import { PageContainer } from "@/components/ui/page-container";
import { getCurrentUser } from "@/server/auth/helpers";

type ForgotPasswordPageProps = {
  searchParams?: Promise<{
    next?: string;
  }>;
};

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const resolvedSearchParams = await searchParams;
  const nextPath = sanitizeNextPath(resolvedSearchParams?.next);
  const user = await getCurrentUser();

  if (user) {
    redirect(nextPath);
  }

  return (
    <PageContainer>
      <main className="flex min-h-screen items-center justify-center px-6 py-16">
        <ForgotPasswordForm nextPath={nextPath} />
      </main>
    </PageContainer>
  );
}
