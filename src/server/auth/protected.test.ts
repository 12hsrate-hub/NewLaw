import { describe, expect, it, vi } from "vitest";

import {
  buildSignInRedirectPath,
  requireProtectedAccountContext,
} from "@/server/auth/protected";

describe("protected auth helpers", () => {
  it("строит redirect на страницу входа с next path", () => {
    expect(buildSignInRedirectPath("/app")).toBe("/sign-in?next=%2Fapp");
    expect(buildSignInRedirectPath("/app/characters")).toBe(
      "/sign-in?next=%2Fapp%2Fcharacters",
    );
  });

  it("делает redirect для неавторизованного пользователя", async () => {
    const redirectMock = vi.fn((path: string) => {
      throw new Error(`redirect:${path}`);
    });

    await expect(
      requireProtectedAccountContext("/app", {
        getCurrentUser: vi.fn().mockResolvedValue(null),
        syncAccountFromSupabaseUser: vi.fn(),
        redirect: redirectMock,
      }),
    ).rejects.toThrowError("redirect:/sign-in?next=%2Fapp");

    expect(redirectMock).toHaveBeenCalledWith("/sign-in?next=%2Fapp");
  });

  it("возвращает пользователя и аккаунт для авторизованного запроса", async () => {
    const syncAccountFromSupabaseUser = vi.fn().mockResolvedValue({
      id: "21631886-7b4d-4be2-b6e9-95322d0dca41",
      email: "user@example.com",
    });
    const redirectStub = ((path: string) => {
      throw new Error(`redirect:${path}`);
    }) as (path: string) => never;

    const result = await requireProtectedAccountContext("/app", {
      getCurrentUser: vi.fn().mockResolvedValue({
        id: "21631886-7b4d-4be2-b6e9-95322d0dca41",
        email: "user@example.com",
      }),
      syncAccountFromSupabaseUser,
      redirect: redirectStub,
    });

    expect(result.account.email).toBe("user@example.com");
    expect(syncAccountFromSupabaseUser).toHaveBeenCalledWith({
      id: "21631886-7b4d-4be2-b6e9-95322d0dca41",
      email: "user@example.com",
    });
  });
});
