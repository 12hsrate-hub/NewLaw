import type { ReactNode } from "react";

import { PageContainer } from "@/components/ui/page-container";

type ServerDocumentsLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function ServerDocumentsLayout({ children }: ServerDocumentsLayoutProps) {
  return (
    <PageContainer as="main" contentClassName="flex flex-col gap-6" variant="wide">
      {children}
    </PageContainer>
  );
}
