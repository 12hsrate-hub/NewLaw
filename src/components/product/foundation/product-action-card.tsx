import Link from "next/link";

import { EmbeddedCard } from "@/components/ui/embedded-card";
import { cn } from "@/utils/cn";

type ProductAction = {
  href: string;
  label: string;
};

function ActionLink(props: ProductAction & { primary?: boolean }) {
  return (
    <Link
      className={cn(
        "inline-flex items-center justify-center rounded-2xl border px-4 py-2.5 text-sm font-medium transition",
        props.primary
          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--foreground)] hover:bg-[var(--accent-soft-strong)]"
          : "border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]",
      )}
      href={props.href}
    >
      {props.label}
    </Link>
  );
}

export function ProductActionCard(props: {
  eyebrow?: string;
  title: string;
  description: string;
  helperText?: string | null;
  primaryAction: ProductAction;
  secondaryAction?: ProductAction;
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
      <div className="flex flex-wrap gap-3">
        <ActionLink href={props.primaryAction.href} label={props.primaryAction.label} primary />
        {props.secondaryAction ? (
          <ActionLink href={props.secondaryAction.href} label={props.secondaryAction.label} />
        ) : null}
      </div>
    </EmbeddedCard>
  );
}
