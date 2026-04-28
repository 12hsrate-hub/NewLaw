import type { ReactNode } from "react";

import { ButtonLink } from "@/components/ui/button-link";
import { PanelCard } from "@/components/ui/panel-card";
import { cn } from "@/utils/cn";

type EmptyStateAction = {
  href: string;
  label: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

type EmptyStateProps = {
  title: string;
  description: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  icon?: ReactNode;
  className?: string;
};

export function EmptyState({
  action,
  className,
  description,
  icon,
  secondaryAction,
  title,
}: EmptyStateProps) {
  return (
    <PanelCard className={cn("space-y-4", className)}>
      {icon ? <div className="text-[var(--accent)]">{icon}</div> : null}
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">{title}</h2>
        <p className="text-sm leading-6 text-[var(--muted)]">{description}</p>
      </div>
      {action || secondaryAction ? (
        <div className="flex flex-wrap gap-3">
          {action ? (
            <ButtonLink href={action.href} variant={action.variant ?? "primary"}>
              {action.label}
            </ButtonLink>
          ) : null}
          {secondaryAction ? (
            <ButtonLink href={secondaryAction.href} variant={secondaryAction.variant ?? "secondary"}>
              {secondaryAction.label}
            </ButtonLink>
          ) : null}
        </div>
      ) : null}
    </PanelCard>
  );
}
