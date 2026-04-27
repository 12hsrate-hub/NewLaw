import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

import { cn } from "@/utils/cn";

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary" | "ghost";
    fullWidth?: boolean;
  }
>;

export function Button({
  children,
  className,
  fullWidth = false,
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60",
        fullWidth && "w-full",
        variant === "primary" &&
          "bg-[var(--accent)] text-[var(--accent-foreground)] shadow-[0_12px_32px_rgba(0,0,0,0.18)] hover:bg-[var(--accent-strong)]",
        variant === "secondary" &&
          "border border-[var(--border)] bg-[var(--surface-embedded)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]",
        variant === "ghost" &&
          "text-[var(--foreground)] hover:bg-[var(--surface-subtle)]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
