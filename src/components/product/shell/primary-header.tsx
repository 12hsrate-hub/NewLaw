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
    <Card className="space-y-4 border-[var(--divider)] bg-[var(--card)] px-5 py-5 shadow-[0_24px_48px_rgba(0,0,0,0.22)] backdrop-blur-xl md:px-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 space-y-3">
          <Link
            className="inline-flex max-w-fit items-center rounded-2xl text-[var(--foreground)] transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
            href="/"
          >
            <BrandLogo size="md" variant="full" />
          </Link>

          <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
            Рабочая панель проекта: сервер, документы и инструменты доступны из общей навигации.
          </p>

          {context.viewer.isAuthenticated ? (
            <PrimaryServerSwitcher
              activeServerId={context.activeServer.id}
              availableServers={context.availableServers}
            />
          ) : (
            <p className="text-sm leading-6 text-[var(--muted)]">
              Сервер:{" "}
              <span className="font-medium text-[var(--foreground)]">Сервер не выбран</span>
            </p>
          )}
        </div>

        <div className="flex w-full flex-col items-start gap-3 xl:w-auto xl:min-w-[260px] xl:items-end">
          {context.viewer.isAuthenticated ? (
            <>
              <div className="inline-flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--divider)] bg-[var(--surface-subtle)] px-3 py-2 text-sm leading-6 text-[var(--muted)]">
                <span>Аккаунт</span>
                <span className="font-medium text-[var(--foreground)]">{viewerLabel}</span>
              </div>
              <div className="flex flex-wrap gap-2">
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
              <p className="text-sm leading-6 text-[var(--muted)]">
                Для защищённых разделов понадобится вход в аккаунт.
              </p>
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
