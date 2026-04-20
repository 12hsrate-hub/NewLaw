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
    resolvedSearchParams?.status === "auth-error"
      ? "Не удалось подтвердить вход через письмо. Попробуй запросить новую ссылку."
      : resolvedSearchParams?.status === "missing-code"
        ? "Ссылка для входа неполная. Запроси новую ссылку."
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
