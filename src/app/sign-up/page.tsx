import { redirect } from "next/navigation";

import { sanitizeNextPath } from "@/lib/auth/email-auth";
import { ContextPanel } from "@/components/product/foundation/context-panel";
import { SignUpForm } from "@/components/product/auth/sign-up-form";
import { PageContainer } from "@/components/ui/page-container";
import { getCurrentUser } from "@/server/auth/helpers";

type SignUpPageProps = {
  searchParams?: Promise<{
    next?: string;
  }>;
};

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const resolvedSearchParams = await searchParams;
  const nextPath = sanitizeNextPath(resolvedSearchParams?.next);
  const user = await getCurrentUser();

  if (user) {
    redirect(nextPath);
  }

  return (
    <PageContainer
      as="main"
      contentClassName="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start xl:gap-10"
      tone="workspace"
      variant="split"
    >
      <div className="lg:max-w-xl">
        <SignUpForm nextPath={nextPath} />
      </div>

      <ContextPanel
        description="Создай аккаунт, чтобы начать работу."
        eyebrow="NewLaw"
        title="Регистрация"
      >
        <ul className="space-y-3 text-sm leading-6 text-[var(--muted)]">
          <li>Укажи основные данные и заверши регистрацию.</li>
          <li>После этого мы попросим подтвердить почту.</li>
          <li>Если письмо не появилось сразу, проверь входящие чуть позже.</li>
        </ul>
      </ContextPanel>
    </PageContainer>
  );
}
