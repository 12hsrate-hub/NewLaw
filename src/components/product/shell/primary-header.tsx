import Link from "next/link";

import { signOutAction } from "@/server/actions/auth";
import type { PrimaryShellContext } from "@/server/primary-shell/context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PrimaryNav } from "@/components/product/shell/primary-nav";
import { PrimaryServerSwitcher } from "@/components/product/shell/primary-server-switcher";

type PrimaryHeaderProps = {
  context: PrimaryShellContext;
};

const secondaryLinkClass =
  "inline-flex items-center justify-center rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-white";

export function PrimaryHeader({ context }: PrimaryHeaderProps) {
  const signInHref = `/sign-in?next=${encodeURIComponent(context.currentPath)}`;
  const viewerLabel = context.viewer.accountLogin ?? context.viewer.accountEmail ?? "аккаунт";

  return (
    <Card className="space-y-4">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <Link
            className="inline-flex items-center gap-3 rounded-2xl text-[var(--foreground)] transition hover:opacity-90"
            href="/"
          >
            <span className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Lawyer5RP</span>
            <span className="text-2xl font-semibold">Lawyer5RP</span>
          </Link>

          <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
            Главная, юридический помощник, серверы и настройки аккаунта доступны из общей
            навигации.
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

        <div className="flex flex-col items-start gap-3 lg:items-end">
          {context.viewer.isAuthenticated ? (
            <>
              <p className="text-sm leading-6 text-[var(--muted)]">
                Вы вошли как{" "}
                <span className="font-medium text-[var(--foreground)]">{viewerLabel}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {context.navigation.internalHref ? (
                  <Link className={secondaryLinkClass} href={context.navigation.internalHref}>
                    Служебная зона
                  </Link>
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
              <Link className={secondaryLinkClass} href={signInHref}>
                Войти
              </Link>
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
