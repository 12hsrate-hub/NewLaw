import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { HomeDashboardContext } from "@/server/home/dashboard";
import { cn } from "@/utils/cn";

function DashboardLink(props: {
  href: string;
  children: string;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  return (
    <Link
      className={cn(
        "inline-flex items-center justify-center rounded-2xl border px-4 py-2.5 text-sm font-medium transition",
        props.variant === "primary"
          ? "border-[var(--accent)] bg-[rgba(141,79,49,0.12)] text-[var(--foreground)] hover:bg-[rgba(141,79,49,0.18)]"
          : "border-[var(--border)] bg-white/70 text-[var(--foreground)] hover:bg-white",
        props.className,
      )}
      href={props.href}
    >
      {props.children}
    </Link>
  );
}

function ToolCard(props: {
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  helperText?: string | null;
}) {
  return (
    <Card className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">Инструмент</p>
        <h2 className="text-2xl font-semibold">{props.title}</h2>
        <p className="text-sm leading-6 text-[var(--muted)]">{props.description}</p>
        {props.helperText ? (
          <p className="text-sm leading-6 text-[var(--muted)]">{props.helperText}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-3">
        <DashboardLink href={props.href}>{props.actionLabel}</DashboardLink>
      </div>
    </Card>
  );
}

export function ProductDashboard(props: {
  context: HomeDashboardContext;
}) {
  const { context } = props;

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Главная</p>
          <h1 className="text-3xl font-semibold">Панель инструментов</h1>
          <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
            Это точка входа в юридический помощник, серверы, документы и настройки аккаунта. Главная
            страница не заменяет раздел документов и не подменяет собой личный кабинет.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-[var(--muted)]">
          {context.activeServer.name ? (
            <Badge>Активный сервер: {context.activeServer.name}</Badge>
          ) : (
            <Badge>Активный сервер пока не выбран</Badge>
          )}
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">Быстрые действия</p>
          <h2 className="text-2xl font-semibold">С чего начать</h2>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Выберите нужный инструмент и продолжайте работу из общей панели без перехода через
            account-first landing.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <DashboardLink href={context.quickActions.assistantHref} variant="primary">
            Открыть юридический помощник
          </DashboardLink>
          <DashboardLink href={context.quickActions.documentsHref}>Создать документ</DashboardLink>
          {context.quickActions.lawyerWorkspaceHref ? (
            <DashboardLink href={context.quickActions.lawyerWorkspaceHref}>
              Открыть адвокатский кабинет
            </DashboardLink>
          ) : null}
          <DashboardLink href={context.quickActions.serversHref}>Открыть серверы</DashboardLink>
          <DashboardLink href={context.quickActions.accountHref}>Открыть настройки аккаунта</DashboardLink>
          {context.quickActions.internalHref ? (
            <DashboardLink href={context.quickActions.internalHref}>Служебная зона</DashboardLink>
          ) : null}
        </div>
        {context.quickActions.documentsHelperText ? (
          <p className="text-sm leading-6 text-[var(--muted)]">
            {context.quickActions.documentsHelperText}
          </p>
        ) : null}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <ToolCard
          actionLabel="Открыть помощника"
          description="Открывайте общий вход в помощник и переходите к нужному серверу, когда понадобится рабочий контекст."
          helperText={context.tools.assistant.helperText}
          href={context.tools.assistant.href}
          title="Юридический помощник"
        />

        <ToolCard
          actionLabel={context.tools.documents.actionLabel}
          description="Документы открываются по выбранному серверу. Главная только помогает быстро перейти в нужный раздел."
          helperText={context.tools.documents.helperText}
          href={context.tools.documents.href}
          title="Документы"
        />

        {context.tools.lawyer ? (
          <ToolCard
            actionLabel="Открыть адвокатский кабинет"
            description="Доверители, договоры, адвокатские запросы и работа в интересах доверителя."
            href={context.tools.lawyer.href}
            title="Адвокатский кабинет"
          />
        ) : null}

        <ToolCard
          actionLabel="Открыть серверы"
          description="Открывайте список серверов, чтобы выбрать рабочий контекст и перейти к доступным разделам."
          href={context.tools.servers.href}
          title="Серверы"
        />

        <ToolCard
          actionLabel="Открыть аккаунт"
          description="Настройки аккаунта, безопасность, персонажи, доверители и обзор документов собраны в отдельной зоне."
          href={context.tools.account.href}
          title="Аккаунт"
        />

        {context.tools.internal ? (
          <ToolCard
            actionLabel="Открыть служебную зону"
            description="Скрытая служебная зона доступна только пользователям с соответствующим доступом."
            href={context.tools.internal.href}
            title="Служебная зона"
          />
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3">
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">Требуется внимание</p>
          <h2 className="text-2xl font-semibold">Что проверить дальше</h2>
          <p className="text-sm leading-6 text-[var(--muted)]">
            {context.placeholders.requiresAttention}
          </p>
        </Card>

        <Card className="space-y-3">
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">Последняя активность</p>
          <h2 className="text-2xl font-semibold">Что появится позже</h2>
          <p className="text-sm leading-6 text-[var(--muted)]">
            {context.placeholders.recentActivity}
          </p>
        </Card>
      </div>
    </div>
  );
}
