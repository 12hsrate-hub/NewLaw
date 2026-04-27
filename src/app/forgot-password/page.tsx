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
        description="Сценарий восстановления не меняет рабочие разделы и нужен только для безопасного возврата в аккаунт."
        eyebrow="Безопасность"
        footer="После смены пароля можно будет снова войти и вернуться на главную рабочую панель."
        title="Восстановление доступа к аккаунту"
      >
        <ul className="space-y-3 text-sm leading-6 text-[var(--muted)]">
          <li>Укажи email или login аккаунта, чтобы запросить письмо со ссылкой восстановления.</li>
          <li>Рабочие документы и серверные разделы не меняются, пока ты проходишь этот сценарий.</li>
          <li>Если письмо не приходит, проверь папки со скрытыми сообщениями и запроси его заново.</li>
        </ul>
      </ContextPanel>
    </PageContainer>
  );
}
