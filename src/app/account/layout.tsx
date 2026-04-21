import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { PageContainer } from "@/components/ui/page-container";
import { requireProtectedAccountContext } from "@/server/auth/protected";

type AccountLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function AccountLayout({ children }: AccountLayoutProps) {
  const protectedContext = await requireProtectedAccountContext("/account", undefined, {
    allowMustChangePassword: true,
  });

  return (
    <PageContainer>
      <main className="min-h-screen px-6 py-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
          <Card className="space-y-3">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Account</p>
            <h1 className="text-3xl font-semibold">Аккаунт {protectedContext.account.login}</h1>
            <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Это foundation-level account zone. Рабочие document-модули живут отдельно в
              server-scoped routes, а `/account` остаётся зоной кабинета и overview-маршрутов.
            </p>
          </Card>
          {children}
        </div>
      </main>
    </PageContainer>
  );
}
