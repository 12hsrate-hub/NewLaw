import { redirect } from "next/navigation";

import { getCurrentUser } from "@/server/auth/helpers";

export default async function HomePage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/app");
  }

  redirect("/sign-in");
}
