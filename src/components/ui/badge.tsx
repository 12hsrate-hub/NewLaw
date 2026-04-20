import type { PropsWithChildren } from "react";

import { cn } from "@/utils/cn";

type BadgeProps = PropsWithChildren<{
  className?: string;
}>;

export function Badge({ children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-[rgba(141,79,49,0.12)] px-3 py-1 text-xs font-medium text-[var(--accent)]",
        className,
      )}
    >
      {children}
    </span>
  );
}
