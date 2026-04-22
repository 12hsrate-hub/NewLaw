import type { PropsWithChildren, ReactNode } from "react";

import Link from "next/link";

import { Card } from "@/components/ui/card";
import { PageContainer } from "@/components/ui/page-container";

const internalNavItems = [
  {
    href: "/internal",
    label: "Overview",
  },
  {
    href: "/internal/laws",
    label: "Laws",
  },
  {
    href: "/internal/precedents",
    label: "Precedents",
  },
  {
    href: "/internal/security",
    label: "Security",
  },
  {
    href: "/internal/health",
    label: "Health",
  },
] as const;

type InternalLayoutProps = PropsWithChildren;

type InternalAccessDeniedStateProps = {
  accountLogin: string;
};

type InternalSectionSkeletonProps = {
  eyebrow: string;
  title: string;
  description: string;
};

type InternalOverviewCardProps = {
  href: string;
  title: string;
  description: string;
};

export function InternalLayout({ children }: InternalLayoutProps) {
  return (
    <PageContainer>
      <main className="min-h-screen bg-[#f4ede7] px-6 py-10 text-[#1e1916]">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
          <Card className="space-y-4 border-[#d7c4b6] bg-[#fff8f2] shadow-[0_20px_60px_rgba(58,35,22,0.10)]">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.24em] text-[#8c5a36]">Internal</p>
              <h1 className="text-3xl font-semibold">Super Admin Panel</h1>
              <p className="max-w-3xl text-sm leading-6 text-[#6f6258]">
                Это отдельный internal contour для corpus, security и platform-level overview.
                Он не является частью account zone, server hub или user workspace.
              </p>
            </div>

            <nav
              aria-label="Internal navigation"
              className="flex flex-wrap gap-3 border-t border-[#e7d7cb] pt-4"
            >
              {internalNavItems.map((item) => (
                <Link
                  key={item.href}
                  className="rounded-2xl border border-[#d7c4b6] bg-white/80 px-4 py-2 text-sm font-medium transition hover:bg-white"
                  href={item.href}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </Card>

          {children}
        </div>
      </main>
    </PageContainer>
  );
}

export function InternalAccessDeniedState({
  accountLogin,
}: InternalAccessDeniedStateProps) {
  return (
    <Card className="space-y-4 border-[#e0c0bd] bg-[#fff4f2]">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.24em] text-[#b44b3f]">Access denied</p>
        <h2 className="text-2xl font-semibold">Этот internal contour доступен только super_admin</h2>
        <p className="max-w-3xl text-sm leading-6 text-[#7a4e49]">
          Аккаунт <span className="font-medium">{accountLogin}</span> авторизован, но не имеет
          доступа к internal admin routes. User-facing маршруты и self-service account zone
          остаются доступны по своей policy.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          className="rounded-2xl border border-[#d7c4b6] bg-white px-4 py-2 text-sm font-medium transition hover:bg-[#fffaf5]"
          href="/account"
        >
          Перейти в account zone
        </Link>
        <Link
          className="rounded-2xl border border-[#d7c4b6] bg-white px-4 py-2 text-sm font-medium transition hover:bg-[#fffaf5]"
          href="/servers"
        >
          Открыть server directory
        </Link>
      </div>
    </Card>
  );
}

export function InternalSectionSkeleton({
  eyebrow,
  title,
  description,
}: InternalSectionSkeletonProps) {
  return (
    <Card className="space-y-4 border-[#d7c4b6] bg-white/80">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.24em] text-[#8c5a36]">{eyebrow}</p>
        <h2 className="text-2xl font-semibold">{title}</h2>
        <p className="max-w-3xl text-sm leading-6 text-[#6f6258]">{description}</p>
      </div>

      <div className="rounded-2xl border border-dashed border-[#d7c4b6] bg-[#fff8f2] px-4 py-4 text-sm leading-6 text-[#6f6258]">
        Этот route уже существует как target contour, но feature content ещё не перенесён из
        transitional `/app/admin-*` flows.
      </div>
    </Card>
  );
}

export function InternalOverviewCard({
  href,
  title,
  description,
}: InternalOverviewCardProps) {
  return (
    <Link href={href}>
      <Card className="h-full space-y-3 border-[#d7c4b6] bg-white/80 transition hover:bg-white">
        <p className="text-xs uppercase tracking-[0.24em] text-[#8c5a36]">Section</p>
        <h3 className="text-xl font-semibold">{title}</h3>
        <p className="text-sm leading-6 text-[#6f6258]">{description}</p>
      </Card>
    </Link>
  );
}

export function InternalOverviewGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 lg:grid-cols-2">{children}</div>;
}
