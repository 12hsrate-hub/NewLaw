"use client";

import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  changeEmailAsAdminAction,
  resetPasswordWithTempPasswordAdminAction,
  sendRecoveryEmailAdminAction,
  type AdminResetPasswordUiActionResult,
  type AdminUiActionResult,
} from "@/server/actions/admin-security";

type AdminSecurityActionsPanelProps = {
  accountId: string;
  accountEmail: string;
  accountLogin: string;
  pendingEmail: string | null;
};

function ResultMessage({
  result,
}: {
  result: AdminUiActionResult | null;
}) {
  if (!result || !result.message) {
    return null;
  }

  const colorClass =
    result.status === "success"
      ? "border-[#c9d8c3] bg-[#eef7ea] text-[#254d1d]"
      : "border-[#d7c4b6] bg-[#fff5eb] text-[#7a3f1d]";

  return <p className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${colorClass}`}>{result.message}</p>;
}

export function AdminSecurityActionsPanel({
  accountId,
  accountEmail,
  accountLogin,
  pendingEmail,
}: AdminSecurityActionsPanelProps) {
  const [recoveryResult, setRecoveryResult] = useState<AdminUiActionResult | null>(null);
  const [emailChangeResult, setEmailChangeResult] = useState<AdminUiActionResult | null>(null);
  const [resetResult, setResetResult] = useState<AdminResetPasswordUiActionResult | null>(null);
  const [recoveryPending, startRecoveryTransition] = useTransition();
  const [resetPending, startResetTransition] = useTransition();
  const [emailPending, startEmailTransition] = useTransition();

  const targetSummary = useMemo(
    () => `${accountLogin} · ${accountEmail}`,
    [accountEmail, accountLogin],
  );

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <Card className="space-y-5">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Recovery</p>
          <h2 className="text-2xl font-semibold">Отправить recovery email</h2>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Письмо уйдёт на текущий подтверждённый email <span className="font-medium text-[var(--foreground)]">{accountEmail}</span>, а не на pending email.
          </p>
        </div>

        {pendingEmail ? (
          <div className="rounded-2xl border border-[#d7c4b6] bg-[#fff5eb] px-4 py-3 text-sm leading-6 text-[#7a3f1d]">
            У аккаунта есть pending email <span className="font-medium">{pendingEmail}</span>, но recovery всё равно уйдёт на подтверждённый адрес.
          </div>
        ) : null}

        <form
          action={(formData) => {
            const comment = String(formData.get("comment") ?? "");

            startRecoveryTransition(async () => {
              setRecoveryResult(null);
              const result = await sendRecoveryEmailAdminAction({
                targetAccountId: accountId,
                comment,
              });

              setRecoveryResult(result);
            });
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor={`recovery-comment-${accountId}`}>
              Comment / reason
            </label>
            <textarea
              className="min-h-28 w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:bg-white"
              id={`recovery-comment-${accountId}`}
              name="comment"
              placeholder="Коротко опиши причину отправки recovery email"
              required
            />
          </div>

          <Button disabled={recoveryPending} fullWidth type="submit">
            {recoveryPending ? "Отправляем recovery..." : "Отправить recovery email"}
          </Button>
        </form>

        <ResultMessage result={recoveryResult} />
      </Card>

      <Card className="space-y-5">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Reset</p>
          <h2 className="text-2xl font-semibold">Сбросить пароль</h2>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Действие сгенерирует временный пароль для аккаунта <span className="font-medium text-[var(--foreground)]">{targetSummary}</span> и принудит пользователя сменить его при следующем входе.
          </p>
        </div>

        <div className="rounded-2xl border border-[#d7c4b6] bg-[#fff5eb] px-4 py-3 text-sm leading-6 text-[#7a3f1d]">
          Временный пароль показывается только один раз после успешного выполнения. Он не попадает в URL, query params и историю страницы.
        </div>

        <form
          action={(formData) => {
            const comment = String(formData.get("comment") ?? "");

            startResetTransition(async () => {
              setResetResult(null);
              const result = await resetPasswordWithTempPasswordAdminAction({
                targetAccountId: accountId,
                comment,
              });

              setResetResult(result);
            });
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor={`reset-comment-${accountId}`}>
              Comment / reason
            </label>
            <textarea
              className="min-h-28 w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:bg-white"
              id={`reset-comment-${accountId}`}
              name="comment"
              placeholder="Почему нужен admin reset password"
              required
            />
          </div>

          <Button disabled={resetPending} fullWidth type="submit">
            {resetPending ? "Генерируем временный пароль..." : "Сгенерировать временный пароль"}
          </Button>
        </form>

        {resetResult && "tempPassword" in resetResult ? (
          <div className="space-y-3 rounded-2xl border border-[#c9d8c3] bg-[#eef7ea] px-4 py-3 text-sm leading-6 text-[#254d1d]">
            <p>{resetResult.message}</p>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[#537548]">Temp password</p>
              <p className="mt-2 break-all rounded-2xl border border-[#c9d8c3] bg-white/90 px-3 py-2 font-mono text-base text-[#153012]">
                {resetResult.tempPassword}
              </p>
            </div>
            <Button
              onClick={() => setResetResult(null)}
              type="button"
              variant="secondary"
            >
              Скрыть временный пароль
            </Button>
          </div>
        ) : null}

        {resetResult && !("tempPassword" in resetResult) ? <ResultMessage result={resetResult} /> : null}
      </Card>

      <Card className="space-y-5">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Email</p>
          <h2 className="text-2xl font-semibold">Сменить email как admin</h2>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Действие обновит подтверждённый email аккаунта, очистит `pendingEmail` и не затронет `login`.
          </p>
        </div>

        <form
          action={(formData) => {
            const newEmail = String(formData.get("newEmail") ?? "");
            const comment = String(formData.get("comment") ?? "");

            startEmailTransition(async () => {
              setEmailChangeResult(null);
              const result = await changeEmailAsAdminAction({
                targetAccountId: accountId,
                newEmail,
                comment,
              });

              setEmailChangeResult(result);
            });
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor={`admin-new-email-${accountId}`}>
              Новый email
            </label>
            <Input
              autoCapitalize="none"
              autoComplete="email"
              id={`admin-new-email-${accountId}`}
              name="newEmail"
              placeholder="updated@example.com"
              required
              type="email"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor={`admin-email-comment-${accountId}`}>
              Comment / reason
            </label>
            <textarea
              className="min-h-28 w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:bg-white"
              id={`admin-email-comment-${accountId}`}
              name="comment"
              placeholder="Почему требуется принудительная смена email"
              required
            />
          </div>

          <Button disabled={emailPending} fullWidth type="submit">
            {emailPending ? "Обновляем email..." : "Сменить email аккаунта"}
          </Button>
        </form>

        <ResultMessage result={emailChangeResult} />
      </Card>
    </div>
  );
}
