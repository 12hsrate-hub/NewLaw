"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  isSupabaseAuthRuntimeReady,
  signUpWithEmailPassword,
} from "@/lib/auth/email-auth";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type SignUpFormProps = {
  nextPath: string;
};

const publicRuntimeConfig = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

export function SignUpForm({ nextPath }: SignUpFormProps) {
  const router = useRouter();
  const runtimeReady = isSupabaseAuthRuntimeReady(publicRuntimeConfig);
  const supabase = useMemo(
    () => (runtimeReady ? createBrowserSupabaseClient() : null),
    [runtimeReady],
  );
  const [login, setLogin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      if (!supabase) {
        setMessage(
          "Сейчас подключены placeholder-переменные Supabase. Экран регистрации доступен, но реальное письмо подтверждения не отправится, пока не подставлены боевые значения Supabase и не будет настроен Custom SMTP.",
        );
        setIsPending(false);
        return;
      }

      const result = await signUpWithEmailPassword(
        supabase,
        {
          login,
          email,
          password,
        },
        publicRuntimeConfig,
        window.location.origin,
        nextPath,
      );

      if (result.status === "placeholder") {
        setMessage(result.message);
        setIsPending(false);
        return;
      }

      if (result.status === "error") {
        setErrorMessage(result.message);
        setIsPending(false);
        return;
      }

      router.push(result.checkEmailPath);
      router.refresh();
    } catch {
      setErrorMessage("Не удалось создать аккаунт. Проверь данные и попробуй ещё раз.");
      setIsPending(false);
    }
  }

  return (
    <Card className="w-full max-w-md space-y-5">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Регистрация</p>
        <h1 className="text-3xl font-semibold">Создать аккаунт</h1>
        <p className="text-sm leading-6 text-[var(--muted)]">
          После регистрации мы отправим письмо с подтверждением email. До подтверждения вход в защищённую часть не откроется. Для production-доставки auth-писем проект должен быть подключён к Supabase Custom SMTP.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="signup-login">
            Login аккаунта
          </label>
          <Input
            autoCapitalize="none"
            autoComplete="username"
            id="signup-login"
            name="login"
            onChange={(event) => setLogin(event.target.value)}
            placeholder="lawyer_user"
            required
            value={login}
          />
          <p className="text-xs leading-5 text-[var(--muted)]">
            Только латиница, цифры и нижнее подчёркивание. Login хранится в lowercase и в MVP не меняется.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="signup-email">
            Email
          </label>
          <Input
            autoComplete="email"
            id="signup-email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            required
            type="email"
            value={email}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="signup-password">
            Пароль
          </label>
          <Input
            autoComplete="new-password"
            id="signup-password"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Минимум 8 символов"
            required
            type="password"
            value={password}
          />
        </div>

        <Button disabled={isPending} fullWidth type="submit">
          {isPending ? "Создаём аккаунт..." : "Зарегистрироваться"}
        </Button>
      </form>

      {message ? <p className="text-sm leading-6 text-[var(--foreground)]">{message}</p> : null}
      {errorMessage ? <p className="text-sm leading-6 text-[#8a2d1d]">{errorMessage}</p> : null}

      <p className="text-sm leading-6 text-[var(--muted)]">
        Уже есть аккаунт?{" "}
        <Link className="font-medium text-[var(--accent)]" href={`/sign-in?next=${encodeURIComponent(nextPath)}`}>
          Войти
        </Link>
      </p>
    </Card>
  );
}
