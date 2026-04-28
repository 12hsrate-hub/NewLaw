import { ButtonLink } from "@/components/ui/button-link";
import { EmbeddedCard } from "@/components/ui/embedded-card";
import { cn } from "@/utils/cn";

type ProductAction = {
  href: string;
  label: string;
};

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
        <ButtonLink href={props.primaryAction.href} variant="primary">
          {props.primaryAction.label}
        </ButtonLink>
        {props.secondaryAction ? (
          <ButtonLink href={props.secondaryAction.href} variant="secondary">
            {props.secondaryAction.label}
          </ButtonLink>
        ) : null}
      </div>
    </EmbeddedCard>
  );
}
