function stripTrailingCode(message: string) {
  return message.replace(/\s*Код:\s*[A-Z0-9_.-]+\.?/gu, "").trim();
}

export function getSafeAccountSecurityMessage(message: string | null | undefined) {
  if (!message) {
    return null;
  }

  if (message.includes("ACCOUNT_PASSWORD_RUNTIME_CONFIG_MISSING")) {
    return "Смена пароля временно недоступна. Попробуйте позже.";
  }

  if (message.includes("ACCOUNT_EMAIL_RUNTIME_CONFIG_MISSING")) {
    return "Смена email временно недоступна. Попробуйте позже.";
  }

  if (message.includes("ACCOUNT_PASSWORD_CHANGE_REQUIRED")) {
    return "Сначала смените пароль, а затем попробуйте обновить email.";
  }

  if (message.includes("ACCOUNT_CURRENT_PASSWORD_INVALID")) {
    return "Не удалось подтвердить текущий пароль. Проверьте пароль и попробуйте снова.";
  }

  if (message.includes("ACCOUNT_PASSWORD_SAME_AS_CURRENT")) {
    return "Новый пароль должен отличаться от текущего.";
  }

  if (message.includes("ACCOUNT_PASSWORD_REAUTH_REQUIRED")) {
    return "Не удалось безопасно сменить пароль. Войдите в аккаунт заново и повторите попытку.";
  }

  if (message.includes("ACCOUNT_PASSWORD_CHANGE_FAILED")) {
    return "Не удалось сохранить новый пароль. Попробуйте снова немного позже.";
  }

  if (message.includes("ACCOUNT_EMAIL_ALREADY_USED")) {
    return "Этот email уже занят другим аккаунтом.";
  }

  if (message.includes("ACCOUNT_EMAIL_INVALID")) {
    return "Укажите корректный новый email.";
  }

  if (message.includes("ACCOUNT_EMAIL_SAME_AS_CURRENT")) {
    return "Новый email должен отличаться от текущего адреса.";
  }

  if (message.includes("ACCOUNT_EMAIL_CHANGE_FAILED")) {
    return "Не удалось отправить письмо для подтверждения нового email. Попробуйте ещё раз.";
  }

  return stripTrailingCode(message);
}

export function getSafeForumIntegrationMessage(message: string | null | undefined) {
  if (!message) {
    return null;
  }

  if (message.includes("FORUM_CONNECTION_CONFIG_MISSING")) {
    return "Подключение форума временно недоступно. Попробуйте позже.";
  }

  if (message.includes("FORUM_CONNECTION_SAVE_FAILED")) {
    return "Не удалось сохранить подключение форума. Проверьте данные и попробуйте снова.";
  }

  if (message.includes("FORUM_CONNECTION_NOT_FOUND")) {
    return "Сначала сохраните данные форума, а затем запустите проверку.";
  }

  if (message.includes("FORUM_CONNECTION_VALIDATE_FAILED")) {
    return "Не удалось проверить подключение форума. Попробуйте ещё раз чуть позже.";
  }

  if (message.includes("FORUM_CONNECTION_RECONNECT_REQUIRED")) {
    return "Подключение форума требует обновления. Сохраните новые данные и повторите проверку.";
  }

  if (
    message.includes("forum.gta5rp.com") ||
    message.includes("forum session") ||
    message.includes("Cookie header") ||
    message.includes("session")
  ) {
    return "Не удалось подтвердить подключение форума. Обновите данные и попробуйте снова.";
  }

  return stripTrailingCode(message);
}

export function getSafeForumFieldError(message: string | undefined) {
  if (!message) {
    return null;
  }

  if (message.includes("Cookie header форума целиком")) {
    return "Вставьте cookie форума целиком.";
  }

  if (message.includes("Cookie header получился слишком длинным")) {
    return "Данные для подключения получились слишком длинными.";
  }

  return message;
}

export function formatForumProviderLabel(providerKey: string) {
  if (providerKey === "forum.gta5rp.com") {
    return "Форум GTA5RP";
  }

  return providerKey;
}
