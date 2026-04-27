import type { PropsWithChildren } from "react";

import { cn } from "@/utils/cn";

type CardProps = PropsWithChildren<{
  className?: string;
}>;

export function Card({ children, className }: CardProps) {
  return (
    <section
      className={cn(
        "rounded-3xl border border-[var(--border)] bg-[var(--surface-raised)] p-6 text-[var(--foreground)] shadow-[var(--shadow-soft)] backdrop-blur",
        className,
      )}
    >
      {children}
    </section>
  );
}
