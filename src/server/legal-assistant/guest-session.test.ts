import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
  headers: vi.fn(),
}));

vi.mock("@/db/repositories/assistant-guest-session.repository", () => ({
  createAssistantGuestSession: vi.fn(),
  findAssistantGuestSessionByFingerprint: vi.fn(),
  getAssistantGuestSessionByToken: vi.fn(),
  saveAssistantGuestAnswer: vi.fn(),
}));

import { cookies, headers } from "next/headers";

import { getAssistantGuestUsageState } from "@/server/legal-assistant/guest-session";

describe("assistant guest session", () => {
  it("разрешает гостевой вопрос, если использованной сессии по cookie и fingerprint нет", async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue(undefined),
    } as never);
    vi.mocked(headers).mockResolvedValue({
      get: vi.fn((name: string) => {
        if (name === "x-forwarded-for") {
          return "127.0.0.1";
        }

        if (name === "user-agent") {
          return "Vitest";
        }

        return null;
      }),
    } as never);

    const result = await getAssistantGuestUsageState({
      getAssistantGuestSessionByToken: vi.fn(),
      findAssistantGuestSessionByFingerprint: vi.fn().mockResolvedValue(null),
      createAssistantGuestSession: vi.fn(),
      saveAssistantGuestAnswer: vi.fn(),
      createGuestToken: vi.fn(),
      now: () => new Date("2026-04-20T10:00:00.000Z"),
    });

    expect(result.hasGuestQuestionAvailable).toBe(true);
    expect(result.savedAnswer).toBeNull();
  });

  it("блокирует нового гостя по сочетанию ip и user-agent, если вопрос уже использован", async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue(undefined),
    } as never);
    vi.mocked(headers).mockResolvedValue({
      get: vi.fn((name: string) => {
        if (name === "x-forwarded-for") {
          return "127.0.0.1";
        }

        if (name === "user-agent") {
          return "Vitest";
        }

        return null;
      }),
    } as never);

    const result = await getAssistantGuestUsageState({
      getAssistantGuestSessionByToken: vi.fn(),
      findAssistantGuestSessionByFingerprint: vi.fn().mockResolvedValue({
        id: "guest-1",
        guestToken: "abcdefghijklmnop123456",
        ipHash: "ip-hash",
        userAgentHash: "ua-hash",
        usedFreeQuestionAt: new Date("2026-04-20T10:00:00.000Z"),
        questionText: "Первый вопрос",
        answerMarkdown:
          "## Краткий вывод\nОтвет.\n\n## Что прямо следует из норм\nНорма.\n\n## Вывод / интерпретация\nИнтерпретация.",
        answerMetadataJson: {
          serverId: "server-1",
        },
        answerStatus: "answered",
        lastAnsweredAt: new Date("2026-04-20T10:00:00.000Z"),
      }),
      createAssistantGuestSession: vi.fn(),
      saveAssistantGuestAnswer: vi.fn(),
      createGuestToken: vi.fn(),
      now: () => new Date("2026-04-20T10:00:00.000Z"),
    });

    expect(result.hasGuestQuestionAvailable).toBe(false);
    expect(result.savedAnswer?.questionText).toBe("Первый вопрос");
  });
});
