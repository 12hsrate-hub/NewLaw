import type { ComponentPropsWithoutRef, PropsWithChildren } from "react";

import Link, { type LinkProps } from "next/link";

import { cn } from "@/utils/cn";

type ButtonLinkProps = PropsWithChildren<
  LinkProps &
    Omit<ComponentPropsWithoutRef<"a">, "href"> & {
      variant?: "primary" | "secondary" | "ghost" | "danger";
      fullWidth?: boolean;
    }
>;

export function ButtonLink({
  children,
  className,
  fullWidth = false,
  variant = "primary",
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={cn(
        "inline-flex items-center justify-center rounded-2xl border px-4 py-2.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]",
        fullWidth && "w-full",
        variant === "primary" &&
          "border-[var(--button-primary-border)] bg-[var(--button-primary-bg)] text-[var(--button-primary-fg)] hover:bg-[var(--button-primary-hover)]",
        variant === "secondary" &&
          "border-[var(--button-secondary-border)] bg-[var(--button-secondary-bg)] text-[var(--button-secondary-fg)] hover:bg-[var(--button-secondary-hover)]",
        variant === "ghost" &&
          "border-transparent bg-transparent text-[var(--foreground)] hover:bg-[var(--surface-subtle)]",
        variant === "danger" &&
          "border-[var(--button-danger-border)] bg-[var(--button-danger-bg)] text-[var(--button-danger-fg)] hover:bg-[var(--button-danger-hover)]",
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
