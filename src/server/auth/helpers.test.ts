import { describe, expect, it } from "vitest";

import {
  AuthRequiredError,
  type SupabaseAuthClientLike,
  getCurrentSession,
  getCurrentUser,
  isAuthenticatedServerSide,
  requireAuthenticatedUser,
} from "@/server/auth/helpers";

function createAuthClientMock(): SupabaseAuthClientLike {
  return {
    auth: {
      async getSession() {
        return {
          data: {
            session: {
              access_token: "token",
              user: {
                id: "21631886-7b4d-4be2-b6e9-95322d0dca41",
                email: "user@example.com",
              },
            },
          },
          error: null,
        };
      },
      async getUser() {
        return {
          data: {
            user: {
              id: "21631886-7b4d-4be2-b6e9-95322d0dca41",
              email: "user@example.com",
            },
          },
          error: null,
        };
      },
    },
  };
}

describe("auth helpers", () => {
  it("возвращает текущую сессию", async () => {
    const session = await getCurrentSession(createAuthClientMock());

    expect(session?.access_token).toBe("token");
    expect(session?.user?.email).toBe("user@example.com");
  });

  it("возвращает текущего пользователя", async () => {
    const user = await getCurrentUser(createAuthClientMock());

    expect(user?.id).toBe("21631886-7b4d-4be2-b6e9-95322d0dca41");
  });

  it("безопасно проверяет авторизацию", async () => {
    await expect(isAuthenticatedServerSide(createAuthClientMock())).resolves.toBe(true);
  });

  it("бросает ошибку при отсутствии пользователя", async () => {
    const anonymousClient: SupabaseAuthClientLike = {
      auth: {
        async getSession() {
          return {
            data: {
              session: null,
            },
            error: null,
          };
        },
        async getUser() {
          return {
            data: {
              user: null,
            },
            error: null,
          };
        },
      },
    };

    await expect(requireAuthenticatedUser(anonymousClient)).rejects.toBeInstanceOf(AuthRequiredError);
  });
});
