"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmbeddedCard } from "@/components/ui/embedded-card";
import { Input } from "@/components/ui/input";
import {
  requestPasswordRecoveryAction,
} from "@/server/actions/public-auth";

type ForgotPasswordFormProps = {
  nextPath: string;
};

export function ForgotPasswordForm({ nextPath }: ForgotPasswordFormProps) {
  const initialState = {
    errorMessage: null,
    fieldErrors: {} as {
      identifier?: string;
    },
  };
  const [state, formAction, isPending] = useActionState(
    requestPasswordRecoveryAction,
    initialState,
  );
  const safeState = state ?? initialState;

  return (
    <Card className="w-full max-w-md space-y-5">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Восстановление</p>
        <h1 className="text-3xl font-semibold">Забыли пароль?</h1>
        <p className="text-sm leading-6 text-[var(--muted)]">
          Укажи email аккаунта или `login`. Если аккаунт существует, мы отправим письмо со ссылкой для восстановления пароля.
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="identifier">
            Email или login
          </label>
          <Input
            autoCapitalize="none"
            autoComplete="username"
            id="identifier"
            name="identifier"
            placeholder="name@example.com или lawyer_user"
            required
            type="text"
          />
          {safeState.fieldErrors.identifier ? (
            <p className="text-sm leading-6 text-[#f2b8ad]">{safeState.fieldErrors.identifier}</p>
          ) : null}
        </div>

        <Button disabled={isPending} fullWidth type="submit">
          {isPending ? "Отправляем письмо..." : "Отправить письмо"}
        </Button>
      </form>

      {safeState.errorMessage ? (
        <EmbeddedCard className="border-[rgba(200,112,92,0.35)] bg-[rgba(116,48,33,0.2)] text-[#f2b8ad]">
          <p className="text-sm leading-6">{safeState.errorMessage}</p>
        </EmbeddedCard>
      ) : null}

      <div className="space-y-1 text-sm leading-6 text-[var(--muted)]">
        <p>
          Нет аккаунта?{" "}
          <Link
            className="font-medium text-[var(--accent)]"
            href={`/sign-up?next=${encodeURIComponent(nextPath)}`}
          >
            Зарегистрироваться
          </Link>
        </p>
        <p>
          Помните пароль?{" "}
          <Link
            className="font-medium text-[var(--accent)]"
            href={`/sign-in?next=${encodeURIComponent(nextPath)}`}
          >
            Вернуться ко входу
          </Link>
        </p>
      </div>
    </Card>
  );
}
