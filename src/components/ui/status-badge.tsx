import type { PropsWithChildren } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils/cn";

type StatusBadgeProps = PropsWithChildren<{
  tone?: "neutral" | "success" | "warning" | "info";
  className?: string;
}>;

export function StatusBadge({
  children,
  className,
  tone = "neutral",
}: StatusBadgeProps) {
  return (
    <Badge
      className={cn(
        tone === "neutral" && "bg-[var(--surface-subtle)] text-[var(--foreground)]",
        tone === "success" && "border-[#4a8a68]/30 bg-[#4a8a68]/15 text-[#9ed8b3]",
        tone === "warning" && "border-[#b78739]/30 bg-[#b78739]/16 text-[#f0d4a0]",
        tone === "info" && "border-[#5e82ac]/30 bg-[#5e82ac]/16 text-[#b8d1eb]",
        className,
      )}
    >
      {children}
    </Badge>
  );
}
