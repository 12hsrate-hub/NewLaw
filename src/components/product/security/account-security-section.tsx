import { ChangeEmailForm } from "@/components/product/security/change-email-form";
import { ChangePasswordForm } from "@/components/product/security/change-password-form";
import { Card } from "@/components/ui/card";
import { EmbeddedCard } from "@/components/ui/embedded-card";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusBadge } from "@/components/ui/status-badge";

type AccountSecuritySectionProps = {
  accountEmail: string;
  accountLogin: string;
  mustChangePassword: boolean;
  pendingEmail: string | null;
  status?: string | null;
};

const statusMessages: Record<string, string> = {
  "admin-access-denied":
    "Этот раздел недоступен. Здесь можно управлять только безопасностью своего аккаунта.",
  "email-change-confirmed":
    "Новый email подтверждён. Теперь аккаунт будет использовать обновлённый адрес.",
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
        <EmbeddedCard className="border-[rgba(184,135,57,0.3)] bg-[rgba(122,88,34,0.18)] text-[#f0d4a0]">
          <p className="text-sm leading-6">{statusMessage}</p>
        </EmbeddedCard>
      ) : null}

      <Card className="space-y-4">
        <SectionHeader
          description="Здесь можно сменить пароль, обновить email и проверить данные для входа. Логин пока нельзя изменить."
          eyebrow="Безопасность аккаунта"
          title="Настройки аккаунта"
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <EmbeddedCard className="space-y-2">
            <StatusBadge tone="neutral">Подтверждённый email</StatusBadge>
            <p className="text-lg font-medium">{accountEmail}</p>
          </EmbeddedCard>
          <EmbeddedCard className="space-y-2">
            <StatusBadge tone="neutral">Логин</StatusBadge>
            <p className="text-lg font-medium">{accountLogin}</p>
          </EmbeddedCard>
        </div>

        {pendingEmail ? (
          <EmbeddedCard className="border-[rgba(184,135,57,0.3)] bg-[rgba(122,88,34,0.18)] text-[#f0d4a0]">
            Ожидается подтверждение нового email: <span className="font-medium">{pendingEmail}</span>. Пока подтверждение не завершено, вход и восстановление доступа работают через текущий email или логин.
          </EmbeddedCard>
        ) : null}
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChangePasswordForm mustChangePassword={mustChangePassword} />
        <ChangeEmailForm currentEmail={accountEmail} mustChangePassword={mustChangePassword} />
      </div>
    </section>
  );
}
