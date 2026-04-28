import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

import { cn } from "@/utils/cn";

type IconButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    label: string;
    variant?: "secondary" | "ghost" | "danger";
    size?: "sm" | "md";
  }
>;

export function IconButton({
  children,
  className,
  disabled = false,
  label,
  size = "md",
  type = "button",
  variant = "secondary",
  ...props
}: IconButtonProps) {
  return (
    <button
      aria-label={label}
      className={cn(
        "inline-flex items-center justify-center rounded-2xl border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-60",
        size === "sm" ? "h-9 w-9" : "h-11 w-11",
        variant === "secondary" &&
          "border-[var(--button-secondary-border)] bg-[var(--button-secondary-bg)] text-[var(--button-secondary-fg)] hover:bg-[var(--button-secondary-hover)]",
        variant === "ghost" &&
          "border-transparent bg-transparent text-[var(--foreground)] hover:bg-[var(--surface-subtle)]",
        variant === "danger" &&
          "border-[var(--button-danger-border)] bg-[var(--button-danger-bg)] text-[var(--button-danger-fg)] hover:bg-[var(--button-danger-hover)]",
        className,
      )}
      disabled={disabled}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
