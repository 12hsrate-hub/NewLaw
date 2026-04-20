"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type SignInFormProps = {
  nextPath: string;
};

export function SignInForm({ nextPath }: SignInFormProps) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [email, setEmail] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setErrorMessage(null);
    setMessage(null);

    const redirectUrl = new URL("/auth/confirm", window.location.origin);
    redirectUrl.searchParams.set("next", nextPath);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectUrl.toString(),
      },
    });

    if (error) {
      setErrorMessage("Не удалось отправить ссылку для входа. Проверь адрес и попробуй ещё раз.");
      setIsPending(false);
      return;
    }

    setMessage("Ссылка для входа отправлена. Проверь почту и вернись по письму.");
    setIsPending(false);
  }

  return (
    <Card className="w-full max-w-md space-y-5">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Вход</p>
        <h1 className="text-3xl font-semibold">Lawyer5RP</h1>
        <p className="text-sm leading-6 text-[var(--muted)]">
          Войди по email через ссылку из письма. После подтверждения откроется защищённый контур приложения.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="email">
            Email аккаунта
          </label>
          <Input
            autoComplete="email"
            id="email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            required
            type="email"
            value={email}
          />
        </div>

        <Button disabled={isPending} fullWidth type="submit">
          {isPending ? "Отправляем ссылку..." : "Войти по email"}
        </Button>
      </form>

      {message ? <p className="text-sm leading-6 text-[var(--foreground)]">{message}</p> : null}
      {errorMessage ? <p className="text-sm leading-6 text-[#8a2d1d]">{errorMessage}</p> : null}
    </Card>
  );
}
