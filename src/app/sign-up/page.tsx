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
        description="После регистрации Lawyer5RP создаёт защищённый аккаунт, а подтверждение email открывает доступ к обычным рабочим зонам проекта."
        eyebrow="Lawyer5RP"
        footer="Письмо подтверждения должно приходить через боевую почтовую доставку проекта. Если письма нет, проверь спам и повтори попытку позже."
        title="Аккаунт для юридической работы по серверам"
      >
        <ul className="space-y-3 text-sm leading-6 text-[var(--muted)]">
          <li>Главная страница станет рабочей панелью с быстрыми входами в помощник, документы и серверные кабинеты.</li>
          <li>Настройки безопасности и персонажи остаются в отдельной зоне аккаунта, чтобы рабочие разделы не выглядели как анкета.</li>
          <li>Для адвокатских сценариев доступны отдельные серверные кабинеты, когда на сервере уже есть нужный доступ.</li>
        </ul>
      </ContextPanel>
    </PageContainer>
  );
}
