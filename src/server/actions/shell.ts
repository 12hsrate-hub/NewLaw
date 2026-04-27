"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";

import { getServerById } from "@/db/repositories/server.repository";
import { getAppShellContext } from "@/server/app-shell/context";
import {
  getSafeServerSwitchRedirectBase,
  resolveServerSwitchRedirectTarget,
} from "@/server/actions/server-switch-resolver";
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

function getServerRedirectTarget(formData: FormData) {
  const redirectTo = formData.get("redirectTo");

  if (typeof redirectTo === "string" && redirectTo.startsWith("/")) {
    return redirectTo;
  }

  return "/servers";
}

function getCharacterRedirectTarget(formData: FormData) {
  const redirectTo = formData.get("redirectTo");

  if (typeof redirectTo === "string" && redirectTo.startsWith("/")) {
    return redirectTo;
  }

  return "/account/characters";
}

function buildStatusRedirect(path: string, status: string) {
  const [pathname, queryString] = path.split("?");
  const params = new URLSearchParams(queryString ?? "");

  params.set("status", status);

  const nextQuery = params.toString();

  return nextQuery ? `${pathname}?${nextQuery}` : pathname;
}

export async function selectActiveServerAction(formData: FormData) {
  const redirectTo = getServerRedirectTarget(formData);
  const safeRedirectBase = getSafeServerSwitchRedirectBase(redirectTo);
  const { account } = await requireProtectedAccountContext(safeRedirectBase);

  try {
    const input: ActiveServerSelectionInput = {
      serverId: String(formData.get("serverId") ?? ""),
    };
    const parsedInput = activeServerSelectionSchema.parse(input);
    const selectedServer = await getServerById(parsedInput.serverId);

    if (!selectedServer) {
      throw new ActiveServerNotFoundError();
    }

    const nextRedirectTo = resolveServerSwitchRedirectTarget({
      redirectTo: safeRedirectBase,
      selectedServerSlug: selectedServer.code,
    });

    await setActiveServerSelection(account.id, parsedInput);
    revalidatePath(safeRedirectBase);
    if (nextRedirectTo !== safeRedirectBase) {
      revalidatePath(nextRedirectTo);
    }
    revalidatePath("/app");
    redirect(nextRedirectTo);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    if (error instanceof ActiveServerNotFoundError) {
      redirect(buildStatusRedirect(safeRedirectBase, "server-not-found"));
    }

    redirect(buildStatusRedirect(safeRedirectBase, "server-selection-error"));
  }
}

export async function selectActiveCharacterAction(formData: FormData) {
  const redirectTo = getCharacterRedirectTarget(formData);
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
