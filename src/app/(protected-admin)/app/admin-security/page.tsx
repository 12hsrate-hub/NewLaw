import { redirect } from "next/navigation";

import { requireSuperAdminAccountContext } from "@/server/auth/protected";

export default async function AdminSecurityPage() {
  await requireSuperAdminAccountContext("/app/admin-security");

  redirect("/internal/security");
}
