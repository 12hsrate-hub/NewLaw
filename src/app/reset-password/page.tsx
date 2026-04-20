import { redirect } from "next/navigation";

import { ResetPasswordForm } from "@/components/product/auth/reset-password-form";
import { PageContainer } from "@/components/ui/page-container";
import { getCurrentSession, getCurrentUser } from "@/server/auth/helpers";
import {
  buildRecoveryInvalidPath,
  hasServerRecoveryAccess,
} from "@/server/auth/recovery";

export default async function ResetPasswordPage() {
  const hasRecoveryAccess = await hasServerRecoveryAccess({
    getCurrentSession,
    getCurrentUser,
  });

  if (!hasRecoveryAccess) {
    redirect(buildRecoveryInvalidPath());
  }

  return (
    <PageContainer>
      <main className="flex min-h-screen items-center justify-center px-6 py-16">
        <ResetPasswordForm />
      </main>
    </PageContainer>
  );
}
