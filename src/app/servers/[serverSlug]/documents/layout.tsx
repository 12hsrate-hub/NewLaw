import type { ReactNode } from "react";

import { PageContainer } from "@/components/ui/page-container";

type ServerDocumentsLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function ServerDocumentsLayout({ children }: ServerDocumentsLayoutProps) {
  return (
    <PageContainer>
      <main className="min-h-screen px-6 py-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">{children}</div>
      </main>
    </PageContainer>
  );
}
