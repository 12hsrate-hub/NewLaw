import type { ReactNode } from "react";

import type { PrimaryShellContext } from "@/server/primary-shell/context";
import { PrimaryHeader } from "@/components/product/shell/primary-header";

type PrimaryShellProps = Readonly<{
  children: ReactNode;
  context: PrimaryShellContext;
}>;

export function PrimaryShell({ children, context }: PrimaryShellProps) {
  return (
    <div className="min-h-screen">
      <div className="px-6 pt-6">
        <div className="mx-auto w-full max-w-6xl">
          <PrimaryHeader context={context} />
        </div>
      </div>
      {children}
    </div>
  );
}
