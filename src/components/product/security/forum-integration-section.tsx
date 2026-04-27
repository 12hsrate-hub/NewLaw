"use client";

import { useActionState, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmbeddedCard } from "@/components/ui/embedded-card";
import { SectionHeader } from "@/components/ui/section-header";
import { Textarea } from "@/components/ui/textarea";
import {
  disableForumConnectionAction,
  type ForumIntegrationActionState,
  saveForumConnectionAction,
  validateForumConnectionAction,
} from "@/server/actions/forum-integration";
import type { ForumConnectionSummary } from "@/schemas/forum-integration";
import {
  formatForumProviderLabel,
  getSafeForumFieldError,
  getSafeForumIntegrationMessage,
} from "@/components/product/security/account-security-copy";

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
      <SectionHeader
        description="Здесь можно подключить форумный аккаунт для публикации жалоб в ОГП. Сырые cookie после сохранения больше не показываются в интерфейсе."
        eyebrow="Подключение форума"
        title="Подключение форума для жалоб в ОГП"
      />

      <EmbeddedCard className="space-y-3 text-sm leading-6 text-[var(--muted)]">
        <p>
          Форум: <span className="font-medium text-[var(--foreground)]">{formatForumProviderLabel(forumConnection.providerKey)}</span>
        </p>
        <p>
          Статус: <span className="font-medium text-[var(--foreground)]">{formatForumConnectionState(forumConnection.state)}</span>
        </p>
        <p>
          Форумный аккаунт:{" "}
          <span className="font-medium text-[var(--foreground)]">
            {forumConnection.forumUsername ?? "ещё не подтверждён"}
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
          <p className="text-[#f2b8ad]">
            Подключение к форуму не подтверждено. Обновите данные форума и повторите проверку.
          </p>
        ) : null}
      </EmbeddedCard>

      <form action={saveAction} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="rawSessionInput">
            Данные форума для подключения
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
            Вставьте cookie форума из браузера. После сохранения эти данные больше не будут
            показаны в интерфейсе.
          </p>
          {saveState?.fieldErrors.rawSessionInput ? (
            <p className="text-sm leading-6 text-[#f2b8ad]">
              {getSafeForumFieldError(saveState.fieldErrors.rawSessionInput)}
            </p>
          ) : null}
        </div>

        <Button disabled={isSaving} fullWidth type="submit">
          {isSaving ? "Сохраняем подключение..." : "Подключить или обновить форум"}
        </Button>
      </form>

      {saveState?.errorMessage ? (
        <EmbeddedCard className="border-[rgba(200,112,92,0.35)] bg-[rgba(116,48,33,0.2)] text-[#f2b8ad]">
          <p className="text-sm leading-6">{getSafeForumIntegrationMessage(saveState.errorMessage)}</p>
        </EmbeddedCard>
      ) : null}
      {saveState?.successMessage ? (
        <EmbeddedCard className="border-[rgba(74,138,104,0.3)] bg-[rgba(49,87,64,0.2)] text-[#9ed8b3]">
          <p className="text-sm leading-6">{saveState.successMessage}</p>
        </EmbeddedCard>
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
        <EmbeddedCard className="border-[rgba(200,112,92,0.35)] bg-[rgba(116,48,33,0.2)] text-[#f2b8ad]">
          <p className="text-sm leading-6">{getSafeForumIntegrationMessage(validateState.errorMessage)}</p>
        </EmbeddedCard>
      ) : null}
      {validateState?.successMessage ? (
        <EmbeddedCard className="border-[rgba(74,138,104,0.3)] bg-[rgba(49,87,64,0.2)] text-[#9ed8b3]">
          <p className="text-sm leading-6">{validateState.successMessage}</p>
        </EmbeddedCard>
      ) : null}
      {disableState?.errorMessage ? (
        <EmbeddedCard className="border-[rgba(200,112,92,0.35)] bg-[rgba(116,48,33,0.2)] text-[#f2b8ad]">
          <p className="text-sm leading-6">{getSafeForumIntegrationMessage(disableState.errorMessage)}</p>
        </EmbeddedCard>
      ) : null}
      {disableState?.successMessage ? (
        <EmbeddedCard className="border-[rgba(74,138,104,0.3)] bg-[rgba(49,87,64,0.2)] text-[#9ed8b3]">
          <p className="text-sm leading-6">{disableState.successMessage}</p>
        </EmbeddedCard>
      ) : null}
    </Card>
  );
}
