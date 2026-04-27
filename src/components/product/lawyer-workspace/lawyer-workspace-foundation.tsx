import type { ReactNode } from "react";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
        "inline-flex items-center justify-center rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-white",
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
    <Card className="space-y-3">
      <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Адвокатский кабинет</p>
      <h1 className="text-3xl font-semibold">Сервер не найден</h1>
      <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
        Не удалось открыть сервер с адресом {props.requestedServerSlug}. Вернитесь к списку
        серверов и выберите нужный рабочий контекст снова.
      </p>
      <div className="flex flex-wrap gap-3">
        <WorkspaceLink href="/servers">Вернуться к серверам</WorkspaceLink>
      </div>
    </Card>
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
      <Card className="space-y-4">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Адвокатский кабинет</p>
          <h1 className="text-3xl font-semibold">{props.title}</h1>
          <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">{props.description}</p>
          {props.showAccessRequestHint ? (
            <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Если персонаж уже готов, адвокатский доступ оформляется через его заявку и дальнейшее
              рассмотрение.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-[var(--muted)]">
          <Badge>Сервер: {props.server.name}</Badge>
        </div>
        <div className="flex flex-wrap gap-3">
          <WorkspaceLink href={props.charactersHref}>Открыть персонажей сервера</WorkspaceLink>
          <WorkspaceLink href="/servers">Вернуться к серверам</WorkspaceLink>
        </div>
      </Card>
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
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Адвокатский кабинет</p>
          <h1 className="text-3xl font-semibold">Адвокатский кабинет</h1>
          <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
            Здесь собраны входы в адвокатские сценарии по выбранному серверу. В первой версии
            кабинет использует уже существующие совместимые маршруты документов и доверителей.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-[var(--muted)]">
          <Badge>Сервер: {context.server.name}</Badge>
          <Badge>Персонаж: {context.selectedCharacter.fullName}</Badge>
          <span>Паспорт: {context.selectedCharacter.passportNumber}</span>
          <span>
            Выбор:{" "}
            {context.selectedCharacter.source === "last_used"
              ? "последний использованный"
              : "первый доступный"}
          </span>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <WorkspaceActionCard
          actions={[
            {
              href: context.compatibilityHrefs.trustorsHref,
              label: "Открыть доверителей",
            },
          ]}
          description={`Сохранённых доверителей на этом сервере: ${context.trustorCount}. В текущей версии это совместимый маршрут аккаунта.`}
          eyebrow="Совместимый маршрут"
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
          description="Работа с договорами пока открывается через уже существующий server-scoped documents route."
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
          description="Адвокатские запросы продолжают работать через существующие documents routes без переноса редакторов."
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
          description="Пока отдельный route для документов в интересах доверителя не вводится. Для работы используйте доверителей, договоры и адвокатские запросы как текущие точки входа."
          eyebrow="Текущая рабочая схема"
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
