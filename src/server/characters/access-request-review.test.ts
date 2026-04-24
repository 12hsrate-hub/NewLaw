import { describe, expect, it, vi } from "vitest";

import {
  approveCharacterAccessRequestAsAdmin,
  rejectCharacterAccessRequestAsAdmin,
} from "@/server/characters/access-request-review";

function createDependencies() {
  return {
    getAccountById: vi.fn(),
    getCharacterAccessRequestById: vi.fn(),
    reviewCharacterAccessRequestRecord: vi.fn(),
    grantCharacterAssignments: vi.fn(),
    createAuditLog: vi.fn().mockResolvedValue(undefined),
    now: vi.fn(() => new Date("2026-04-24T12:00:00.000Z")),
    runTransaction: vi.fn(async (callback) => callback({})),
  };
}

describe("approveCharacterAccessRequestAsAdmin", () => {
  it("доступен только super_admin", async () => {
    const dependencies = createDependencies();

    dependencies.getAccountById.mockResolvedValue({
      id: "11111111-1111-1111-1111-111111111111",
      isSuperAdmin: false,
    });

    const result = await approveCharacterAccessRequestAsAdmin(
      {
        actorAccountId: "11111111-1111-1111-1111-111111111111",
        requestId: "request-1",
        reviewComment: "Нет доступа",
      },
      dependencies as never,
    );

    expect(result).toEqual({
      status: "forbidden",
      message: "Только super_admin может рассматривать заявки на доступ.",
    });
    expect(dependencies.grantCharacterAssignments).not.toHaveBeenCalled();
  });

  it("не даёт владельцу персонажа одобрить свою заявку", async () => {
    const dependencies = createDependencies();

    dependencies.getAccountById.mockResolvedValue({
      id: "11111111-1111-1111-1111-111111111111",
      isSuperAdmin: true,
    });
    dependencies.getCharacterAccessRequestById.mockResolvedValue({
      id: "request-1",
      accountId: "11111111-1111-1111-1111-111111111111",
      serverId: "server-1",
      characterId: "character-1",
      requestType: "advocate_access",
      status: "pending",
      character: {
        id: "character-1",
        deletedAt: null,
      },
    });

    const result = await approveCharacterAccessRequestAsAdmin(
      {
        actorAccountId: "11111111-1111-1111-1111-111111111111",
        requestId: "request-1",
        reviewComment: "Self review",
      },
      dependencies as never,
    );

    expect(result).toEqual({
      status: "forbidden",
      message: "Владелец персонажа не может сам одобрить или отклонить свою заявку.",
    });
    expect(dependencies.grantCharacterAssignments).not.toHaveBeenCalled();
  });

  it("approve выдаёт lawyer + advocate, review-ит заявку и пишет audit log", async () => {
    const dependencies = createDependencies();

    dependencies.getAccountById.mockResolvedValue({
      id: "22222222-2222-2222-2222-222222222222",
      isSuperAdmin: true,
    });
    dependencies.getCharacterAccessRequestById.mockResolvedValue({
      id: "request-1",
      accountId: "11111111-1111-1111-1111-111111111111",
      serverId: "server-1",
      characterId: "character-1",
      requestType: "advocate_access",
      status: "pending",
      character: {
        id: "character-1",
        deletedAt: null,
      },
    });
    dependencies.grantCharacterAssignments.mockResolvedValue(undefined);
    dependencies.reviewCharacterAccessRequestRecord.mockResolvedValue(undefined);

    const result = await approveCharacterAccessRequestAsAdmin(
      {
        actorAccountId: "22222222-2222-2222-2222-222222222222",
        requestId: "request-1",
        reviewComment: "Одобрено",
      },
      dependencies as never,
    );

    expect(result).toEqual({
      status: "success",
      requestId: "request-1",
    });
    expect(dependencies.runTransaction).toHaveBeenCalled();
    expect(dependencies.grantCharacterAssignments).toHaveBeenCalledWith(
      {
        characterId: "character-1",
        roleKeys: ["lawyer"],
        accessFlags: ["advocate"],
      },
      {},
    );
    expect(dependencies.reviewCharacterAccessRequestRecord).toHaveBeenCalledWith(
      {
        requestId: "request-1",
        status: "approved",
        reviewComment: "Одобрено",
        reviewedByAccountId: "22222222-2222-2222-2222-222222222222",
        reviewedAt: new Date("2026-04-24T12:00:00.000Z"),
      },
      {},
    );
    expect(dependencies.createAuditLog).toHaveBeenCalledWith({
      actionKey: "character_access_request_approved",
      status: "success",
      actorAccountId: "22222222-2222-2222-2222-222222222222",
      targetAccountId: "11111111-1111-1111-1111-111111111111",
      comment: "Одобрено",
      metadataJson: {
        flow: "character_access_request_review",
        requestId: "request-1",
        characterId: "character-1",
        serverId: "server-1",
        requestType: "advocate_access",
        grantedRoleKeys: ["lawyer"],
        grantedAccessFlags: ["advocate"],
      },
    });
  });
});

describe("rejectCharacterAccessRequestAsAdmin", () => {
  it("reject ничего не выдаёт и review-ит заявку как rejected", async () => {
    const dependencies = createDependencies();

    dependencies.getAccountById.mockResolvedValue({
      id: "22222222-2222-2222-2222-222222222222",
      isSuperAdmin: true,
    });
    dependencies.getCharacterAccessRequestById.mockResolvedValue({
      id: "request-2",
      accountId: "11111111-1111-1111-1111-111111111111",
      serverId: "server-1",
      characterId: "character-2",
      requestType: "advocate_access",
      status: "pending",
      character: {
        id: "character-2",
        deletedAt: null,
      },
    });

    const result = await rejectCharacterAccessRequestAsAdmin(
      {
        actorAccountId: "22222222-2222-2222-2222-222222222222",
        requestId: "request-2",
        reviewComment: "Отклонено",
      },
      dependencies as never,
    );

    expect(result).toEqual({
      status: "success",
      requestId: "request-2",
    });
    expect(dependencies.grantCharacterAssignments).not.toHaveBeenCalled();
    expect(dependencies.reviewCharacterAccessRequestRecord).toHaveBeenCalledWith(
      {
        requestId: "request-2",
        status: "rejected",
        reviewComment: "Отклонено",
        reviewedByAccountId: "22222222-2222-2222-2222-222222222222",
        reviewedAt: new Date("2026-04-24T12:00:00.000Z"),
      },
      {},
    );
    expect(dependencies.createAuditLog).toHaveBeenCalledWith({
      actionKey: "character_access_request_rejected",
      status: "success",
      actorAccountId: "22222222-2222-2222-2222-222222222222",
      targetAccountId: "11111111-1111-1111-1111-111111111111",
      comment: "Отклонено",
      metadataJson: {
        flow: "character_access_request_review",
        requestId: "request-2",
        characterId: "character-2",
        serverId: "server-1",
        requestType: "advocate_access",
      },
    });
  });
});
