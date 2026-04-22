import { describe, expect, it, vi } from "vitest";

import {
  buildEmailConfirmationRedirectUrl,
  sanitizeNextPath,
  signInWithEmailPassword,
  signUpWithEmailPassword,
} from "@/lib/auth/email-auth";

function createAuthClientMock() {
  return {
    auth: {
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      signUp: vi.fn(),
      verifyOtp: vi.fn(),
    },
  };
}

const liveRuntimeConfig = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_live_value",
};

describe("email auth helpers", () => {
  it("использует /account как default nextPath для missing и unsafe значений", () => {
    expect(sanitizeNextPath(undefined)).toBe("/account");
    expect(sanitizeNextPath(null)).toBe("/account");
    expect(sanitizeNextPath("//evil.example")).toBe("/account");
    expect(sanitizeNextPath("javascript:alert(1)")).toBe("/account");
  });

  it("строит redirect URL подтверждения email", () => {
    expect(
      buildEmailConfirmationRedirectUrl("https://lawyer5rp.ru", "/app"),
    ).toBe("https://lawyer5rp.ru/auth/confirm?next=%2Fapp");
  });

  it("строит redirect URL подтверждения email с /account как default target", () => {
    expect(buildEmailConfirmationRedirectUrl("https://lawyer5rp.ru")).toBe(
      "https://lawyer5rp.ru/auth/confirm?next=%2Faccount",
    );
  });

  it("возвращает placeholder-результат для signup без боевых env", async () => {
    const client = createAuthClientMock();

    const result = await signUpWithEmailPassword(
      client,
      {
        login: "lawyer_user",
        email: "user@example.com",
        password: "password123",
      },
      {
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-anon-key-placeholder",
      },
      "https://lawyer5rp.ru",
      "/app",
    );

    expect(result.status).toBe("placeholder");
  });

  it("возвращает путь на экран проверки почты после успешного signup", async () => {
    const client = createAuthClientMock();

    client.auth.signUp.mockResolvedValue({
      data: {
        session: null,
      },
      error: null,
    });

    const result = await signUpWithEmailPassword(
      client,
      {
        login: "lawyer_user",
        email: "user@example.com",
        password: "password123",
      },
      liveRuntimeConfig,
      "https://lawyer5rp.ru",
      "/app",
    );

    expect(result).toEqual({
      status: "confirmation-required",
      checkEmailPath: "/sign-up/check-email?status=signup-sent&next=%2Fapp",
    });
    expect(client.auth.signUp).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "password123",
      options: {
        emailRedirectTo: "https://lawyer5rp.ru/auth/confirm?next=%2Fapp",
        data: {
          login: "lawyer_user",
        },
      },
    });
  });

  it("после успешного signup без explicit next сохраняет /account как fallback target", async () => {
    const client = createAuthClientMock();

    client.auth.signUp.mockResolvedValue({
      data: {
        session: null,
      },
      error: null,
    });

    const result = await signUpWithEmailPassword(
      client,
      {
        login: "lawyer_user",
        email: "user@example.com",
        password: "password123",
      },
      liveRuntimeConfig,
      "https://lawyer5rp.ru",
    );

    expect(result).toEqual({
      status: "confirmation-required",
      checkEmailPath: "/sign-up/check-email?status=signup-sent&next=%2Faccount",
    });
  });

  it("приводит signup-ошибку к публичному сообщению", async () => {
    const client = createAuthClientMock();

    client.auth.signUp.mockResolvedValue({
      data: {
        session: null,
      },
      error: {
        code: "user_already_exists",
        message: "User already registered",
      },
    });

    const result = await signUpWithEmailPassword(
      client,
      {
        login: "lawyer_user",
        email: "user@example.com",
        password: "password123",
      },
      liveRuntimeConfig,
      "https://lawyer5rp.ru",
      "/app",
    );

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toContain("Не удалось создать аккаунт");
    }
  });

  it("валидирует signup-пароль до обращения к Supabase", async () => {
    const client = createAuthClientMock();

    await expect(
      signUpWithEmailPassword(
        client,
        {
          login: "lawyer_user",
          email: "user@example.com",
          password: "123",
        },
        liveRuntimeConfig,
        "https://lawyer5rp.ru",
        "/app",
      ),
    ).rejects.toThrow();

    expect(client.auth.signUp).not.toHaveBeenCalled();
  });

  it("возвращает success для sign-in с email и паролем", async () => {
    const client = createAuthClientMock();

    client.auth.signInWithPassword.mockResolvedValue({
      error: null,
    });

    const result = await signInWithEmailPassword(
      client,
      {
        email: "user@example.com",
        password: "password123",
      },
      liveRuntimeConfig,
      "/app",
    );

    expect(result).toEqual({
      status: "success",
      nextPath: "/app",
    });
  });

  it("возвращает /account как fallback для sign-in без explicit next", async () => {
    const client = createAuthClientMock();

    client.auth.signInWithPassword.mockResolvedValue({
      error: null,
    });

    const result = await signInWithEmailPassword(
      client,
      {
        email: "user@example.com",
        password: "password123",
      },
      liveRuntimeConfig,
    );

    expect(result).toEqual({
      status: "success",
      nextPath: "/account",
    });
  });
});
