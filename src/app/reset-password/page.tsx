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
        description="Новый пароль нужен только для безопасного входа в аккаунт. Рабочие зоны и маршруты останутся прежними."
        eyebrow="Безопасность"
        footer="После успешного сохранения система попросит войти заново уже с новым паролем."
        title="Задайте новый пароль"
      >
        <ul className="space-y-3 text-sm leading-6 text-[var(--muted)]">
          <li>Используй пароль, который не повторяет старые значения и легко запоминается только тебе.</li>
          <li>После входа можно будет вернуться к помощнику, документам и серверным кабинетам без дополнительной настройки.</li>
          <li>Если ссылка уже устарела, просто запроси новое письмо восстановления.</li>
        </ul>
      </ContextPanel>
    </PageContainer>
  );
}
