import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/server/auth/protected", () => ({
  requireProtectedAccountContext: vi.fn(),
}));

vi.mock("@/server/auth/admin-security", () => ({
  sendRecoveryEmail: vi.fn(),
  resetPasswordWithTempPassword: vi.fn(),
  changeEmailAsAdmin: vi.fn(),
}));

import {
  changeEmailAsAdminAction,
  resetPasswordWithTempPasswordAdminAction,
  sendRecoveryEmailAdminAction,
} from "@/server/actions/admin-security";
import { changeEmailAsAdmin, resetPasswordWithTempPassword, sendRecoveryEmail } from "@/server/auth/admin-security";
import { requireProtectedAccountContext } from "@/server/auth/protected";
import { revalidatePath } from "next/cache";

describe("admin security actions", () => {
  it("вызывает sendRecoveryEmail из UI корректно", async () => {
    vi.mocked(requireProtectedAccountContext).mockResolvedValue({
      account: { id: "4f49f692-c07b-4dba-a8fc-66b687d6f2c6" },
    } as never);
    vi.mocked(sendRecoveryEmail).mockResolvedValue({
      status: "success",
    });

    const result = await sendRecoveryEmailAdminAction({
      targetAccountId: "0b9d1c81-e5a9-4323-a748-e01622b02a41",
      comment: "Проверка доступа",
    });

    expect(sendRecoveryEmail).toHaveBeenCalledWith(
      "4f49f692-c07b-4dba-a8fc-66b687d6f2c6",
      "0b9d1c81-e5a9-4323-a748-e01622b02a41",
      "Проверка доступа",
    );
    expect(requireProtectedAccountContext).toHaveBeenCalledWith("/internal/security");
    expect(revalidatePath).toHaveBeenCalledWith("/internal/security");
    expect(result.status).toBe("success");
  });

  it("возвращает temp password из UI только в результате действия и без redirect данных", async () => {
    vi.mocked(requireProtectedAccountContext).mockResolvedValue({
      account: { id: "4f49f692-c07b-4dba-a8fc-66b687d6f2c6" },
    } as never);
    vi.mocked(resetPasswordWithTempPassword).mockResolvedValue({
      status: "success",
      tempPassword: "Tmp_only_once_value",
    });

    const result = await resetPasswordWithTempPasswordAdminAction({
      targetAccountId: "0b9d1c81-e5a9-4323-a748-e01622b02a41",
      comment: "Срочный reset",
    });

    expect(result).toEqual({
      status: "success",
      message:
        "Для аккаунта сгенерирован временный пароль. При следующем входе пользователь будет обязан сменить его.",
      tempPassword: "Tmp_only_once_value",
    });
    expect(JSON.stringify(result)).not.toContain("redirect");
    expect(JSON.stringify(result)).not.toContain("query");
  });

  it("вызывает changeEmailAsAdmin из UI корректно", async () => {
    vi.mocked(requireProtectedAccountContext).mockResolvedValue({
      account: { id: "4f49f692-c07b-4dba-a8fc-66b687d6f2c6" },
    } as never);
    vi.mocked(changeEmailAsAdmin).mockResolvedValue({
      status: "success",
    });

    const result = await changeEmailAsAdminAction({
      targetAccountId: "0b9d1c81-e5a9-4323-a748-e01622b02a41",
      newEmail: "updated@example.com",
      comment: "Исправление адреса",
    });

    expect(changeEmailAsAdmin).toHaveBeenCalledWith(
      "4f49f692-c07b-4dba-a8fc-66b687d6f2c6",
      "0b9d1c81-e5a9-4323-a748-e01622b02a41",
      "updated@example.com",
      "Исправление адреса",
    );
    expect(result.status).toBe("success");
  });

  it("безопасно возвращает forbidden ветку из server-side слоя", async () => {
    vi.mocked(requireProtectedAccountContext).mockResolvedValue({
      account: { id: "4f49f692-c07b-4dba-a8fc-66b687d6f2c6" },
    } as never);
    vi.mocked(sendRecoveryEmail).mockResolvedValue({
      status: "forbidden",
      message: "Только super_admin может выполнять это действие.",
    });

    const result = await sendRecoveryEmailAdminAction({
      targetAccountId: "0b9d1c81-e5a9-4323-a748-e01622b02a41",
      comment: "Проверка доступа",
    });

    expect(result).toEqual({
      status: "forbidden",
      message: "Только super_admin может выполнять это действие.",
    });
  });

  it("умеет переиспользоваться из /internal/security и ревалидирует новый target contour", async () => {
    vi.mocked(requireProtectedAccountContext).mockResolvedValue({
      account: { id: "4f49f692-c07b-4dba-a8fc-66b687d6f2c6" },
    } as never);
    vi.mocked(sendRecoveryEmail).mockResolvedValue({
      status: "success",
    });

    const result = await sendRecoveryEmailAdminAction({
      targetAccountId: "0b9d1c81-e5a9-4323-a748-e01622b02a41",
      comment: "Проверка internal contour",
      returnPath: "/internal/security",
    });

    expect(requireProtectedAccountContext).toHaveBeenCalledWith("/internal/security");
    expect(revalidatePath).toHaveBeenCalledWith("/internal/security");
    expect(result.status).toBe("success");
  });
});
