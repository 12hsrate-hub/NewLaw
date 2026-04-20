import type { PropsWithChildren } from "react";

type PageContainerProps = PropsWithChildren;

export function PageContainer({ children }: PageContainerProps) {
  return <div className="min-h-screen">{children}</div>;
}
