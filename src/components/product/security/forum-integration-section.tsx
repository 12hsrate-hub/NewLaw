"use client";

import { useActionState, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  disableForumConnectionAction,
  type ForumIntegrationActionState,
  saveForumConnectionAction,
  validateForumConnectionAction,
} from "@/server/actions/forum-integration";
import type { ForumConnectionSummary } from "@/schemas/forum-integration";

type ForumIntegrationSectionProps = {
  forumConnection: ForumConnectionSummary;
};

function formatForumConnectionState(state: ForumConnectionSummary["state"]) {
  if (state === "not_connected") {
    return "не подключено";
  }

  if (state === "connected_unvalidated") {
    return "подключено, но не проверено";
  }

  if (state === "valid") {
    return "подключение работает";
  }

  if (state === "invalid") {
    return "нужно подключить заново";
  }

  return "отключено";
}

export function ForumIntegrationSection({
  forumConnection,
}: ForumIntegrationSectionProps) {
  const [rawSessionInput, setRawSessionInput] = useState("");
  const initialState: ForumIntegrationActionState = {
    errorMessage: null,
    successMessage: null,
    fieldErrors: {},
  };
  const [saveState, saveAction, isSaving] = useActionState(saveForumConnectionAction, initialState);
  const [validateState, validateAction, isValidating] = useActionState(
    validateForumConnectionAction,
    initialState,
  );
  const [disableState, disableAction, isDisabling] = useActionState(
    disableForumConnectionAction,
    initialState,
  );

  useEffect(() => {
    if (saveState?.successMessage) {
      setRawSessionInput("");
    }
  }, [saveState?.successMessage]);

  return (
    <Card className="space-y-5">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
          Подключение форума
        </p>
        <h2 className="text-2xl font-semibold">Подключение форума для жалоб в ОГП</h2>
        <p className="text-sm leading-6 text-[var(--muted)]">
          Здесь можно подключить форумный аккаунт для публикации жалоб в ОГП. Сырые cookie после
          сохранения больше не показываются в интерфейсе.
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.7)] px-4 py-3 text-sm leading-6 text-[var(--muted)]">
        <p>
          Форум: <span className="font-medium text-[var(--foreground)]">{forumConnection.providerKey}</span>
        </p>
        <p>
          Статус: <span className="font-medium text-[var(--foreground)]">{formatForumConnectionState(forumConnection.state)}</span>
        </p>
        <p>
          Форумный аккаунт:{" "}
          <span className="font-medium text-[var(--foreground)]">
            {forumConnection.forumUsername ?? "ещё не извлечена"}
            {forumConnection.forumUserId ? ` (${forumConnection.forumUserId})` : ""}
          </span>
        </p>
        <p>
          Последняя проверка:{" "}
          <span className="font-medium text-[var(--foreground)]">
            {forumConnection.validatedAt
              ? new Date(forumConnection.validatedAt).toLocaleString("ru-RU")
              : "ещё не подтверждалась"}
          </span>
        </p>
        {forumConnection.lastValidationError ? (
          <p className="mt-2 text-[#8a2d1d]">
            Последняя ошибка проверки: {forumConnection.lastValidationError}
          </p>
        ) : null}
      </div>

      <form action={saveAction} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="rawSessionInput">
            Cookie header форума
          </label>
          <Textarea
            id="rawSessionInput"
            name="rawSessionInput"
            onChange={(event) => {
              setRawSessionInput(event.target.value);
            }}
            placeholder="xf_user=...; xf_session=..."
            required
            value={rawSessionInput}
          />
          <p className="text-xs leading-5 text-[var(--muted)]">
            Вставьте Cookie header из запроса к `forum.gta5rp.com`. После сохранения он больше не
            будет показан в интерфейсе.
          </p>
          {saveState?.fieldErrors.rawSessionInput ? (
            <p className="text-sm leading-6 text-[#8a2d1d]">{saveState.fieldErrors.rawSessionInput}</p>
          ) : null}
        </div>

        <Button disabled={isSaving} fullWidth type="submit">
          {isSaving ? "Сохраняем подключение..." : "Подключить или обновить форум"}
        </Button>
      </form>

      {saveState?.errorMessage ? (
        <p className="text-sm leading-6 text-[#8a2d1d]">{saveState.errorMessage}</p>
      ) : null}
      {saveState?.successMessage ? (
        <p className="text-sm leading-6 text-[var(--muted)]">{saveState.successMessage}</p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <form action={validateAction}>
          <Button
            disabled={
              isValidating ||
              forumConnection.state === "not_connected" ||
              forumConnection.state === "disabled"
            }
            type="submit"
            variant="secondary"
          >
            {isValidating ? "Проверяем..." : "Проверить подключение"}
          </Button>
        </form>

        <form action={disableAction}>
          <Button
            disabled={
              isDisabling ||
              forumConnection.state === "not_connected" ||
              forumConnection.state === "disabled"
            }
            type="submit"
            variant="secondary"
          >
            {isDisabling ? "Отключаем..." : "Отключить форум"}
          </Button>
        </form>
      </div>

      {validateState?.errorMessage ? (
        <p className="text-sm leading-6 text-[#8a2d1d]">{validateState.errorMessage}</p>
      ) : null}
      {validateState?.successMessage ? (
        <p className="text-sm leading-6 text-[var(--muted)]">{validateState.successMessage}</p>
      ) : null}
      {disableState?.errorMessage ? (
        <p className="text-sm leading-6 text-[#8a2d1d]">{disableState.errorMessage}</p>
      ) : null}
      {disableState?.successMessage ? (
        <p className="text-sm leading-6 text-[var(--muted)]">{disableState.successMessage}</p>
      ) : null}
    </Card>
  );
}
