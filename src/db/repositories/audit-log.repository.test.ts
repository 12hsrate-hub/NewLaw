import { describe, expect, it, vi } from "vitest";

import { createAuditLog } from "@/db/repositories/audit-log.repository";

describe("audit log repository", () => {
  it("пишет базовый audit log без чувствительных данных", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "audit_1",
      actionKey: "password_changed_self",
      status: "success",
    });

    await createAuditLog(
      {
        actionKey: "password_changed_self",
        status: "success",
        actorAccountId: "b0a2f88a-a6f8-4136-9b94-aee75cf37e3a",
        targetAccountId: "b0a2f88a-a6f8-4136-9b94-aee75cf37e3a",
        comment: "Self-service password change",
        metadataJson: {
          source: "security_screen",
        },
      },
      {
        auditLog: {
          create,
        },
      },
    );

    expect(create).toHaveBeenCalledWith({
      data: {
        actionKey: "password_changed_self",
        status: "success",
        actorAccountId: "b0a2f88a-a6f8-4136-9b94-aee75cf37e3a",
        targetAccountId: "b0a2f88a-a6f8-4136-9b94-aee75cf37e3a",
        comment: "Self-service password change",
        metadataJson: {
          source: "security_screen",
        },
        ipAddress: null,
        userAgent: null,
      },
    });
  });
});
