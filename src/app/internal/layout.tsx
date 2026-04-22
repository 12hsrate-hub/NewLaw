import type { ReactNode } from "react";

import { InternalLayout } from "@/components/product/internal/internal-shell";

type InternalLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function InternalRouteLayout({ children }: InternalLayoutProps) {
  return <InternalLayout>{children}</InternalLayout>;
}
