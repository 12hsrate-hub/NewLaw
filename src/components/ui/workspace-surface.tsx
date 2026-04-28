import type { PropsWithChildren } from "react";

import { cn } from "@/utils/cn";

type WorkspaceSurfaceProps = PropsWithChildren<{
  className?: string;
}>;

export function WorkspaceSurface({ children, className }: WorkspaceSurfaceProps) {
  return (
    <section
      className={cn(
        "rounded-[2rem] border border-[var(--divider)] bg-[var(--surface-raised)] p-6 text-[var(--foreground)] shadow-[var(--shadow-soft)] backdrop-blur",
        className,
      )}
    >
      {children}
    </section>
  );
}
