import { redirect } from "next/navigation";

import { sanitizeNextPath } from "@/lib/auth/email-auth";
import { ContextPanel } from "@/components/product/foundation/context-panel";
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
    <PageContainer
      as="main"
      contentClassName="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start xl:gap-10"
      tone="workspace"
      variant="split"
    >
      <div className="lg:max-w-xl">
        <ForgotPasswordForm nextPath={nextPath} />
      </div>

      <ContextPanel
        description="Мы поможем вернуть доступ к аккаунту через письмо на почту."
        eyebrow="NewLaw"
        title="Восстановление доступа к аккаунту"
      >
        <ul className="space-y-3 text-sm leading-6 text-[var(--muted)]">
          <li>Укажи почту или логин аккаунта.</li>
          <li>Мы отправим письмо с дальнейшими шагами.</li>
          <li>Если письмо не приходит, проверь папку со спамом и повтори попытку позже.</li>
        </ul>
      </ContextPanel>
    </PageContainer>
  );
}
