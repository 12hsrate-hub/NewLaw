"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmbeddedCard } from "@/components/ui/embedded-card";
import { Input } from "@/components/ui/input";
import { changePasswordAction } from "@/server/actions/account-security";
import { getSafeAccountSecurityMessage } from "@/components/product/security/account-security-copy";

type ChangePasswordFormProps = {
  mustChangePassword: boolean;
};

export function ChangePasswordForm({ mustChangePassword }: ChangePasswordFormProps) {
  const initialState = {
    errorMessage: null,
    fieldErrors: {} as {
      currentPassword?: string;
      newPassword?: string;
      confirmNewPassword?: string;
    },
  };
  const [state, formAction, isPending] = useActionState(changePasswordAction, initialState);
  const safeState = state ?? initialState;

  return (
    <Card className="space-y-5">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Пароль</p>
        <h2 className="text-2xl font-semibold">Сменить пароль</h2>
        <p className="text-sm leading-6 text-[var(--muted)]">
          Подтвердите текущий пароль и задайте новый. После смены пароля нужно будет войти заново.
        </p>
      </div>

      {mustChangePassword ? (
        <EmbeddedCard className="border-[rgba(184,135,57,0.3)] bg-[rgba(122,88,34,0.18)] text-[#f0d4a0]">
          Для продолжения работы сначала смените пароль. До этого другие защищённые действия недоступны.
        </EmbeddedCard>
      ) : null}

      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="currentPassword">
            Текущий пароль
          </label>
          <Input
            autoComplete="current-password"
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
            Подтверждение нового пароля
          </label>
          <Input
            autoComplete="new-password"
            id="confirmNewPassword"
            name="confirmNewPassword"
            placeholder="Повторите новый пароль"
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
          {isPending ? "Сохраняем пароль..." : "Сменить пароль"}
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
