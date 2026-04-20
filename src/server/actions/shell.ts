"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";

import { getAppShellContext } from "@/server/app-shell/context";
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
    revalidatePath(redirectTo);
    revalidatePath("/app");
    redirect(redirectTo);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    if (error instanceof ActiveServerNotFoundError) {
      redirect(buildStatusRedirect(redirectTo, "server-not-found"));
    }

    redirect(buildStatusRedirect(redirectTo, "server-selection-error"));
  }
}

export async function selectActiveCharacterAction(formData: FormData) {
  const redirectTo = getRedirectTarget(formData);
  const shellContext = await getAppShellContext(redirectTo);

  try {
    const submittedServerId = String(formData.get("serverId") ?? "");
    const input: CharacterSelectionInput = {
      serverId: submittedServerId,
      characterId: String(formData.get("characterId") ?? ""),
    };

    if (!shellContext.activeServer?.id || submittedServerId !== shellContext.activeServer.id) {
      redirect(buildStatusRedirect(redirectTo, "character-selection-error"));
    }

    await setActiveCharacterSelection(
      shellContext.account.id,
      characterSelectionSchema.parse({
        serverId: shellContext.activeServer.id,
        characterId: input.characterId,
      }),
    );
    revalidatePath(redirectTo);
    revalidatePath("/app");
    redirect(redirectTo);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    if (error instanceof ActiveCharacterSelectionError) {
      redirect(buildStatusRedirect(redirectTo, "character-selection-error"));
    }

    redirect(buildStatusRedirect(redirectTo, "character-selection-error"));
  }
}
