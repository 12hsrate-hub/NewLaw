import type { ReactNode } from "react";

import { cn } from "@/utils/cn";

type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function SectionHeader({
  actions,
  className,
  description,
  eyebrow,
  meta,
  title,
}: SectionHeaderProps) {
  return (
    <header className={cn("space-y-4", className)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          {eyebrow ? (
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">{eyebrow}</p>
          ) : null}
          <div className="space-y-3">
            <h1 className="max-w-4xl text-3xl font-semibold tracking-[-0.02em] md:text-4xl xl:text-5xl">
              {title}
            </h1>
            {description ? (
              <p className="max-w-4xl text-sm leading-7 text-[var(--muted)] md:text-base">
                {description}
              </p>
            ) : null}
          </div>
        </div>

        {actions ? <div className="flex flex-wrap gap-3 lg:justify-end">{actions}</div> : null}
      </div>

      {meta ? <div className="flex flex-wrap items-center gap-2">{meta}</div> : null}
    </header>
  );
}
