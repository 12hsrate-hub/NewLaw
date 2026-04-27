import type { ReactNode } from "react";

import Link from "next/link";

import { PrimaryShell } from "@/components/product/shell/primary-shell";
import { PageContainer } from "@/components/ui/page-container";
import { EmbeddedCard } from "@/components/ui/embedded-card";
import { SectionHeader } from "@/components/ui/section-header";
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
      <PageContainer as="main" contentClassName="flex flex-col gap-6" variant="wide">
        <EmbeddedCard className="space-y-3">
          <SectionHeader
            description="Здесь находятся настройки аккаунта, безопасность, доступы и служебные обзорные разделы. Работа по конкретному серверу открывается из отдельных серверных зон, а разделы персонажей, доверителей и документов здесь сохранены как удобные обзорные маршруты."
            eyebrow="Аккаунт"
            title="Аккаунт"
          />
          <nav
            aria-label="Навигация аккаунта"
            className="flex flex-wrap gap-3 border-t border-[var(--border)] pt-3"
          >
            <Link
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--surface-hover)]"
              href="/account"
            >
              Обзор
            </Link>
            <Link
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--surface-hover)]"
              href="/account/security"
            >
              Безопасность
            </Link>
            <Link
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--surface-hover)]"
              href="/account/characters"
            >
              Персонажи
            </Link>
            <Link
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--surface-hover)]"
              href="/account/documents"
            >
              Документы
            </Link>
            <Link
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--surface-hover)]"
              href="/account/trustors"
            >
              Доверители
            </Link>
            {account.isSuperAdmin ? (
              <Link
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--surface-hover)]"
                href="/internal/access-requests"
              >
                Заявки на доступ
              </Link>
            ) : null}
          </nav>
        </EmbeddedCard>
        {children}
      </PageContainer>
    </PrimaryShell>
  );
}
