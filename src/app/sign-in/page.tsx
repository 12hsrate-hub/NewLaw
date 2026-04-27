import { redirect } from "next/navigation";

import { sanitizeNextPath } from "@/lib/auth/email-auth";
import { ContextPanel } from "@/components/product/foundation/context-panel";
import { SignInForm } from "@/components/product/auth/sign-in-form";
import { EmbeddedCard } from "@/components/ui/embedded-card";
import { PageContainer } from "@/components/ui/page-container";
import { getCurrentUser } from "@/server/auth/helpers";

type SignInPageProps = {
  searchParams?: Promise<{
    next?: string;
    status?: string;
  }>;
};

const statusMessages: Record<string, string> = {
  "auth-error": "Не удалось завершить вход. Попробуй запросить подтверждение ещё раз.",
  "confirmation-expired":
    "Ссылка подтверждения истекла. Зарегистрируйся заново или запроси новое письмо через повторную регистрацию.",
  "confirmation-invalid":
    "Ссылка подтверждения недействительна или повреждена. Открой самое свежее письмо и попробуй ещё раз.",
  "email-change-confirmed":
    "Подтверждение смены email завершено. Теперь можно войти уже с новым подтверждённым адресом или по прежнему login.",
  "email-change-expired":
    "Ссылка подтверждения смены email истекла. Запроси смену email заново, когда этот сценарий будет включён в интерфейсе.",
  "email-change-invalid":
    "Ссылка подтверждения смены email недействительна или повреждена.",
  "missing-code": "В ссылке подтверждения не хватает токена. Запроси новое письмо.",
  "password-changed-success":
    "Пароль успешно изменён. Войди заново уже с новым паролем.",
  "password-reset-success":
    "Пароль обновлён. Теперь войди с новым паролем.",
  "recovery-expired":
    "Ссылка для восстановления пароля истекла. Запроси новое письмо и открой самую свежую ссылку.",
  "recovery-invalid":
    "Ссылка для восстановления пароля недействительна, повреждена или сессия уже истекла. Запроси новое письмо.",
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const resolvedSearchParams = await searchParams;
  const nextPath = sanitizeNextPath(resolvedSearchParams?.next);
  const user = await getCurrentUser();

  if (user) {
    redirect(nextPath);
  }
  const statusMessage =
    resolvedSearchParams?.status && statusMessages[resolvedSearchParams.status]
      ? statusMessages[resolvedSearchParams.status]
      : null;

  return (
    <PageContainer
      as="main"
      contentClassName="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start xl:gap-10"
      tone="workspace"
      variant="split"
    >
      <div className="space-y-4 lg:max-w-xl">
        {statusMessage ? (
          <EmbeddedCard>
            <p className="text-sm leading-6">{statusMessage}</p>
          </EmbeddedCard>
        ) : null}
        <SignInForm nextPath={nextPath} />
      </div>

      <ContextPanel
        description="Юридический workspace NewLaw помогает работать с серверами, документами и адвокатскими сценариями Lawyer5RP без смешения с настройками аккаунта."
        eyebrow="Lawyer5RP"
        footer="Если вход ещё не подтверждён по email, сначала открой самую свежую ссылку из письма."
        title="Тёмный юридический workspace для GTA5RP"
      >
        <ul className="space-y-3 text-sm leading-6 text-[var(--muted)]">
          <li>Работа открывается по серверам, а документы и адвокатские сценарии собраны в отдельных рабочих зонах.</li>
          <li>Безопасность аккаунта и восстановление доступа вынесены в отдельные сценарии, чтобы не перегружать рабочие страницы.</li>
          <li>После входа можно быстро перейти к помощнику, документам и доступным серверным кабинетам.</li>
        </ul>
      </ContextPanel>
    </PageContainer>
  );
}
