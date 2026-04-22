import { redirect } from "next/navigation";

import { defaultAuthenticatedLandingPath } from "@/lib/auth/email-auth";
import { getCurrentUser } from "@/server/auth/helpers";

export default async function HomePage() {
  const user = await getCurrentUser();

  if (user) {
    redirect(defaultAuthenticatedLandingPath);
  }

  redirect("/sign-in");
}
