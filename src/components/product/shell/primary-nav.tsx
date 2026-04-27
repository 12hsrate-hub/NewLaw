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
  "inline-flex items-center justify-center rounded-2xl border px-4 py-2 text-sm font-medium transition";

export function PrimaryNav({
  currentPath,
  documentsHref = null,
  lawyerWorkspaceHref = null,
}: PrimaryNavProps) {
  const items = [
    { href: "/", label: "Главная" },
    { href: "/assistant", label: "Юридический помощник" },
    { href: "/servers", label: "Серверы" },
    { href: "/account", label: "Аккаунт" },
  ];

  return (
    <nav aria-label="Основная навигация" className="flex flex-wrap gap-3 border-t border-[var(--border)] pt-4">
      {items.map((item) => {
        const active = isActive(currentPath, item.href);

        return (
          <Link
            key={item.href}
            className={cn(
              baseLinkClass,
              active
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--foreground)]"
                : "border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]",
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
              ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--foreground)]"
              : "border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]",
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
              ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--foreground)]"
              : "border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]",
          )}
          href={lawyerWorkspaceHref}
        >
          Адвокатский кабинет
        </Link>
      ) : null}
    </nav>
  );
}
