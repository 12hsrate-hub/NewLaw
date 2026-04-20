import type { PropsWithChildren, SelectHTMLAttributes } from "react";

import { cn } from "@/utils/cn";

type SelectProps = PropsWithChildren<SelectHTMLAttributes<HTMLSelectElement>>;

export function Select({ children, className, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        "w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:bg-white",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
