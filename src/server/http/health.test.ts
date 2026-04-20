import { describe, expect, it } from "vitest";

import { getHealthPayload } from "@/server/http/health";

describe("getHealthPayload", () => {
  it("возвращает валидный health payload", () => {
    process.env.APP_ENV = "test";

    const payload = getHealthPayload();

    expect(payload.status).toBe("ok");
    expect(payload.service).toBe("lawyer5rp-mvp");
    expect(payload.environment).toBe("test");
    expect(payload.checks.api).toBe("ok");
    expect(payload.checks.prisma).toBe("prepared");
    expect(payload.checks.database).toBe("not-configured-yet");
    expect(() => new Date(payload.timestamp)).not.toThrow();
  });
});
