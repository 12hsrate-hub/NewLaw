"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  type ActiveServerSelectionInput,
  activeServerSelectionSchema,
} from "@/schemas/server";
import {
  type CharacterSelectionInput,
  characterSelectionSchema,
} from "@/schemas/character";
import {
  ActiveServerNotFoundError,
  setActiveCharacterSelection,
  setActiveServerSelection,
} from "@/server/app-shell/selection";
import { ActiveCharacterSelectionError } from "@/server/app-shell/state";
import { requireProtectedAccountContext } from "@/server/auth/protected";

function getRedirectTarget(formData: FormData) {
  const redirectTo = formData.get("redirectTo");

  if (typeof redirectTo === "string" && redirectTo.startsWith("/")) {
    return redirectTo;
  }

  return "/app";
}

function buildStatusRedirect(path: string, status: string) {
  const [pathname, queryString] = path.split("?");
  const params = new URLSearchParams(queryString ?? "");

  params.set("status", status);

  const nextQuery = params.toString();

  return nextQuery ? `${pathname}?${nextQuery}` : pathname;
}

export async function selectActiveServerAction(formData: FormData) {
  const redirectTo = getRedirectTarget(formData);
  const { account } = await requireProtectedAccountContext(redirectTo);

  try {
    const input: ActiveServerSelectionInput = {
      serverId: String(formData.get("serverId") ?? ""),
    };

    await setActiveServerSelection(account.id, activeServerSelectionSchema.parse(input));
    revalidatePath("/app");
    redirect(redirectTo);
  } catch (error) {
    if (error instanceof ActiveServerNotFoundError) {
      redirect(buildStatusRedirect(redirectTo, "server-not-found"));
    }

    redirect(buildStatusRedirect(redirectTo, "server-selection-error"));
  }
}

export async function selectActiveCharacterAction(formData: FormData) {
  const redirectTo = getRedirectTarget(formData);
  const { account } = await requireProtectedAccountContext(redirectTo);

  try {
    const input: CharacterSelectionInput = {
      serverId: String(formData.get("serverId") ?? ""),
      characterId: String(formData.get("characterId") ?? ""),
    };

    await setActiveCharacterSelection(account.id, characterSelectionSchema.parse(input));
    revalidatePath("/app");
    redirect(redirectTo);
  } catch (error) {
    if (error instanceof ActiveCharacterSelectionError) {
      redirect(buildStatusRedirect(redirectTo, "character-selection-error"));
    }

    redirect(buildStatusRedirect(redirectTo, "character-selection-error"));
  }
}
