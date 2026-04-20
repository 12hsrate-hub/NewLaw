"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  initialForgotPasswordActionState,
  requestPasswordRecoveryAction,
} from "@/server/actions/public-auth";

type ForgotPasswordFormProps = {
  nextPath: string;
};

export function ForgotPasswordForm({ nextPath }: ForgotPasswordFormProps) {
  const [state, formAction, isPending] = useActionState(
    requestPasswordRecoveryAction,
    initialForgotPasswordActionState,
  );

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
          {state.fieldErrors.identifier ? (
            <p className="text-sm leading-6 text-[#8a2d1d]">{state.fieldErrors.identifier}</p>
          ) : null}
        </div>

        <Button disabled={isPending} fullWidth type="submit">
          {isPending ? "Отправляем письмо..." : "Отправить письмо"}
        </Button>
      </form>

      {state.errorMessage ? (
        <p className="text-sm leading-6 text-[#8a2d1d]">{state.errorMessage}</p>
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
