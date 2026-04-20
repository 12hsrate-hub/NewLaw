"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  type CharacterAccessFlagKey,
  characterAccessFlagKeySchema,
  type CharacterRoleKey,
  characterRoleKeySchema,
} from "@/schemas/character";
import {
  CharacterLimitExceededError,
  CharacterNotFoundError,
  CharacterPassportConflictError,
  createCharacterManually,
  updateCharacterManually,
} from "@/server/characters/manual-character";
import { requireProtectedAccountContext } from "@/server/auth/protected";
import {
  setActiveCharacterSelection,
  setActiveServerSelection,
} from "@/server/app-shell/selection";

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

function readRoleKeys(formData: FormData) {
  const roleKeys = formData
    .getAll("roleKeys")
    .map((value) => String(value))
    .filter(Boolean)
    .map((value) => characterRoleKeySchema.parse(value));

  return (roleKeys.length ? roleKeys : ["citizen"]) as CharacterRoleKey[];
}

function readAccessFlags(formData: FormData) {
  return formData
    .getAll("accessFlags")
    .map((value) => String(value))
    .filter(Boolean)
    .map((value) => characterAccessFlagKeySchema.parse(value)) as CharacterAccessFlagKey[];
}

export async function createCharacterAction(formData: FormData) {
  const redirectTo = getRedirectTarget(formData);
  const { account } = await requireProtectedAccountContext(redirectTo);

  try {
    const serverId = String(formData.get("serverId") ?? "");
    const createdCharacter = await createCharacterManually({
      accountId: account.id,
      serverId,
      fullName: String(formData.get("fullName") ?? ""),
      passportNumber: String(formData.get("passportNumber") ?? ""),
      roleKeys: readRoleKeys(formData),
      accessFlags: readAccessFlags(formData),
    });

    await setActiveServerSelection(account.id, {
      serverId,
    });
    await setActiveCharacterSelection(account.id, {
      serverId,
      characterId: createdCharacter.id,
    });

    revalidatePath("/app");
    redirect(buildStatusRedirect(redirectTo, "character-created"));
  } catch (error) {
    if (error instanceof CharacterLimitExceededError) {
      redirect(buildStatusRedirect(redirectTo, "character-limit"));
    }

    if (error instanceof CharacterPassportConflictError) {
      redirect(buildStatusRedirect(redirectTo, "passport-conflict"));
    }

    redirect(buildStatusRedirect(redirectTo, "character-create-error"));
  }
}

export async function updateCharacterAction(formData: FormData) {
  const redirectTo = getRedirectTarget(formData);
  const { account } = await requireProtectedAccountContext(redirectTo);

  try {
    const serverId = String(formData.get("serverId") ?? "");
    const characterId = String(formData.get("characterId") ?? "");

    await updateCharacterManually({
      accountId: account.id,
      serverId,
      characterId,
      fullName: String(formData.get("fullName") ?? ""),
      passportNumber: String(formData.get("passportNumber") ?? ""),
      roleKeys: readRoleKeys(formData),
      accessFlags: readAccessFlags(formData),
    });

    revalidatePath("/app");
    redirect(buildStatusRedirect(redirectTo, "character-updated"));
  } catch (error) {
    if (error instanceof CharacterNotFoundError) {
      redirect(buildStatusRedirect(redirectTo, "character-not-found"));
    }

    if (error instanceof CharacterPassportConflictError) {
      redirect(buildStatusRedirect(redirectTo, "passport-conflict"));
    }

    redirect(buildStatusRedirect(redirectTo, "character-update-error"));
  }
}
