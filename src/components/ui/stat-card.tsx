import type { ReactNode } from "react";

import { PanelCard } from "@/components/ui/panel-card";
import { cn } from "@/utils/cn";

type StatCardProps = {
  label: string;
  value: string;
  helperText?: string | null;
  tone?: "neutral" | "success" | "warning" | "danger";
  icon?: ReactNode;
  className?: string;
};

export function StatCard({
  className,
  helperText,
  icon,
  label,
  tone = "neutral",
  value,
}: StatCardProps) {
  return (
    <PanelCard className={cn("space-y-3", className)}>
      <div className="flex items-start justify-between gap-3">
        <p
          className={cn(
            "text-xs uppercase tracking-[0.22em]",
            tone === "neutral" && "text-[var(--muted)]",
            tone === "success" && "text-[var(--status-success-fg)]",
            tone === "warning" && "text-[var(--status-warning-fg)]",
            tone === "danger" && "text-[var(--status-danger-fg)]",
          )}
        >
          {label}
        </p>
        {icon ? <div className="shrink-0 text-[var(--accent)]">{icon}</div> : null}
      </div>
      <p className="text-3xl font-semibold tracking-[-0.03em]">{value}</p>
      {helperText ? <p className="text-sm leading-6 text-[var(--muted)]">{helperText}</p> : null}
    </PanelCard>
  );
}
