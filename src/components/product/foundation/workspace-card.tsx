import type { ReactNode } from "react";

import Link from "next/link";

import { EmbeddedCard } from "@/components/ui/embedded-card";
import { cn } from "@/utils/cn";

type WorkspaceAction = {
  href: string;
  label: string;
  tone?: "primary" | "secondary";
};

export function WorkspaceCard(props: {
  eyebrow?: string;
  title: string;
  description: string;
  helperText?: string | null;
  actions?: WorkspaceAction[];
  meta?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <EmbeddedCard className={cn("space-y-4", props.className)}>
      <div className="space-y-3">
        {props.eyebrow ? (
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">
            {props.eyebrow}
          </p>
        ) : null}
        <h2 className="text-2xl font-semibold">{props.title}</h2>
        <p className="text-sm leading-6 text-[var(--muted)]">{props.description}</p>
        {props.helperText ? (
          <p className="text-sm leading-6 text-[var(--muted)]">{props.helperText}</p>
        ) : null}
      </div>

      {props.meta ? <div className="flex flex-wrap items-center gap-2">{props.meta}</div> : null}
      {props.children}

      {props.actions?.length ? (
        <div className="flex flex-wrap gap-3">
          {props.actions.map((action) => (
            <Link
              className={cn(
                "inline-flex items-center justify-center rounded-2xl border px-4 py-2.5 text-sm font-medium transition",
                action.tone === "primary"
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--foreground)] hover:bg-[var(--accent-soft-strong)]"
                  : "border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]",
              )}
              href={action.href}
              key={`${action.href}:${action.label}`}
            >
              {action.label}
            </Link>
          ))}
        </div>
      ) : null}
    </EmbeddedCard>
  );
}
