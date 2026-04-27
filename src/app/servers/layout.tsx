import type { ReactNode } from "react";

import { PrimaryShell } from "@/components/product/shell/primary-shell";
import { getPrimaryShellContext } from "@/server/primary-shell/context";

type ServersLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function ServersLayout({ children }: ServersLayoutProps) {
  const context = await getPrimaryShellContext({
    currentPath: "/servers",
  });

  return <PrimaryShell context={context}>{children}</PrimaryShell>;
}
