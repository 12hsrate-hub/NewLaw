import { redirect } from "next/navigation";

import { defaultAuthenticatedLandingPath } from "@/lib/auth/email-auth";
import { CheckEmailCard } from "@/components/product/auth/check-email-card";
import { PageContainer } from "@/components/ui/page-container";
import { getCurrentUser } from "@/server/auth/helpers";

export default async function ForgotPasswordCheckEmailPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect(defaultAuthenticatedLandingPath);
  }

  return (
    <PageContainer
      as="main"
      contentClassName="space-y-6"
      tone="workspace"
      variant="readable"
    >
      <div className="flex justify-center">
        <CheckEmailCard flow="recovery" />
      </div>
      <p className="text-sm leading-6 text-[var(--muted)]">
        Когда письмо придёт, открой самую свежую ссылку восстановления и задай новый пароль. Рабочие документы и серверные данные при этом не меняются.
      </p>
    </PageContainer>
  );
}
