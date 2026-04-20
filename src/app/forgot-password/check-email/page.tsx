import { redirect } from "next/navigation";

import { CheckEmailCard } from "@/components/product/auth/check-email-card";
import { PageContainer } from "@/components/ui/page-container";
import { getCurrentUser } from "@/server/auth/helpers";

export default async function ForgotPasswordCheckEmailPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/app");
  }

  return (
    <PageContainer>
      <main className="flex min-h-screen items-center justify-center px-6 py-16">
        <CheckEmailCard flow="recovery" />
      </main>
    </PageContainer>
  );
}
