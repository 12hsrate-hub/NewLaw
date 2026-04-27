import Link from "next/link";

import { ProductActionCard } from "@/components/product/foundation/product-action-card";
import { WorkspaceCard } from "@/components/product/foundation/workspace-card";
import { EmbeddedCard } from "@/components/ui/embedded-card";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusBadge } from "@/components/ui/status-badge";
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
          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--foreground)] hover:bg-[var(--accent-soft-strong)]"
          : "border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]",
        props.className,
      )}
      href={props.href}
    >
      {props.children}
    </Link>
  );
}

export function ProductDashboard(props: {
  context: HomeDashboardContext;
}) {
  const { context } = props;

  return (
    <div className="space-y-6">
      <EmbeddedCard className="space-y-5">
        <SectionHeader
          description="Это точка входа в юридический помощник, серверы, документы и настройки аккаунта. Главная страница не заменяет раздел документов и не подменяет собой личный кабинет."
          eyebrow="Главная"
          meta={
            context.activeServer.name ? (
              <StatusBadge tone="warning">Активный сервер: {context.activeServer.name}</StatusBadge>
            ) : (
              <StatusBadge tone="neutral">Активный сервер пока не выбран</StatusBadge>
            )
          }
          title="Панель инструментов"
        />
      </EmbeddedCard>

      <EmbeddedCard className="space-y-4">
        <SectionHeader
          description="Выберите нужный инструмент и продолжайте работу из общей панели без перехода через account-first landing."
          eyebrow="Быстрые действия"
          title="С чего начать"
        />
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
      </EmbeddedCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <ProductActionCard
          eyebrow="Инструмент"
          description="Открывайте общий вход в помощник и переходите к нужному серверу, когда понадобится рабочий контекст."
          helperText={context.tools.assistant.helperText}
          primaryAction={{
            href: context.tools.assistant.href,
            label: "Открыть помощника",
          }}
          title="Юридический помощник"
        />

        <ProductActionCard
          eyebrow="Инструмент"
          description="Документы открываются по выбранному серверу. Главная только помогает быстро перейти в нужный раздел."
          helperText={context.tools.documents.helperText}
          primaryAction={{
            href: context.tools.documents.href,
            label: context.tools.documents.actionLabel,
          }}
          title="Документы"
        />

        {context.tools.lawyer ? (
          <ProductActionCard
            eyebrow="Инструмент"
            description="Доверители, договоры, адвокатские запросы и работа в интересах доверителя."
            primaryAction={{
              href: context.tools.lawyer.href,
              label: "Открыть адвокатский кабинет",
            }}
            title="Адвокатский кабинет"
          />
        ) : null}

        <ProductActionCard
          eyebrow="Инструмент"
          description="Открывайте список серверов, чтобы выбрать рабочий контекст и перейти к доступным разделам."
          primaryAction={{
            href: context.tools.servers.href,
            label: "Открыть серверы",
          }}
          title="Серверы"
        />

        <ProductActionCard
          eyebrow="Инструмент"
          description="Настройки аккаунта, безопасность, персонажи, доверители и обзор документов собраны в отдельной зоне."
          primaryAction={{
            href: context.tools.account.href,
            label: "Открыть аккаунт",
          }}
          title="Аккаунт"
        />

        {context.tools.internal ? (
          <ProductActionCard
            eyebrow="Инструмент"
            description="Скрытая служебная зона доступна только пользователям с соответствующим доступом."
            primaryAction={{
              href: context.tools.internal.href,
              label: "Открыть служебную зону",
            }}
            title="Служебная зона"
          />
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <WorkspaceCard
          description={context.placeholders.requiresAttention}
          eyebrow="Требуется внимание"
          title="Что проверить дальше"
        />

        <WorkspaceCard
          description={context.placeholders.recentActivity}
          eyebrow="Последняя активность"
          title="Что появится позже"
        />
      </div>
    </div>
  );
}
