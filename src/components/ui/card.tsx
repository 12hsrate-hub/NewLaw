import type { PropsWithChildren } from "react";

import { cn } from "@/utils/cn";

type CardProps = PropsWithChildren<{
  className?: string;
}>;

export function Card({ children, className }: CardProps) {
  return (
    <section
      className={cn(
        "rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_24px_80px_rgba(23,33,43,0.12)] backdrop-blur",
        className,
      )}
    >
      {children}
    </section>
  );
}
