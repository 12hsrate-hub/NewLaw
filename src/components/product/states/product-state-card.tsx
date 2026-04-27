import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type ProductStateAction = {
  href: string;
  label: string;
};

export function ProductStateCard(props: {
  eyebrow?: string;
  title: string;
  description: string;
  primaryAction?: ProductStateAction;
  secondaryAction?: ProductStateAction;
  badges?: string[];
  helperText?: string | null;
}) {
  return (
    <Card className="space-y-4">
      <div className="space-y-3">
        {props.eyebrow ? (
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
            {props.eyebrow}
          </p>
        ) : null}
        <h1 className="text-3xl font-semibold">{props.title}</h1>
        <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">{props.description}</p>
        {props.helperText ? (
          <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">{props.helperText}</p>
        ) : null}
      </div>

      {props.badges && props.badges.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-[var(--muted)]">
          {props.badges.map((badge) => (
            <Badge key={badge}>{badge}</Badge>
          ))}
        </div>
      ) : null}

      {props.primaryAction || props.secondaryAction ? (
        <div className="flex flex-wrap gap-3">
          {props.primaryAction ? (
            <Link
              className="inline-flex items-center justify-center rounded-2xl border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--accent-soft-strong)]"
              href={props.primaryAction.href}
            >
              {props.primaryAction.label}
            </Link>
          ) : null}
          {props.secondaryAction ? (
            <Link
              className="inline-flex items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-hover)]"
              href={props.secondaryAction.href}
            >
              {props.secondaryAction.label}
            </Link>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
