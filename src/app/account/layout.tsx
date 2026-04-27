import type { ReactNode } from "react";

import Link from "next/link";

import { PrimaryShell } from "@/components/product/shell/primary-shell";
import { Card } from "@/components/ui/card";
import { PageContainer } from "@/components/ui/page-container";
import { requireProtectedAccountContext } from "@/server/auth/protected";
import { getPrimaryShellContext } from "@/server/primary-shell/context";

type AccountLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function AccountLayout({ children }: AccountLayoutProps) {
  const protectedContext = await requireProtectedAccountContext("/account", undefined, {
    allowMustChangePassword: true,
  });
  const shellContext = await getPrimaryShellContext({
    currentPath: "/account",
    protectedContext,
  });
  const { account } = protectedContext;

  return (
    <PrimaryShell context={shellContext}>
      <PageContainer>
        <main className="min-h-screen px-6 py-10">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
            <Card className="space-y-3">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Аккаунт</p>
              <h1 className="text-3xl font-semibold">Аккаунт</h1>
              <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
                Здесь находятся настройки аккаунта, безопасность, доступы и служебные обзорные
                разделы. Работа по конкретному серверу открывается из server-scoped зон, а разделы
                персонажей, доверителей и документов здесь сохранены как удобные обзорные маршруты.
              </p>
              <nav
                aria-label="Навигация аккаунта"
                className="flex flex-wrap gap-3 border-t border-[var(--border)] pt-3"
              >
                <Link
                  className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-2 text-sm font-medium transition hover:bg-white"
                  href="/account"
                >
                  Обзор
                </Link>
                <Link
                  className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-2 text-sm font-medium transition hover:bg-white"
                  href="/account/security"
                >
                  Безопасность
                </Link>
                <Link
                  className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-2 text-sm font-medium transition hover:bg-white"
                  href="/account/characters"
                >
                  Персонажи
                </Link>
                <Link
                  className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-2 text-sm font-medium transition hover:bg-white"
                  href="/account/documents"
                >
                  Документы
                </Link>
                <Link
                  className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-2 text-sm font-medium transition hover:bg-white"
                  href="/account/trustors"
                >
                  Доверители
                </Link>
                {account.isSuperAdmin ? (
                  <Link
                    className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-2 text-sm font-medium transition hover:bg-white"
                    href="/internal/access-requests"
                  >
                    Заявки на доступ
                  </Link>
                ) : null}
              </nav>
            </Card>
            {children}
          </div>
        </main>
      </PageContainer>
    </PrimaryShell>
  );
}
