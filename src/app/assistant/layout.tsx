import type { ReactNode } from "react";

import { PrimaryShell } from "@/components/product/shell/primary-shell";
import { getPrimaryShellContext } from "@/server/primary-shell/context";

type AssistantLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function AssistantLayout({ children }: AssistantLayoutProps) {
  const context = await getPrimaryShellContext({
    currentPath: "/assistant",
  });

  return <PrimaryShell context={context}>{children}</PrimaryShell>;
}
