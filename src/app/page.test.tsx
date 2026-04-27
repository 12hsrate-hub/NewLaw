import { beforeEach, describe, expect, it, vi } from "vitest";

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/server/auth/helpers", () => ({
  getCurrentUser: vi.fn(),
}));

import HomePage from "@/app/page";
import { getCurrentUser } from "@/server/auth/helpers";

describe("/ page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("для авторизованного пользователя использует /account как default landing", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
    });

    await HomePage();

    expect(redirectMock).toHaveBeenCalledWith("/account");
  });

  it("для гостя ведёт на /sign-in", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    await HomePage();

    expect(redirectMock).toHaveBeenCalledWith("/sign-in");
  });
});
