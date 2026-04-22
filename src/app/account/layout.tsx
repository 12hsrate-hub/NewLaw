import type { ReactNode } from "react";

import Link from "next/link";

import { Card } from "@/components/ui/card";
import { PageContainer } from "@/components/ui/page-container";

type AccountLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function AccountLayout({ children }: AccountLayoutProps) {
  return (
    <PageContainer>
      <main className="min-h-screen px-6 py-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
          <Card className="space-y-3">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Account</p>
            <h1 className="text-3xl font-semibold">Личный кабинет</h1>
            <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Это foundation-level account zone. Рабочие document-модули живут отдельно в
              server-scoped routes, а `/account` остаётся зоной кабинета и overview-маршрутов.
            </p>
            <nav
              aria-label="Account navigation"
              className="flex flex-wrap gap-3 border-t border-[var(--border)] pt-3"
            >
              <Link
                className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-2 text-sm font-medium transition hover:bg-white"
                href="/account"
              >
                Overview
              </Link>
              <Link
                className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-2 text-sm font-medium transition hover:bg-white"
                href="/account/security"
              >
                Security
              </Link>
              <Link
                className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-2 text-sm font-medium transition hover:bg-white"
                href="/account/characters"
              >
                Characters
              </Link>
              <Link
                className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-2 text-sm font-medium transition hover:bg-white"
                href="/account/documents"
              >
                Documents
              </Link>
            </nav>
          </Card>
          {children}
        </div>
      </main>
    </PageContainer>
  );
}
