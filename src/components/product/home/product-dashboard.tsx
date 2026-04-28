import type { ReactNode } from "react";

import { ButtonLink } from "@/components/ui/button-link";
import { EmptyState } from "@/components/ui/empty-state";
import { QuickActionCard } from "@/components/ui/quick-action-card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { WorkspaceSurface } from "@/components/ui/workspace-surface";
import type { HomeDashboardContext } from "@/server/home/dashboard";

type DashboardToolCard = {
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  tone: "primary" | "secondary";
  icon: ReactNode;
};

function DashboardIcon(props: { children: ReactNode }) {
  return (
    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--divider)] bg-[var(--surface-subtle)] text-[var(--accent)]">
      <svg
        aria-hidden="true"
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        {props.children}
      </svg>
    </span>
  );
}

function SparkIcon() {
  return (
    <DashboardIcon>
      <path
        d="M12 3L13.9 8.1L19 10L13.9 11.9L12 17L10.1 11.9L5 10L10.1 8.1L12 3Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </DashboardIcon>
  );
}

function DocumentIcon() {
  return (
    <DashboardIcon>
      <path
        d="M8 4.75H13.5L17.25 8.5V19.25H8V4.75Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <path d="M13 4.75V9H17.25" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.6" />
      <path d="M10.25 12H15" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
      <path d="M10.25 15H15" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
    </DashboardIcon>
  );
}

function ShieldIcon() {
  return (
    <DashboardIcon>
      <path
        d="M12 3.75L18 6.25V11.2C18 14.88 15.68 18.19 12 20.4C8.32 18.19 6 14.88 6 11.2V6.25L12 3.75Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <path d="M9.75 10.75H14.25" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
      <path d="M12 8.75V12.75" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
    </DashboardIcon>
  );
}

function InternalIcon() {
  return (
    <DashboardIcon>
      <path
        d="M12 5.25L17.25 8.25V15.75L12 18.75L6.75 15.75V8.25L12 5.25Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <path d="M12 9V15" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
      <path d="M9.5 12H14.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
    </DashboardIcon>
  );
}

export function ProductDashboard(props: {
  context: HomeDashboardContext;
}) {
  const { context } = props;
  const activeServerName = context.activeServer.name ?? "Не выбран";
  const quickActionCount = [
    context.quickActions.assistantHref,
    context.quickActions.documentsHref,
    context.quickActions.lawyerWorkspaceHref,
    context.quickActions.serversHref,
    context.quickActions.accountHref,
    context.quickActions.internalHref,
  ].filter(Boolean).length;
  const toolCards: DashboardToolCard[] = [
    {
      title: "Юридический помощник",
      description:
        "Открывайте общий вход в помощник и переходите к нужному серверу, когда понадобится рабочий контекст.",
      href: context.tools.assistant.href,
      actionLabel: "Открыть помощника",
      tone: "primary" as const,
      icon: <SparkIcon />,
    },
    {
      title: "Документы",
      description:
        "Документы открываются по выбранному серверу. Главная только помогает быстро перейти в нужный раздел.",
      href: context.tools.documents.href,
      actionLabel: context.tools.documents.actionLabel,
      tone: "secondary" as const,
      icon: <DocumentIcon />,
    },
    ...(context.tools.lawyer
      ? [
          {
          title: "Адвокатский кабинет",
          description:
            "Доверители, договоры, адвокатские запросы и работа в интересах доверителя.",
          href: context.tools.lawyer.href,
          actionLabel: "Открыть адвокатский кабинет",
          tone: "secondary" as const,
          icon: <ShieldIcon />,
          },
        ]
      : []),
    ...(context.tools.internal
      ? [
          {
          title: "Служебная зона",
          description:
            "Скрытая служебная зона доступна только пользователям с соответствующим доступом.",
          href: context.tools.internal.href,
          actionLabel: "Открыть служебную зону",
          tone: "secondary" as const,
          icon: <InternalIcon />,
          },
        ]
      : []),
  ];
  const availableToolCount = toolCards.length;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <WorkspaceSurface className="space-y-6 bg-[linear-gradient(145deg,rgba(194,154,84,0.12),rgba(27,34,43,0.94)_32%,rgba(20,26,32,0.98)_100%)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Главная</p>
              <div className="space-y-3">
                <h1 className="max-w-4xl text-3xl font-semibold tracking-[-0.03em] md:text-4xl xl:text-[2.8rem]">
                  Панель управления Lawyer5RP
                </h1>
                <p className="max-w-3xl text-sm leading-7 text-[var(--muted)] md:text-base">
                  Создавайте документы, работайте с доверителями и открывайте юридический
                  помощник из одной рабочей панели.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <ButtonLink href={context.quickActions.assistantHref} variant="primary">
                  Открыть помощник
                </ButtonLink>
                <ButtonLink href={context.quickActions.documentsHref} variant="secondary">
                  Создать документ
                </ButtonLink>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {context.activeServer.name ? (
                <StatusBadge tone="warning">Активный сервер: {context.activeServer.name}</StatusBadge>
              ) : (
                <StatusBadge tone="neutral">Активный сервер пока не выбран</StatusBadge>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <StatCard
              helperText={
                context.activeServer.name
                  ? "Текущий сервер используется как рабочий контекст для server-scoped разделов."
                  : "Выберите сервер в шапке, чтобы быстрее переходить к документам и связанным разделам."
              }
              label="Активный сервер"
              tone={context.activeServer.name ? "warning" : "neutral"}
              value={activeServerName}
            />
            <StatCard
              helperText="Доступные переходы собирают основные рабочие входы в одну панель."
              label="Быстрые действия"
              tone="success"
              value={String(quickActionCount)}
            />
            <StatCard
              helperText="Главная показывает только те разделы, которые доступны в текущем контексте."
              label="Основные инструменты"
              tone={context.tools.lawyer ? "success" : "neutral"}
              value={String(availableToolCount)}
            />
          </div>
        </WorkspaceSurface>

        <section className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Инструменты</p>
            <h2 className="text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
              Основные разделы
            </h2>
            <p className="max-w-3xl text-sm leading-7 text-[var(--muted)] md:text-base">
              Открывайте нужный модуль напрямую из рабочей панели без лишних переходов по
              разделам аккаунта.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {toolCards.map((tool) => (
              <QuickActionCard
                actionLabel={tool.actionLabel}
                className="h-full justify-between"
                description={tool.description}
                href={tool.href}
                icon={tool.icon}
                key={`${tool.href}:${tool.title}`}
                title={tool.title}
                tone={tool.tone}
              />
            ))}
          </div>
        </section>
      </div>

      <div className="space-y-4">
        <EmptyState
          description={context.placeholders.requiresAttention}
          title="Требуется внимание"
        />

        <EmptyState
          description={context.placeholders.recentActivity}
          title="Последняя активность"
        />

        <EmptyState
          description="Когда появятся сохранённые черновики, они будут отображаться здесь без дублирования маршрутов и быстрых кнопок."
          title="Черновики"
        />

        <EmptyState
          description="Служебные уведомления, статусные сигналы и напоминания появятся здесь, когда для них появятся реальные данные."
          title="Системные уведомления"
        />
      </div>
    </div>
  );
}
