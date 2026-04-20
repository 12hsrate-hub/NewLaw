import { ChangeEmailForm } from "@/components/product/security/change-email-form";
import { ChangePasswordForm } from "@/components/product/security/change-password-form";
import { Card } from "@/components/ui/card";

type AccountSecuritySectionProps = {
  accountEmail: string;
  accountLogin: string;
  mustChangePassword: boolean;
  pendingEmail: string | null;
  status?: string | null;
};

const statusMessages: Record<string, string> = {
  "email-change-confirmed":
    "Новый email подтверждён. Аккаунт уже синхронизирован с Supabase Auth и будет использовать обновлённый адрес.",
  "email-change-requested":
    "Письмо для подтверждения нового email отправлено. Старый подтверждённый адрес продолжает работать, пока не будет завершено подтверждение.",
  "must-change-password":
    "Для продолжения работы аккаунт требует обязательной смены пароля. Остальные защищённые действия временно ограничены.",
};

export function AccountSecuritySection({
  accountEmail,
  accountLogin,
  mustChangePassword,
  pendingEmail,
  status,
}: AccountSecuritySectionProps) {
  const statusMessage = status ? statusMessages[status] ?? null : null;

  return (
    <section className="space-y-6">
      {statusMessage ? (
        <div className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3 text-sm leading-6">
          {statusMessage}
        </div>
      ) : null}

      <Card className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Безопасность аккаунта</p>
          <h1 className="text-3xl font-semibold">Настройки аккаунта</h1>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Здесь управляются пароль и подтверждённый email аккаунта. `login` остаётся неизменяемым и продолжает вести на тот же аккаунт.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.7)] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Подтверждённый email</p>
            <p className="mt-2 text-lg font-medium">{accountEmail}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.7)] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Account login</p>
            <p className="mt-2 text-lg font-medium">{accountLogin}</p>
          </div>
        </div>

        {pendingEmail ? (
          <div className="rounded-2xl border border-[#d7c4b6] bg-[#fff5eb] px-4 py-3 text-sm leading-6 text-[#7a3f1d]">
            Ожидается подтверждение нового email: <span className="font-medium">{pendingEmail}</span>. Пока подтверждение не завершено, вход и recovery продолжают работать через текущий подтверждённый email или через `login`.
          </div>
        ) : null}
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChangePasswordForm mustChangePassword={mustChangePassword} />
        <ChangeEmailForm currentEmail={accountEmail} mustChangePassword={mustChangePassword} />
      </div>
    </section>
  );
}
