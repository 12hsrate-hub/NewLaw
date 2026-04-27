import type { ReactNode } from "react";

import Link from "next/link";

import { AccessBlockedCard } from "@/components/product/foundation/access-blocked-card";
import { EmptyStateCard } from "@/components/product/foundation/empty-state-card";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusBadge } from "@/components/ui/status-badge";
import type { LawyerWorkspaceRouteContext } from "@/server/lawyer-workspace/context";
import { cn } from "@/utils/cn";

function WorkspaceLink(props: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      className={cn(
        "inline-flex items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-hover)]",
        props.className,
      )}
      href={props.href}
    >
      {props.children}
    </Link>
  );
}

function LawyerWorkspaceNotFoundState(props: {
  requestedServerSlug: string;
}) {
  return (
    <EmptyStateCard
      description={`Не удалось открыть сервер с адресом ${props.requestedServerSlug}. Выберите другой сервер и вернитесь к нужному рабочему контексту.`}
      eyebrow="Адвокатский кабинет"
      primaryAction={{
        href: "/servers",
        label: "Вернуться к серверам",
      }}
      title="Сервер не найден"
    />
  );
}

function LawyerWorkspaceBlockedState(props: {
  title: string;
  description: string;
  server: {
    name: string;
  };
  charactersHref: string;
  showAccessRequestHint?: boolean;
}) {
  return (
    <div className="space-y-6">
      <AccessBlockedCard
        badges={[`Сервер: ${props.server.name}`]}
        description={props.description}
        eyebrow="Адвокатский кабинет"
        helperText={
          props.showAccessRequestHint
            ? "Если персонаж уже готов, адвокатский доступ оформляется через его заявку и дальнейшее рассмотрение."
            : null
        }
        primaryAction={{
          href: props.charactersHref,
          label: "Открыть персонажей сервера",
        }}
        secondaryAction={{
          href: "/servers",
          label: "Вернуться к серверам",
        }}
        title={props.title}
      />
    </div>
  );
}

function WorkspaceActionCard(props: {
  eyebrow: string;
  title: string;
  description: string;
  helperText?: string | null;
  actions: Array<{
    href: string;
    label: string;
  }>;
}) {
  return (
    <Card className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">{props.eyebrow}</p>
        <h2 className="text-2xl font-semibold">{props.title}</h2>
        <p className="text-sm leading-6 text-[var(--muted)]">{props.description}</p>
        {props.helperText ? (
          <p className="text-sm leading-6 text-[var(--muted)]">{props.helperText}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-3">
        {props.actions.map((action) => (
          <WorkspaceLink href={action.href} key={action.href}>
            {action.label}
          </WorkspaceLink>
        ))}
      </div>
    </Card>
  );
}

export function LawyerWorkspaceFoundation(props: {
  context: LawyerWorkspaceRouteContext;
}) {
  const { context } = props;

  if (context.status === "server_not_found") {
    return <LawyerWorkspaceNotFoundState requestedServerSlug={context.requestedServerSlug} />;
  }

  if (context.status === "no_characters") {
    return (
      <LawyerWorkspaceBlockedState
        charactersHref={context.compatibilityHrefs.charactersHref}
        description="Для адвокатского кабинета сначала нужен персонаж на этом сервере."
        server={context.server}
        title="Сначала нужен персонаж"
      />
    );
  }

  if (context.status === "no_advocate_access") {
    return (
      <LawyerWorkspaceBlockedState
        charactersHref={context.compatibilityHrefs.charactersHref}
        description="Для адвокатского кабинета нужен персонаж с адвокатским доступом."
        server={context.server}
        showAccessRequestHint={context.workspaceCapabilities.blockReasons.includes(
          "access_request_required",
        )}
        title="Нужен адвокатский доступ"
      />
    );
  }

  const blockReasons = context.documentEntryCapabilities.blockReasons;
  const showAttorneyTrustorNote =
    blockReasons.includes("trustor_required_temporarily") &&
    !context.documentEntryCapabilities.canCreateAttorneyRequest;
  const showAgreementTrustorNote =
    blockReasons.includes("trustor_required_temporarily") &&
    !context.documentEntryCapabilities.canCreateLegalServicesAgreement;

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <SectionHeader
          description="Здесь собраны основные адвокатские действия по выбранному серверу: доверители, договоры, запросы и работа в интересах доверителя."
          eyebrow="Адвокатский кабинет"
          meta={
            <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-[var(--muted)]">
              <StatusBadge tone="warning">Сервер: {context.server.name}</StatusBadge>
              <StatusBadge tone="warning">Персонаж: {context.selectedCharacter.fullName}</StatusBadge>
              <span>Паспорт: {context.selectedCharacter.passportNumber}</span>
              <span>
                Выбор:{" "}
                {context.selectedCharacter.source === "last_used"
                  ? "последний использованный"
                  : "первый доступный"}
              </span>
            </div>
          }
          title="Адвокатский кабинет"
        />
        <div className="flex flex-wrap gap-3">
          <WorkspaceLink href={context.compatibilityHrefs.trustorsHref}>
            Открыть доверителей
          </WorkspaceLink>
          <WorkspaceLink href={context.compatibilityHrefs.trustorCreateHref}>
            Добавить доверителя
          </WorkspaceLink>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <WorkspaceActionCard
          actions={[
            {
              href: context.compatibilityHrefs.trustorsHref,
              label: "Открыть доверителей",
            },
            {
              href: context.compatibilityHrefs.trustorCreateHref,
              label: "Добавить доверителя",
            },
          ]}
          description={
            context.trustorCount > 0
              ? `Доверителей на сервере: ${context.trustorCount}. Список доверителей пока открывается через раздел аккаунта, но относится к выбранному серверу.`
              : "Доверителей пока нет. Добавьте доверителя перед созданием договора или адвокатского запроса."
          }
          eyebrow="Основное действие"
          title="Доверители"
        />

        <WorkspaceActionCard
          actions={[
            {
              href: context.compatibilityHrefs.agreementsHref,
              label: "Открыть договоры",
            },
            {
              href: context.compatibilityHrefs.agreementCreateHref,
              label: "Создать договор",
            },
          ]}
          description="Договоры открываются через текущий раздел документов по выбранному серверу."
          helperText={
            showAgreementTrustorNote
              ? "В текущей версии для этого действия нужен сохранённый доверитель."
              : null
          }
          eyebrow="Адвокатские документы"
          title="Договоры на оказание юридических услуг"
        />

        <WorkspaceActionCard
          actions={[
            {
              href: context.compatibilityHrefs.attorneyRequestsHref,
              label: "Открыть запросы",
            },
            {
              href: context.compatibilityHrefs.attorneyRequestCreateHref,
              label: "Создать запрос",
            },
          ]}
          description="Адвокатские запросы открываются через текущий раздел документов по выбранному серверу."
          helperText={
            showAttorneyTrustorNote
              ? "В текущей версии для этого действия нужен сохранённый доверитель."
              : null
          }
          eyebrow="Адвокатские документы"
          title="Адвокатские запросы"
        />

        <WorkspaceActionCard
          actions={[
            {
              href: context.compatibilityHrefs.trustorsHref,
              label: "Открыть доверителей",
            },
            {
              href: context.compatibilityHrefs.agreementsHref,
              label: "Открыть договоры",
            },
            {
              href: context.compatibilityHrefs.attorneyRequestsHref,
              label: "Открыть запросы",
            },
          ]}
          description="Для работы в интересах доверителя используйте список доверителей, договоры и адвокатские запросы как основные точки входа."
          eyebrow="Работа с доверителем"
          title="Документы в интересах доверителя"
        />

        <Card className="space-y-4 lg:col-span-2">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">Следующий шаг</p>
            <h2 className="text-2xl font-semibold">Незавершённые действия</h2>
            <p className="text-sm leading-6 text-[var(--muted)]">
              Здесь позже появятся незавершённые адвокатские действия и быстрые продолжения
              работы. В первой версии кабинет фиксирует только основные входы и честные blocked
              states.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
