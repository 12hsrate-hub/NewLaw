import { redirect } from "next/navigation";

import { sanitizeNextPath } from "@/lib/auth/email-auth";
import { CheckEmailCard } from "@/components/product/auth/check-email-card";
import { PageContainer } from "@/components/ui/page-container";
import { getCurrentUser } from "@/server/auth/helpers";

type CheckEmailPageProps = {
  searchParams?: Promise<{
    next?: string;
  }>;
};

export default async function CheckEmailPage({ searchParams }: CheckEmailPageProps) {
  const resolvedSearchParams = await searchParams;
  const nextPath = sanitizeNextPath(resolvedSearchParams?.next);
  const user = await getCurrentUser();

  if (user) {
    redirect(nextPath);
  }

  return (
    <PageContainer
      as="main"
      contentClassName="space-y-6"
      tone="workspace"
      variant="readable"
    >
      <div className="flex justify-center">
        <CheckEmailCard flow="signup" nextPath={nextPath} />
      </div>
      <p className="text-sm leading-6 text-[var(--muted)]">
        После подтверждения письма вернись ко входу и продолжи работу в аккаунте.
      </p>
    </PageContainer>
  );
}
