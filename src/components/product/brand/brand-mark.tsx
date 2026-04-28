import { cn } from "@/utils/cn";

const sizeClassNameMap = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
} as const;

type BrandMarkProps = {
  size?: keyof typeof sizeClassNameMap;
  className?: string;
};

export function BrandMark({ className, size = "md" }: BrandMarkProps) {
  return (
    <svg
      aria-hidden="true"
      className={cn("shrink-0", sizeClassNameMap[size], className)}
      data-size={size}
      fill="none"
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M24 3L39 9V22C39 31.2 33.2 39.47 24 45C14.8 39.47 9 31.2 9 22V9L24 3Z"
        fill="var(--surface-subtle)"
        stroke="var(--accent)"
        strokeWidth="2.5"
      />
      <path
        d="M19 33.5V30.5H29V33.5H19Z"
        fill="var(--foreground)"
        opacity="0.92"
      />
      <path
        d="M20.25 28.5V26.25H27.75V28.5H20.25Z"
        fill="var(--foreground)"
        opacity="0.9"
      />
      <path
        d="M21 24.25L22.8 14.5H25.2L27 24.25H21Z"
        fill="var(--accent)"
      />
      <path
        d="M19.5 14.5L24 10.5L28.5 14.5H19.5Z"
        fill="var(--accent)"
      />
      <path
        d="M18.5 24.25H29.5"
        opacity="0.5"
        stroke="var(--border)"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}
