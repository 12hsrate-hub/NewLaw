import type { PropsWithChildren } from "react";

import { cn } from "@/utils/cn";

type PanelCardProps = PropsWithChildren<{
  className?: string;
}>;

export function PanelCard({ children, className }: PanelCardProps) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-[var(--divider)] bg-[var(--surface-embedded)] p-5 text-[var(--foreground)] shadow-[0_10px_28px_rgba(0,0,0,0.12)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
