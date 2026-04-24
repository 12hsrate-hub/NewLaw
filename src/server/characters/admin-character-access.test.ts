import { describe, expect, it, vi } from "vitest";

import { assignCharacterRolesAndAccessFlagsAsAdmin } from "@/server/characters/admin-character-access";

function createDependencies() {
  return {
    getAccountById: vi.fn(),
    getCharacterById: vi.fn(),
    replaceCharacterAssignments: vi.fn(),
    createAuditLog: vi.fn().mockResolvedValue(undefined),
  };
}

describe("assignCharacterRolesAndAccessFlagsAsAdmin", () => {
  it("доступен только super_admin и пишет failure audit log", async () => {
    const dependencies = createDependencies();
    const actorAccountId = "11111111-1111-1111-1111-111111111111";

    dependencies.getAccountById.mockResolvedValue({
      id: actorAccountId,
      isSuperAdmin: false,
    });

    const result = await assignCharacterRolesAndAccessFlagsAsAdmin(
      {
        actorAccountId,
        characterId: "character-1",
        roleKeys: ["lawyer"],
        accessFlags: ["advocate"],
        comment: "Manual grant",
      },
      dependencies as never,
    );

    expect(result).toEqual({
      status: "forbidden",
      message: "Только super_admin может изменять роли и доступы персонажа.",
    });
    expect(dependencies.replaceCharacterAssignments).not.toHaveBeenCalled();
    expect(dependencies.createAuditLog).toHaveBeenCalledWith({
      actionKey: "character_role_assignment_changed_admin",
      status: "failure",
      actorAccountId,
      targetAccountId: null,
      comment: "Manual grant",
      metadataJson: {
        flow: "admin_character_assignment",
        reason: "access_denied",
        characterId: "character-1",
      },
    });
  });

  it("не меняет назначения, если персонаж не найден, и пишет failure audit log", async () => {
    const dependencies = createDependencies();
    const actorAccountId = "22222222-2222-2222-2222-222222222222";

    dependencies.getAccountById.mockResolvedValue({
      id: actorAccountId,
      isSuperAdmin: true,
    });
    dependencies.getCharacterById.mockResolvedValue(null);

    const result = await assignCharacterRolesAndAccessFlagsAsAdmin(
      {
        actorAccountId,
        characterId: "character-missing",
        roleKeys: ["lawyer"],
        accessFlags: ["advocate"],
        comment: "Missing character check",
      },
      dependencies as never,
    );

    expect(result).toEqual({
      status: "error",
      message: "Не удалось найти персонажа для изменения ролей и доступов.",
    });
    expect(dependencies.replaceCharacterAssignments).not.toHaveBeenCalled();
    expect(dependencies.createAuditLog).toHaveBeenCalledWith({
      actionKey: "character_role_assignment_changed_admin",
      status: "failure",
      actorAccountId,
      targetAccountId: null,
      comment: "Missing character check",
      metadataJson: {
        flow: "admin_character_assignment",
        reason: "character_not_found",
        characterId: "character-missing",
      },
    });
  });

  it("меняет роли и доступы через отдельный admin-only сервис и пишет success audit log", async () => {
    const dependencies = createDependencies();
    const actorAccountId = "33333333-3333-3333-3333-333333333333";

    dependencies.getAccountById.mockResolvedValue({
      id: actorAccountId,
      isSuperAdmin: true,
    });
    dependencies.getCharacterById.mockResolvedValue({
      id: "character-1",
      accountId: "owner-1",
      serverId: "server-1",
      roles: [{ roleKey: "citizen" }],
      accessFlags: [],
    });
    dependencies.replaceCharacterAssignments.mockResolvedValue({
      id: "character-1",
      accountId: "owner-1",
      serverId: "server-1",
      roles: [{ roleKey: "lawyer" }],
      accessFlags: [{ flagKey: "advocate" }],
    });

    const result = await assignCharacterRolesAndAccessFlagsAsAdmin(
      {
        actorAccountId,
        characterId: "character-1",
        roleKeys: ["lawyer", "lawyer"],
        accessFlags: ["advocate", "advocate"],
        comment: "Approve advocate access",
      },
      dependencies as never,
    );

    expect(result).toEqual({
      status: "success",
      character: {
        id: "character-1",
        accountId: "owner-1",
        serverId: "server-1",
        roles: [{ roleKey: "lawyer" }],
        accessFlags: [{ flagKey: "advocate" }],
      },
    });
    expect(dependencies.replaceCharacterAssignments).toHaveBeenCalledWith({
      characterId: "character-1",
      roleKeys: ["lawyer"],
      accessFlags: ["advocate"],
    });
    expect(dependencies.createAuditLog).toHaveBeenCalledWith({
      actionKey: "character_role_assignment_changed_admin",
      status: "success",
      actorAccountId,
      targetAccountId: "owner-1",
      comment: "Approve advocate access",
      metadataJson: {
        flow: "admin_character_assignment",
        characterId: "character-1",
        serverId: "server-1",
        previousRoleKeys: ["citizen"],
        previousAccessFlags: [],
        nextRoleKeys: ["lawyer"],
        nextAccessFlags: ["advocate"],
      },
    });
  });
});
