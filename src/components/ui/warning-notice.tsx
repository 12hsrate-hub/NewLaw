import { cn } from "@/utils/cn";

type WarningNoticeProps = {
  title?: string;
  description: string;
  tone?: "warning" | "danger";
  className?: string;
};

export function WarningNotice({
  className,
  description,
  title,
  tone = "warning",
}: WarningNoticeProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-3xl border p-4",
        tone === "warning" &&
          "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-fg)]",
        tone === "danger" &&
          "border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-fg)]",
        className,
      )}
      role="status"
    >
      <svg
        aria-hidden="true"
        className="mt-0.5 h-5 w-5 shrink-0"
        fill="none"
        viewBox="0 0 20 20"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M10 3.5L17 16.5H3L10 3.5Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path d="M10 7.25V10.75" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
        <circle cx="10" cy="13.5" fill="currentColor" r="0.9" />
      </svg>
      <div className="space-y-1">
        {title ? <p className="text-sm font-semibold">{title}</p> : null}
        <p className="text-sm leading-6">{description}</p>
      </div>
    </div>
  );
}
