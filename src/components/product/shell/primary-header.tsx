import Link from "next/link";

import { BrandLogo } from "@/components/product/brand/brand-logo";
import { signOutAction } from "@/server/actions/auth";
import type { PrimaryShellContext } from "@/server/primary-shell/context";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Card } from "@/components/ui/card";
import { PrimaryNav } from "@/components/product/shell/primary-nav";
import { PrimaryServerSwitcher } from "@/components/product/shell/primary-server-switcher";

type PrimaryHeaderProps = {
  context: PrimaryShellContext;
};

export function PrimaryHeader({ context }: PrimaryHeaderProps) {
  const signInHref = `/sign-in?next=${encodeURIComponent(context.currentPath)}`;
  const viewerLabel = context.viewer.accountLogin ?? context.viewer.accountEmail ?? "аккаунт";

  return (
    <Card className="space-y-3 border-[var(--divider)] bg-[var(--card)] px-4 py-4 shadow-[0_20px_42px_rgba(0,0,0,0.2)] backdrop-blur-xl md:px-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <Link
            className="inline-flex max-w-fit items-center rounded-2xl text-[var(--foreground)] transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
            href="/"
          >
            <BrandLogo size="md" variant="full" />
          </Link>
        </div>

        <div className="flex w-full flex-col items-start gap-2 xl:w-auto xl:min-w-[260px] xl:items-end">
          {context.viewer.isAuthenticated ? (
            <>
              <div className="flex w-full flex-col gap-2 rounded-2xl border border-[var(--divider)] bg-[var(--surface-subtle)] px-3 py-2 text-sm leading-6 text-[var(--muted)] xl:w-auto">
                <div className="inline-flex flex-wrap items-center gap-2">
                  <span className="uppercase tracking-[0.16em] text-[0.7rem] text-[var(--muted)]">
                    Аккаунт
                  </span>
                  <span className="font-medium text-[var(--foreground)]">{viewerLabel}</span>
                </div>
                <PrimaryServerSwitcher
                  activeServerId={context.activeServer.id}
                  availableServers={context.availableServers}
                  compact
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <ButtonLink href="/account" variant="secondary">
                  Аккаунт
                </ButtonLink>
                {context.navigation.internalHref ? (
                  <ButtonLink href={context.navigation.internalHref} variant="secondary">
                    Служебная зона
                  </ButtonLink>
                ) : null}
                <form action={signOutAction}>
                  <Button type="submit" variant="secondary">
                    Выйти
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <>
              <div className="inline-flex max-w-fit items-center gap-2 rounded-2xl border border-[var(--divider)] bg-[var(--surface-subtle)] px-3 py-2 text-sm leading-6 text-[var(--muted)]">
                <span className="uppercase tracking-[0.16em] text-[0.7rem] text-[var(--muted)]">
                  Сервер
                </span>
                <span className="font-medium text-[var(--foreground)]">Не выбран</span>
              </div>
              <ButtonLink href={signInHref} variant="secondary">
                Войти
              </ButtonLink>
            </>
          )}
        </div>
      </div>

      <PrimaryNav
        currentPath={context.currentPath}
        documentsHref={context.navigation.documentsHref}
        lawyerWorkspaceHref={context.navigation.lawyerWorkspaceHref}
      />
    </Card>
  );
}
