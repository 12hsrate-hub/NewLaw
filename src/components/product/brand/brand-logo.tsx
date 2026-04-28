import { BrandMark } from "@/components/product/brand/brand-mark";
import { cn } from "@/utils/cn";

const markSizeMap = {
  sm: "sm",
  md: "md",
  lg: "lg",
} as const;

const textSizeClassNameMap = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-2xl",
} as const;

type BrandLogoProps = {
  variant?: "compact" | "full";
  size?: keyof typeof textSizeClassNameMap;
  className?: string;
};

export function BrandLogo({
  className,
  size = "md",
  variant = "full",
}: BrandLogoProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center text-[var(--foreground)]",
        variant === "compact" ? "gap-2.5" : "gap-3",
        className,
      )}
      data-size={size}
      data-variant={variant}
    >
      <BrandMark size={markSizeMap[size]} />
      <span
        className={cn(
          "inline-flex items-baseline font-semibold tracking-[-0.03em]",
          textSizeClassNameMap[size],
          variant === "compact" ? "gap-0" : "gap-0.5",
        )}
      >
        <span>Lawyer</span>
        <span className="text-[var(--accent)]">5</span>
        <span>RP</span>
      </span>
    </div>
  );
}
