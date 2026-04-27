import type { PropsWithChildren } from "react";

import { cn } from "@/utils/cn";

type BadgeProps = PropsWithChildren<{
  className?: string;
}>;

export function Badge({ children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--accent-soft)] px-3 py-1 text-xs font-medium text-[var(--accent)]",
        className,
      )}
    >
      {children}
    </span>
  );
}
