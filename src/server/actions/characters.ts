"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";

import {
  type CharacterAccessFlagKey,
  characterAccessFlagKeySchema,
  characterAccessFlagSelectionSchema,
  characterFormSchema,
  characterProfileFormSchema,
  type CharacterRoleKey,
  characterRoleKeySchema,
  characterRoleSelectionSchema,
  type CharacterSelectionBehavior,
  characterSelectionBehaviorSchema,
} from "@/schemas/character";
import { countCharactersByServer } from "@/db/repositories/character.repository";
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
import { setInitialDefaultCharacterIfMissing } from "@/db/repositories/user-server-state.repository";

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

function readCharacterFormFields(formData: FormData) {
  return characterFormSchema.parse({
    fullName: String(formData.get("fullName") ?? ""),
    passportNumber: String(formData.get("passportNumber") ?? ""),
  });
}

function readRoleKeys(formData: FormData): CharacterRoleKey[] {
  return characterRoleSelectionSchema.parse(
    formData
      .getAll("roleKeys")
      .map((value) => String(value))
      .filter(Boolean)
      .map((value) => characterRoleKeySchema.parse(value)),
  );
}

function readAccessFlags(formData: FormData): CharacterAccessFlagKey[] {
  return characterAccessFlagSelectionSchema.parse(
    formData
      .getAll("accessFlags")
      .map((value) => String(value))
      .filter(Boolean)
      .map((value) => characterAccessFlagKeySchema.parse(value)),
  );
}

function readProfileDetails(formData: FormData) {
  return characterProfileFormSchema.parse({
    isProfileComplete: formData.get("isProfileComplete") === "on",
    profileSignature: String(formData.get("profileSignature") ?? ""),
    profileNote: String(formData.get("profileNote") ?? ""),
  });
}

function buildProfileDataJson(input: {
  profileSignature: string;
  profileNote: string;
}) {
  const profileDataJson = {
    signature: input.profileSignature.trim(),
    note: input.profileNote.trim(),
  };

  return Object.values(profileDataJson).some((value) => value.length > 0)
    ? profileDataJson
    : null;
}

function readSelectionBehavior(formData: FormData): CharacterSelectionBehavior {
  return characterSelectionBehaviorSchema.parse(String(formData.get("selectionBehavior") ?? "app_shell"));
}

async function handlePostCreateSelection(input: {
  accountId: string;
  serverId: string;
  characterId: string;
  selectionBehavior: CharacterSelectionBehavior;
}) {
  if (input.selectionBehavior === "app_shell") {
    await setActiveServerSelection(input.accountId, {
      serverId: input.serverId,
    });
    await setActiveCharacterSelection(input.accountId, {
      serverId: input.serverId,
      characterId: input.characterId,
    });

    return;
  }

  const characterCount = await countCharactersByServer({
    accountId: input.accountId,
    serverId: input.serverId,
  });

  if (characterCount === 1) {
    await setInitialDefaultCharacterIfMissing({
      accountId: input.accountId,
      serverId: input.serverId,
      characterId: input.characterId,
    });
  }
}

function revalidateCharacterRoutes(redirectTo: string) {
  revalidatePath("/app");
  revalidatePath("/account");
  revalidatePath("/account/characters");
  revalidatePath(redirectTo);
}

export async function createCharacterAction(formData: FormData) {
  const redirectTo = getRedirectTarget(formData);
  const { account } = await requireProtectedAccountContext(redirectTo);

  try {
    const serverId = String(formData.get("serverId") ?? "");
    const characterFormFields = readCharacterFormFields(formData);
    const profileDetails = readProfileDetails(formData);
    const selectionBehavior = readSelectionBehavior(formData);
    const createdCharacter = await createCharacterManually({
      accountId: account.id,
      serverId,
      fullName: characterFormFields.fullName,
      passportNumber: characterFormFields.passportNumber,
      roleKeys: readRoleKeys(formData),
      accessFlags: readAccessFlags(formData),
      isProfileComplete: profileDetails.isProfileComplete,
      profileDataJson: buildProfileDataJson(profileDetails),
    });

    await handlePostCreateSelection({
      accountId: account.id,
      serverId,
      characterId: createdCharacter.id,
      selectionBehavior,
    });

    revalidateCharacterRoutes(redirectTo);
    redirect(buildStatusRedirect(redirectTo, "character-created"));
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

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
    const characterFormFields = readCharacterFormFields(formData);
    const profileDetails = readProfileDetails(formData);

    await updateCharacterManually({
      accountId: account.id,
      serverId,
      characterId,
      fullName: characterFormFields.fullName,
      passportNumber: characterFormFields.passportNumber,
      roleKeys: readRoleKeys(formData),
      accessFlags: readAccessFlags(formData),
      isProfileComplete: profileDetails.isProfileComplete,
      profileDataJson: buildProfileDataJson(profileDetails),
    });

    revalidateCharacterRoutes(redirectTo);
    redirect(buildStatusRedirect(redirectTo, "character-updated"));
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    if (error instanceof CharacterNotFoundError) {
      redirect(buildStatusRedirect(redirectTo, "character-not-found"));
    }

    if (error instanceof CharacterPassportConflictError) {
      redirect(buildStatusRedirect(redirectTo, "passport-conflict"));
    }

    redirect(buildStatusRedirect(redirectTo, "character-update-error"));
  }
}
