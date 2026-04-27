"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmbeddedCard } from "@/components/ui/embedded-card";
import { Input } from "@/components/ui/input";
import { changeEmailAction } from "@/server/actions/account-security";
import { getSafeAccountSecurityMessage } from "@/components/product/security/account-security-copy";

type ChangeEmailFormProps = {
  currentEmail: string;
  mustChangePassword: boolean;
};

export function ChangeEmailForm({
  currentEmail,
  mustChangePassword,
}: ChangeEmailFormProps) {
  const initialState = {
    errorMessage: null,
    fieldErrors: {} as {
      currentPassword?: string;
      newEmail?: string;
    },
  };
  const [state, formAction, isPending] = useActionState(changeEmailAction, initialState);
  const safeState = state ?? initialState;

  return (
    <Card className="space-y-5">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Email</p>
        <h2 className="text-2xl font-semibold">Сменить email</h2>
        <p className="text-sm leading-6 text-[var(--muted)]">
          Текущий подтверждённый email остаётся рабочим, пока новый адрес не будет подтверждён по ссылке из письма.
        </p>
      </div>

      <EmbeddedCard className="text-sm leading-6 text-[var(--muted)]">
        Текущий подтверждённый email: <span className="font-medium text-[var(--foreground)]">{currentEmail}</span>
      </EmbeddedCard>

      {mustChangePassword ? (
        <EmbeddedCard className="border-[rgba(184,135,57,0.3)] bg-[rgba(122,88,34,0.18)] text-[#f0d4a0]">
          Пока требуется смена пароля, обновление email временно недоступно.
        </EmbeddedCard>
      ) : null}

      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="newEmail">
            Новый email
          </label>
          <Input
            autoCapitalize="none"
            autoComplete="email"
            disabled={mustChangePassword}
            id="newEmail"
            name="newEmail"
            placeholder="new@example.com"
            required
            type="email"
          />
          {safeState.fieldErrors.newEmail ? (
            <p className="text-sm leading-6 text-[#f2b8ad]">{safeState.fieldErrors.newEmail}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="currentPassword">
            Текущий пароль
          </label>
          <Input
            autoComplete="current-password"
            disabled={mustChangePassword}
            id="currentPassword"
            name="currentPassword"
            placeholder="Текущий пароль"
            required
            type="password"
          />
          {safeState.fieldErrors.currentPassword ? (
            <p className="text-sm leading-6 text-[#f2b8ad]">{safeState.fieldErrors.currentPassword}</p>
          ) : null}
        </div>

        <Button disabled={isPending || mustChangePassword} fullWidth type="submit">
          {isPending ? "Подготавливаем подтверждение..." : "Запросить смену email"}
        </Button>
      </form>

      {safeState.errorMessage ? (
        <EmbeddedCard className="border-[rgba(200,112,92,0.35)] bg-[rgba(116,48,33,0.2)] text-[#f2b8ad]">
          <p className="text-sm leading-6">{getSafeAccountSecurityMessage(safeState.errorMessage)}</p>
        </EmbeddedCard>
      ) : null}
    </Card>
  );
}
