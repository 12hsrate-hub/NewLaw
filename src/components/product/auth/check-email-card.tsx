import Link from "next/link";

import { defaultAuthenticatedLandingPath } from "@/lib/auth/email-auth";
import { Card } from "@/components/ui/card";

type AuthEmailFlow = "signup" | "recovery";

type CheckEmailCardProps = {
  flow: AuthEmailFlow;
  nextPath?: string;
};

const flowContent: Record<
  AuthEmailFlow,
  {
    description: string;
    secondaryLink: {
      href: string;
      label: string;
    };
    title: string;
  }
> = {
  signup: {
    title: "Письмо отправлено",
    description:
      "Мы отправили письмо с подтверждением почты. Открой ссылку из письма, чтобы завершить регистрацию.",
    secondaryLink: {
      href: "/sign-up",
      label: "Зарегистрироваться заново",
    },
  },
  recovery: {
    title: "Проверьте почту",
    description:
      "Если аккаунт существует, письмо с инструкцией для восстановления пароля уже отправлено. Открой самое свежее письмо и перейди по ссылке из него.",
    secondaryLink: {
      href: "/forgot-password",
      label: "Запросить письмо ещё раз",
    },
  },
};

export function CheckEmailCard({
  flow,
  nextPath = defaultAuthenticatedLandingPath,
}: CheckEmailCardProps) {
  const content = flowContent[flow];

  return (
    <Card className="w-full max-w-md space-y-5">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Проверьте почту</p>
        <h1 className="text-3xl font-semibold">{content.title}</h1>
        <p className="text-sm leading-6 text-[var(--muted)]">{content.description}</p>
      </div>

      <div className="space-y-3 text-sm leading-6 text-[var(--muted)]">
        <p>Если письмо не пришло, проверь папки «Спам» и «Промоакции».</p>
        {flow === "signup" ? (
          <p>После подтверждения можно будет сразу перейти ко входу.</p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <Link
          className="font-medium text-[var(--accent)]"
          href={`/sign-in?next=${encodeURIComponent(nextPath)}`}
        >
          Перейти ко входу
        </Link>
        <Link
          className="font-medium text-[var(--accent)]"
          href={`${content.secondaryLink.href}?next=${encodeURIComponent(nextPath)}`}
        >
          {content.secondaryLink.label}
        </Link>
      </div>
    </Card>
  );
}
