"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmbeddedCard } from "@/components/ui/embedded-card";
import { Input } from "@/components/ui/input";
import { signInAction } from "@/server/actions/auth";

type SignInFormProps = {
  nextPath: string;
};

export function SignInForm({ nextPath }: SignInFormProps) {
  const initialState = {
    errorMessage: null,
    fieldErrors: {} as {
      identifier?: string;
      password?: string;
    },
  };
  const [state, formAction, isPending] = useActionState(signInAction, initialState);
  const safeState = state ?? initialState;

  return (
    <Card className="w-full max-w-md space-y-5">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Вход</p>
        <h1 className="text-3xl font-semibold">Lawyer5RP</h1>
        <p className="text-sm leading-6 text-[var(--muted)]">
          Войди по почте или логину и паролю. Если не получается, воспользуйся восстановлением доступа.
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        <input name="nextPath" type="hidden" value={nextPath} />

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

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="password">
            Пароль
          </label>
          <Input
            autoComplete="current-password"
            id="password"
            name="password"
            placeholder="Минимум 8 символов"
            required
            type="password"
          />
          {safeState.fieldErrors.password ? (
            <p className="text-sm leading-6 text-[#f2b8ad]">{safeState.fieldErrors.password}</p>
          ) : null}
        </div>

        <Button disabled={isPending} fullWidth type="submit">
          {isPending ? "Входим..." : "Войти"}
        </Button>
      </form>

      {safeState.errorMessage ? (
        <EmbeddedCard className="border-[rgba(200,112,92,0.35)] bg-[rgba(116,48,33,0.2)] text-[#f2b8ad]">
          <p className="text-sm leading-6">{safeState.errorMessage}</p>
        </EmbeddedCard>
      ) : null}

      <div className="space-y-1 text-sm leading-6 text-[var(--muted)]">
        <p>
          Забыли пароль?{" "}
          <Link
            className="font-medium text-[var(--accent)]"
            href={`/forgot-password?next=${encodeURIComponent(nextPath)}`}
          >
            Восстановить доступ
          </Link>
        </p>
        <p>
          Нет аккаунта?{" "}
          <Link
            className="font-medium text-[var(--accent)]"
            href={`/sign-up?next=${encodeURIComponent(nextPath)}`}
          >
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </Card>
  );
}
