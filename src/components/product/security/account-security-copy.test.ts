import { describe, expect, it } from "vitest";

import {
  formatForumProviderLabel,
  getSafeAccountSecurityMessage,
  getSafeForumFieldError,
  getSafeForumIntegrationMessage,
} from "@/components/product/security/account-security-copy";

describe("account security copy helpers", () => {
  it("убирает технические коды из account security messages", () => {
    expect(
      getSafeAccountSecurityMessage(
        "Не удалось подтвердить текущий пароль. Проверьте пароль и попробуйте снова. Код: ACCOUNT_CURRENT_PASSWORD_INVALID.",
      ),
    ).toBe("Не удалось подтвердить текущий пароль. Проверьте пароль и попробуйте снова.");

    expect(
      getSafeAccountSecurityMessage(
        "Смена email временно недоступна из-за настройки сервера. Код: ACCOUNT_EMAIL_RUNTIME_CONFIG_MISSING.",
      ),
    ).toBe("Смена email временно недоступна. Попробуйте позже.");
  });

  it("делает forum integration сообщения безопасными для account UI", () => {
    expect(
      getSafeForumIntegrationMessage(
        "Не удалось сохранить подключение форума. Проверьте Cookie header и попробуйте снова. Код: FORUM_CONNECTION_SAVE_FAILED.",
      ),
    ).toBe("Не удалось сохранить подключение форума. Проверьте данные и попробуйте снова.");

    expect(
      getSafeForumIntegrationMessage(
        "Форум не подтвердил авторизованную session. Подключите новую Cookie header заново.",
      ),
    ).toBe("Не удалось подтвердить подключение форума. Обновите данные и попробуйте снова.");

    expect(getSafeForumFieldError("Вставьте Cookie header форума целиком.")).toBe(
      "Вставьте cookie форума целиком.",
    );

    expect(formatForumProviderLabel("forum.gta5rp.com")).toBe("Форум GTA5RP");
  });
});
