"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { changeEmailAction } from "@/server/actions/account-security";

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

      <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.7)] px-4 py-3 text-sm leading-6 text-[var(--muted)]">
        Текущий подтверждённый email: <span className="font-medium text-[var(--foreground)]">{currentEmail}</span>
      </div>

      {mustChangePassword ? (
        <div className="rounded-2xl border border-[#d7c4b6] bg-[#fff5eb] px-4 py-3 text-sm leading-6 text-[#7a3f1d]">
          Пока требуется смена пароля, обновление email временно недоступно.
        </div>
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
            <p className="text-sm leading-6 text-[#8a2d1d]">{safeState.fieldErrors.newEmail}</p>
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
            <p className="text-sm leading-6 text-[#8a2d1d]">{safeState.fieldErrors.currentPassword}</p>
          ) : null}
        </div>

        <Button disabled={isPending || mustChangePassword} fullWidth type="submit">
          {isPending ? "Подготавливаем подтверждение..." : "Запросить смену email"}
        </Button>
      </form>

      {safeState.errorMessage ? (
        <p className="text-sm leading-6 text-[#8a2d1d]">{safeState.errorMessage}</p>
      ) : null}
    </Card>
  );
}
