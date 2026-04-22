import { redirect } from "next/navigation";

import { requireSuperAdminAccountContext } from "@/server/auth/protected";

export default async function AdminLawsPage() {
  await requireSuperAdminAccountContext("/app/admin-laws");

  redirect("/internal/laws");
}
