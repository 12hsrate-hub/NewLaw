import type { TextareaHTMLAttributes } from "react";

import { cn } from "@/utils/cn";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        "min-h-32 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-input)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:bg-[var(--surface-hover)]",
        className,
      )}
      {...props}
    />
  );
}
