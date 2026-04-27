import type { ReactNode } from "react";

import type { PrimaryShellContext } from "@/server/primary-shell/context";
import { PrimaryHeader } from "@/components/product/shell/primary-header";

type PrimaryShellProps = Readonly<{
  children: ReactNode;
  context: PrimaryShellContext;
}>;

export function PrimaryShell({ children, context }: PrimaryShellProps) {
  return (
    <div className="theme-workspace min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="sticky top-0 z-40 px-6 pt-4 md:px-8 xl:px-10">
        <div className="mx-auto w-full max-w-[1440px]">
          <PrimaryHeader context={context} />
        </div>
      </div>
      {children}
    </div>
  );
}
