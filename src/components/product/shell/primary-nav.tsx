import Link from "next/link";

import { cn } from "@/utils/cn";

type PrimaryNavProps = {
  currentPath: string;
  documentsHref?: string | null;
  lawyerWorkspaceHref?: string | null;
};

function isActive(currentPath: string, href: string) {
  if (href === "/") {
    return currentPath === "/";
  }

  return currentPath === href || currentPath.startsWith(`${href}/`);
}

const baseLinkClass =
  "inline-flex items-center justify-center rounded-xl border px-3 py-1.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]";

export function PrimaryNav({
  currentPath,
  documentsHref = null,
  lawyerWorkspaceHref = null,
}: PrimaryNavProps) {
  const items = [
    { href: "/", label: "Главная" },
    { href: "/assistant", label: "Помощник" },
    { href: "/servers", label: "Серверы" },
    { href: "/account", label: "Аккаунт" },
  ];

  return (
    <nav
      aria-label="Основная навигация"
      className="flex flex-wrap gap-2 border-t border-[var(--divider)] pt-3"
    >
      {items.map((item) => {
        const active = isActive(currentPath, item.href);

        return (
          <Link
            key={item.href}
            className={cn(
              baseLinkClass,
              active
                ? "border-[var(--button-primary-border)] bg-[var(--accent-soft-strong)] text-[var(--foreground)]"
                : "border-[var(--button-secondary-border)] bg-[var(--button-secondary-bg)] text-[var(--button-secondary-fg)] hover:bg-[var(--button-secondary-hover)]",
            )}
            href={item.href}
          >
            {item.label}
          </Link>
        );
      })}

      {documentsHref ? (
        <Link
          className={cn(
            baseLinkClass,
            isActive(currentPath, documentsHref)
              ? "border-[var(--button-primary-border)] bg-[var(--accent-soft-strong)] text-[var(--foreground)]"
              : "border-[var(--button-secondary-border)] bg-[var(--button-secondary-bg)] text-[var(--button-secondary-fg)] hover:bg-[var(--button-secondary-hover)]",
          )}
          href={documentsHref}
        >
          Документы
        </Link>
      ) : null}

      {lawyerWorkspaceHref ? (
        <Link
          className={cn(
            baseLinkClass,
            isActive(currentPath, lawyerWorkspaceHref)
              ? "border-[var(--button-primary-border)] bg-[var(--accent-soft-strong)] text-[var(--foreground)]"
              : "border-[var(--button-secondary-border)] bg-[var(--button-secondary-bg)] text-[var(--button-secondary-fg)] hover:bg-[var(--button-secondary-hover)]",
          )}
          href={lawyerWorkspaceHref}
        >
          Кабинет
        </Link>
      ) : null}
    </nav>
  );
}
