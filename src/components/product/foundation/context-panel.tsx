import type { PropsWithChildren, ReactNode } from "react";

import { EmbeddedCard } from "@/components/ui/embedded-card";
import { cn } from "@/utils/cn";

type ContextPanelProps = PropsWithChildren<{
  eyebrow?: string;
  title: string;
  description: string;
  footer?: ReactNode;
  className?: string;
}>;

export function ContextPanel({
  children,
  className,
  description,
  eyebrow,
  footer,
  title,
}: ContextPanelProps) {
  return (
    <EmbeddedCard className={cn("space-y-4 lg:sticky lg:top-28", className)}>
      <div className="space-y-3">
        {eyebrow ? (
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">{eyebrow}</p>
        ) : null}
        <h2 className="text-2xl font-semibold">{title}</h2>
        <p className="text-sm leading-6 text-[var(--muted)]">{description}</p>
      </div>
      {children}
      {footer ? <div className="text-sm leading-6 text-[var(--muted)]">{footer}</div> : null}
    </EmbeddedCard>
  );
}
