import { redirect } from "next/navigation";

import { ContextPanel } from "@/components/product/foundation/context-panel";
import { ResetPasswordForm } from "@/components/product/auth/reset-password-form";
import { PageContainer } from "@/components/ui/page-container";
import { getCurrentSession, getCurrentUser } from "@/server/auth/helpers";
import {
  buildRecoveryInvalidPath,
  hasServerRecoveryAccess,
} from "@/server/auth/recovery";

export default async function ResetPasswordPage() {
  const hasRecoveryAccess = await hasServerRecoveryAccess({
    getCurrentSession,
    getCurrentUser,
  });

  if (!hasRecoveryAccess) {
    redirect(buildRecoveryInvalidPath());
  }

  return (
    <PageContainer
      as="main"
      contentClassName="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start xl:gap-10"
      tone="workspace"
      variant="split"
    >
      <div className="lg:max-w-xl">
        <ResetPasswordForm />
      </div>

      <ContextPanel
        description="Задай новый пароль, чтобы снова войти в аккаунт."
        eyebrow="NewLaw"
        title="Задайте новый пароль"
      >
        <ul className="space-y-3 text-sm leading-6 text-[var(--muted)]">
          <li>Используй пароль, который легко запомнить только тебе.</li>
          <li>После сохранения можно будет войти заново.</li>
          <li>Если ссылка уже не работает, запроси новое письмо восстановления.</li>
        </ul>
      </ContextPanel>
    </PageContainer>
  );
}
