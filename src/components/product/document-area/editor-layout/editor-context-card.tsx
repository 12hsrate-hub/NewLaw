import type { ReactNode } from "react";

import Link from "next/link";

import { EmbeddedCard } from "@/components/ui/embedded-card";
import { cn } from "@/utils/cn";

type EditorContextAction = {
  href: string;
  label: string;
};

export function EditorContextCard(props: {
  eyebrow?: string;
  title: string;
  description?: string;
  meta?: ReactNode;
  actions?: EditorContextAction[];
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <EmbeddedCard className={cn("space-y-4", props.className)} data-editor-context-card="true">
      <div className="space-y-2.5">
        {props.eyebrow ? (
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">
            {props.eyebrow}
          </p>
        ) : null}
        <h2 className="text-xl font-semibold text-[var(--foreground)]">{props.title}</h2>
        {props.description ? (
          <p className="text-sm leading-6 text-[var(--muted)]">{props.description}</p>
        ) : null}
      </div>

      {props.meta ? <div className="flex flex-wrap items-center gap-2">{props.meta}</div> : null}
      {props.children}

      {props.actions?.length ? (
        <div className="flex flex-wrap gap-3">
          {props.actions.map((action) => (
            <Link
              className="inline-flex items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-hover)]"
              href={action.href}
              key={`${action.href}:${action.label}`}
            >
              {action.label}
            </Link>
          ))}
        </div>
      ) : null}

      {props.footer ? <div className="text-sm leading-6 text-[var(--muted)]">{props.footer}</div> : null}
    </EmbeddedCard>
  );
}
