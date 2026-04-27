import type { PropsWithChildren } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/utils/cn";

type EmbeddedCardProps = PropsWithChildren<{
  className?: string;
}>;

export function EmbeddedCard({ children, className }: EmbeddedCardProps) {
  return (
    <Card
      className={cn(
        "border-[var(--border)] bg-[var(--surface-embedded)] shadow-[0_10px_28px_rgba(0,0,0,0.12)]",
        className,
      )}
    >
      {children}
    </Card>
  );
}
