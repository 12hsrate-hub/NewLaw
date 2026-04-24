import { createAuditLog } from "@/db/repositories/audit-log.repository";
import { getAccountById } from "@/db/repositories/account.repository";
import {
  getCharacterById,
  replaceCharacterAssignments,
} from "@/db/repositories/character.repository";
import {
  adminCharacterAssignmentInputSchema,
  type AdminCharacterAssignmentInput,
} from "@/schemas/character";

type AdminCharacterAccessDependencies = {
  getAccountById: typeof getAccountById;
  getCharacterById: typeof getCharacterById;
  replaceCharacterAssignments: typeof replaceCharacterAssignments;
  createAuditLog: typeof createAuditLog;
};

const defaultDependencies: AdminCharacterAccessDependencies = {
  getAccountById,
  getCharacterById,
  replaceCharacterAssignments,
  createAuditLog,
};

type AdminCharacterAccessFailureResult =
  | {
      status: "forbidden";
      message: string;
    }
  | {
      status: "error";
      message: string;
    };

export type AdminCharacterAssignmentResult =
  | {
      status: "success";
      character: Awaited<ReturnType<typeof replaceCharacterAssignments>>;
    }
  | AdminCharacterAccessFailureResult;

async function writeFailureAuditLog(
  dependencies: AdminCharacterAccessDependencies,
  input: {
    actorAccountId?: string | null;
    targetAccountId?: string | null;
    comment: string;
    metadataJson: Record<string, unknown>;
  },
) {
  await dependencies.createAuditLog({
    actionKey: "character_role_assignment_changed_admin",
    status: "failure",
    actorAccountId: input.actorAccountId ?? null,
    targetAccountId: input.targetAccountId ?? null,
    comment: input.comment,
    metadataJson: input.metadataJson,
  });
}

export async function assignCharacterRolesAndAccessFlagsAsAdmin(
  input: AdminCharacterAssignmentInput,
  dependencies: AdminCharacterAccessDependencies = defaultDependencies,
): Promise<AdminCharacterAssignmentResult> {
  const parsed = adminCharacterAssignmentInputSchema.parse(input);
  const nextRoleKeys = [...new Set(parsed.roleKeys)];
  const nextAccessFlags = [...new Set(parsed.accessFlags)];
  const actor = await dependencies.getAccountById(parsed.actorAccountId);

  if (!actor?.isSuperAdmin) {
    await writeFailureAuditLog(dependencies, {
      actorAccountId: actor?.id ?? parsed.actorAccountId,
      comment: parsed.comment,
      metadataJson: {
        flow: "admin_character_assignment",
        reason: "access_denied",
        characterId: parsed.characterId,
      },
    });

    return {
      status: "forbidden",
      message: "Только super_admin может изменять роли и доступы персонажа.",
    };
  }

  const targetCharacter = await dependencies.getCharacterById(parsed.characterId);

  if (!targetCharacter) {
    await writeFailureAuditLog(dependencies, {
      actorAccountId: actor.id,
      comment: parsed.comment,
      metadataJson: {
        flow: "admin_character_assignment",
        reason: "character_not_found",
        characterId: parsed.characterId,
      },
    });

    return {
      status: "error",
      message: "Не удалось найти персонажа для изменения ролей и доступов.",
    };
  }

  const updatedCharacter = await dependencies.replaceCharacterAssignments({
    characterId: parsed.characterId,
    roleKeys: nextRoleKeys,
    accessFlags: nextAccessFlags,
  });

  await dependencies.createAuditLog({
    actionKey: "character_role_assignment_changed_admin",
    status: "success",
    actorAccountId: actor.id,
    targetAccountId: targetCharacter.accountId,
    comment: parsed.comment,
    metadataJson: {
      flow: "admin_character_assignment",
      characterId: targetCharacter.id,
      serverId: targetCharacter.serverId,
      previousRoleKeys: targetCharacter.roles.map(
        (role: (typeof targetCharacter.roles)[number]) => role.roleKey,
      ),
      previousAccessFlags: targetCharacter.accessFlags.map(
        (flag: (typeof targetCharacter.accessFlags)[number]) => flag.flagKey,
      ),
      nextRoleKeys: updatedCharacter.roles.map(
        (role: (typeof updatedCharacter.roles)[number]) => role.roleKey,
      ),
      nextAccessFlags: updatedCharacter.accessFlags.map(
        (flag: (typeof updatedCharacter.accessFlags)[number]) => flag.flagKey,
      ),
    },
  });

  return {
    status: "success",
    character: updatedCharacter,
  };
}
