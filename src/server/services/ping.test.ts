import { describe, expect, it } from "vitest";

import { buildPingResponse } from "@/server/services/ping";

describe("buildPingResponse", () => {
  it("возвращает подтверждение для валидного сообщения", () => {
    const result = buildPingResponse({
      message: "bootstrap",
    });

    expect(result.ok).toBe(true);
    expect(result.echoedMessage).toBe("bootstrap");
    expect(() => new Date(result.processedAt)).not.toThrow();
  });

  it("бросает ошибку для пустого сообщения", () => {
    expect(() =>
      buildPingResponse({
        message: "",
      }),
    ).toThrow();
  });
});
