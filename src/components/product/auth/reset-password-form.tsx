"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmbeddedCard } from "@/components/ui/embedded-card";
import { Input } from "@/components/ui/input";
import {
  resetPasswordAction,
} from "@/server/actions/public-auth";

export function ResetPasswordForm() {
  const initialState = {
    errorMessage: null,
    fieldErrors: {} as {
      confirmNewPassword?: string;
      newPassword?: string;
    },
  };
  const [state, formAction, isPending] = useActionState(
    resetPasswordAction,
    initialState,
  );
  const safeState = state ?? initialState;

  return (
    <Card className="w-full max-w-md space-y-5">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Новый пароль</p>
        <h1 className="text-3xl font-semibold">Сброс пароля</h1>
        <p className="text-sm leading-6 text-[var(--muted)]">
          Задай новый пароль для аккаунта. После сохранения нужно будет войти заново уже с новым паролем.
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="newPassword">
            Новый пароль
          </label>
          <Input
            autoComplete="new-password"
            id="newPassword"
            name="newPassword"
            placeholder="Минимум 8 символов"
            required
            type="password"
          />
          {safeState.fieldErrors.newPassword ? (
            <p className="text-sm leading-6 text-[#f2b8ad]">{safeState.fieldErrors.newPassword}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="confirmNewPassword">
            Подтверждение пароля
          </label>
          <Input
            autoComplete="new-password"
            id="confirmNewPassword"
            name="confirmNewPassword"
            placeholder="Повтори новый пароль"
            required
            type="password"
          />
          {safeState.fieldErrors.confirmNewPassword ? (
            <p className="text-sm leading-6 text-[#f2b8ad]">
              {safeState.fieldErrors.confirmNewPassword}
            </p>
          ) : null}
        </div>

        <Button disabled={isPending} fullWidth type="submit">
          {isPending ? "Сохраняем пароль..." : "Сохранить новый пароль"}
        </Button>
      </form>

      {safeState.errorMessage ? (
        <EmbeddedCard className="border-[rgba(200,112,92,0.35)] bg-[rgba(116,48,33,0.2)] text-[#f2b8ad]">
          <p className="text-sm leading-6">{safeState.errorMessage}</p>
        </EmbeddedCard>
      ) : null}

      <p className="text-sm leading-6 text-[var(--muted)]">
        Если ссылка больше не работает,{" "}
        <Link className="font-medium text-[var(--accent)]" href="/forgot-password">
          запроси новое письмо
        </Link>
        .
      </p>
    </Card>
  );
}
