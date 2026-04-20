import { describe, expect, it, vi } from "vitest";

import {
  resolveSignInTargetEmail,
  signInWithIdentifierPassword,
} from "@/server/auth/sign-in";

const liveRuntimeConfig = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_live_value",
};

function createSignInClientMock() {
  return {
    auth: {
      signInWithPassword: vi.fn(),
    },
  };
}

describe("server sign-in helpers", () => {
  it("оставляет email как целевой идентификатор без lookup login", async () => {
    const getAccountByLogin = vi.fn();

    const result = await resolveSignInTargetEmail("User@example.com", {
      getAccountByLogin,
    });

    expect(result).toBe("user@example.com");
    expect(getAccountByLogin).not.toHaveBeenCalled();
  });

  it("разрешает login в email через account repository", async () => {
    const getAccountByLogin = vi.fn().mockResolvedValue({
      id: "86e4a621-4d9f-42ec-9fc1-ae9fe95d4631",
      email: "user@example.com",
    });

    const result = await resolveSignInTargetEmail("Lawyer_User", {
      getAccountByLogin,
    });

    expect(result).toBe("user@example.com");
    expect(getAccountByLogin).toHaveBeenCalledWith("lawyer_user");
  });

  it("входит по login через server-side email resolution", async () => {
    const client = createSignInClientMock();
    const getAccountByLogin = vi.fn().mockResolvedValue({
      id: "86e4a621-4d9f-42ec-9fc1-ae9fe95d4631",
      email: "user@example.com",
    });

    client.auth.signInWithPassword.mockResolvedValue({
      error: null,
    });

    const result = await signInWithIdentifierPassword(
      client,
      {
        identifier: "lawyer_user",
        password: "password123",
      },
      liveRuntimeConfig,
      "/app",
      {
        getAccountByLogin,
      },
    );

    expect(result).toEqual({
      status: "success",
      nextPath: "/app",
    });
    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "password123",
    });
  });

  it("возвращает нейтральную ошибку для несуществующего login", async () => {
    const client = createSignInClientMock();

    const result = await signInWithIdentifierPassword(
      client,
      {
        identifier: "missing_user",
        password: "password123",
      },
      liveRuntimeConfig,
      "/app",
      {
        getAccountByLogin: vi.fn().mockResolvedValue(null),
      },
    );

    expect(result).toEqual({
      status: "error",
      message: "Не удалось войти. Проверь email, login, пароль и попробуй ещё раз.",
    });
    expect(client.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("во время pendingEmail вход по login продолжает идти через текущий подтверждённый email", async () => {
    const getAccountByLogin = vi.fn().mockResolvedValue({
      id: "86e4a621-4d9f-42ec-9fc1-ae9fe95d4631",
      email: "confirmed@example.com",
      pendingEmail: "pending@example.com",
    });

    const result = await resolveSignInTargetEmail("lawyer_user", {
      getAccountByLogin,
    });

    expect(result).toBe("confirmed@example.com");
  });

  it("после confirm email_change вход по login продолжает работать уже через новый email", async () => {
    const getAccountByLogin = vi.fn().mockResolvedValue({
      id: "86e4a621-4d9f-42ec-9fc1-ae9fe95d4631",
      email: "new@example.com",
      pendingEmail: null,
    });

    const result = await resolveSignInTargetEmail("lawyer_user", {
      getAccountByLogin,
    });

    expect(result).toBe("new@example.com");
  });
});
