import type { ReactNode } from "react";

import { ButtonLink } from "@/components/ui/button-link";
import { PanelCard } from "@/components/ui/panel-card";
import { cn } from "@/utils/cn";

type QuickActionCardProps = {
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  icon?: ReactNode;
  tone?: "primary" | "secondary";
  className?: string;
};

export function QuickActionCard({
  actionLabel,
  className,
  description,
  href,
  icon,
  title,
  tone = "secondary",
}: QuickActionCardProps) {
  return (
    <PanelCard className={cn("space-y-4", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="text-sm leading-6 text-[var(--muted)]">{description}</p>
        </div>
        {icon ? <div className="shrink-0 text-[var(--accent)]">{icon}</div> : null}
      </div>
      <ButtonLink href={href} variant={tone === "primary" ? "primary" : "secondary"}>
        {actionLabel}
      </ButtonLink>
    </PanelCard>
  );
}
