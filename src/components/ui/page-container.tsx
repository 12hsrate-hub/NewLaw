import type { PropsWithChildren } from "react";

import { cn } from "@/utils/cn";

type PageContainerProps = PropsWithChildren<{
  variant?: "wide" | "split" | "readable" | "full";
  tone?: "workspace" | "plain";
  as?: "div" | "main";
  className?: string;
  contentClassName?: string;
}>;

const variantWidthClassMap = {
  wide: "max-w-[1440px]",
  split: "max-w-[1440px]",
  readable: "max-w-[880px]",
  full: "max-w-none",
} satisfies Record<NonNullable<PageContainerProps["variant"]>, string>;

const variantPaddingClassMap = {
  wide: "px-6 py-10 md:px-8 xl:px-10",
  split: "px-6 py-10 md:px-8 xl:px-10",
  readable: "px-6 py-10 md:px-8 xl:px-10",
  full: "",
} satisfies Record<NonNullable<PageContainerProps["variant"]>, string>;

export function PageContainer({
  as = "div",
  children,
  className,
  contentClassName,
  tone = "plain",
  variant = "full",
}: PageContainerProps) {
  const Component = as;

  return (
    <Component
      className={cn(
        "min-h-screen w-full",
        tone === "workspace" && "theme-workspace bg-[var(--background)] text-[var(--foreground)]",
        className,
      )}
      data-page-container="true"
      data-tone={tone}
      data-variant={variant}
    >
      <div
        className={cn(
          "mx-auto w-full",
          variantWidthClassMap[variant],
          variantPaddingClassMap[variant],
          contentClassName,
        )}
      >
        {children}
      </div>
    </Component>
  );
}
