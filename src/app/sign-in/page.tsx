import { redirect } from "next/navigation";

import { SignInForm } from "@/components/product/auth/sign-in-form";
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
    "Подтверждение смены email завершено. Если сессия уже активна, защищённая часть приложения откроется автоматически.",
  "email-change-expired":
    "Ссылка подтверждения смены email истекла. Запроси смену email заново, когда этот сценарий будет включён в интерфейсе.",
  "email-change-invalid":
    "Ссылка подтверждения смены email недействительна или повреждена.",
  "missing-code": "В ссылке подтверждения не хватает токена. Запроси новое письмо.",
  "password-reset-success":
    "Пароль обновлён. Теперь войди с новым паролем.",
  "recovery-expired":
    "Ссылка для восстановления пароля истекла. Запроси новое письмо и открой самую свежую ссылку.",
  "recovery-invalid":
    "Ссылка для восстановления пароля недействительна, повреждена или сессия уже истекла. Запроси новое письмо.",
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const user = await getCurrentUser();

  if (user) {
    redirect("/app");
  }

  const resolvedSearchParams = await searchParams;
  const nextPath =
    typeof resolvedSearchParams?.next === "string" && resolvedSearchParams.next.startsWith("/")
      ? resolvedSearchParams.next
      : "/app";
  const statusMessage =
    resolvedSearchParams?.status && statusMessages[resolvedSearchParams.status]
      ? statusMessages[resolvedSearchParams.status]
      : null;

  return (
    <PageContainer>
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 py-16">
        {statusMessage ? (
          <p className="max-w-md rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3 text-sm leading-6">
            {statusMessage}
          </p>
        ) : null}
        <SignInForm nextPath={nextPath} />
      </main>
    </PageContainer>
  );
}
