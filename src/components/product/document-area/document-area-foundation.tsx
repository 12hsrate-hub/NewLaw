import type { ReactNode } from "react";

import Link from "next/link";

import { AccessBlockedCard } from "@/components/product/foundation/access-blocked-card";
import { EmptyStateCard } from "@/components/product/foundation/empty-state-card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button-link";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PanelCard } from "@/components/ui/panel-card";
import { SectionHeader } from "@/components/ui/section-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { WarningNotice } from "@/components/ui/warning-notice";
import { WorkspaceSurface } from "@/components/ui/workspace-surface";
import type { DocumentAreaServerSummary } from "@/server/document-area/context";
import type {
  DocumentEntryCapabilities,
  WorkspaceCapabilities,
} from "@/server/navigation/capabilities";
import { cn } from "@/utils/cn";

function FoundationLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      className={cn(
        "inline-flex items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-hover)]",
        className,
      )}
      href={href}
    >
      {children}
    </Link>
  );
}

export function AccountZoneFoundationIntro(props: {
  isSuperAdmin?: boolean;
}) {
  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <SectionHeader
          description="Здесь собраны настройки аккаунта, безопасность, доступы и служебные обзорные разделы. Работа по конкретному серверу открывается из отдельных серверных зон, а эта страница помогает быстро перейти к нужным настройкам и обзорным разделам."
          eyebrow="Аккаунт"
          title="Аккаунт"
        />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">
              Настройки и безопасность
            </p>
            <h2 className="text-2xl font-semibold">Безопасность и данные аккаунта</h2>
            <p className="text-sm leading-6 text-[var(--muted)]">
              Управляйте данными входа, безопасностью и подключением форума. Это основная зона для
              служебных настроек аккаунта.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <FoundationLink href="/account/security">Открыть безопасность</FoundationLink>
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">
              Совместимый обзор
            </p>
            <h2 className="text-2xl font-semibold">Персонажи</h2>
            <p className="text-sm leading-6 text-[var(--muted)]">
              Здесь остаётся удобный обзор персонажей по серверам. Рабочие сценарии по серверу
              продолжаются из серверных разделов.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <FoundationLink href="/account/characters">Открыть персонажей</FoundationLink>
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">
              Совместимый обзор
            </p>
            <h2 className="text-2xl font-semibold">Доверители</h2>
            <p className="text-sm leading-6 text-[var(--muted)]">
              Доверители пока остаются в аккаунте как совместимый и удобный обзорный раздел без
              изменения текущей модели данных.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <FoundationLink href="/account/trustors">Открыть доверителей</FoundationLink>
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">
              Совместимый обзор
            </p>
            <h2 className="text-2xl font-semibold">Обзор документов</h2>
            <p className="text-sm leading-6 text-[var(--muted)]">
              Этот раздел собирает сохранённые документы по серверам. Создание и редактирование
              документов по-прежнему открываются из разделов конкретного сервера.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <FoundationLink href="/account/documents">Открыть обзор документов</FoundationLink>
          </div>
        </Card>

        {props.isSuperAdmin ? (
          <Card className="space-y-4 lg:col-span-2">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">
                Служебные разделы
              </p>
              <h2 className="text-2xl font-semibold">Доступы и заявки</h2>
              <p className="text-sm leading-6 text-[var(--muted)]">
                Для пользователей с расширенным доступом здесь остаётся быстрый переход в
                служебный раздел заявок.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <FoundationLink href="/internal/access-requests">Открыть заявки на доступ</FoundationLink>
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

export function AccountDocumentsOverview(props: {
  servers: DocumentAreaServerSummary[];
}) {
  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <SectionHeader
          description="Здесь собраны ваши документы по всем серверам. Создание и редактирование открываются из раздела конкретного сервера, чтобы не смешивать разные рабочие контексты."
          eyebrow="Документы"
          title="Мои документы"
        />
      </Card>

      {props.servers.length === 0 ? (
        <EmptyStateCard
          description="Пока у аккаунта нет доступных серверов, список документов будет пустым."
          title="Серверы пока не найдены"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {props.servers.map((server) => (
            <Card className="space-y-4" key={server.id}>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{server.name}</Badge>
                  <span className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    {server.code}
                  </span>
                </div>
                <p className="text-sm leading-6 text-[var(--muted)]">
                  Персонажей на сервере: {server.characterCount}. Выбранный персонаж:{" "}
                  {server.selectedCharacterName ?? "пока не выбран"}.
                </p>
                <p className="text-sm leading-6 text-[var(--muted)]">
                  Жалобы в ОГП уже доступны для работы. Раздел исков отображается отдельно.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <FoundationLink href={`/servers/${server.code}/documents`}>
                  Открыть документы сервера
                </FoundationLink>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export function DocumentServerNotFoundState(props: {
  requestedServerSlug: string;
  servers: DocumentAreaServerSummary[];
}) {
  return (
    <div className="space-y-6">
      <EmptyStateCard
        description={`Не удалось открыть сервер с адресом ${props.requestedServerSlug}. Выберите другой сервер и откройте документы в нужном рабочем контексте.`}
        eyebrow="Документы"
        primaryAction={{
          href: "/servers",
          label: "Вернуться к серверам",
        }}
        title="Сервер не найден"
      />

      {props.servers.length > 0 ? (
        <Card className="space-y-4">
          <h2 className="text-2xl font-semibold">Доступные серверы</h2>
          <div className="flex flex-wrap gap-3">
            {props.servers.map((server) => (
              <FoundationLink href={`/servers/${server.code}/documents`} key={server.id}>
                {server.name}
              </FoundationLink>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

export function DocumentNoCharactersState(props: {
  server: {
    code: string;
    name: string;
  };
  bridgeHref: string;
}) {
  return (
    <div className="space-y-6">
      <AccessBlockedCard
        badges={[`Сервер: ${props.server.name}`]}
        description="Для этого действия нужен персонаж на выбранном сервере."
        eyebrow="Документы"
        helperText="Сначала создайте персонажа и затем вернитесь к документам этого сервера."
        primaryAction={{
          href: props.bridgeHref,
          label: "Открыть персонажей сервера",
        }}
        secondaryAction={{
          href: "/servers",
          label: "Вернуться к серверам",
        }}
        title="Сначала нужен персонаж"
      />
    </div>
  );
}

export function ServerDocumentsHub(props: {
  server: {
    code: string;
    name: string;
  };
  selectedCharacter: {
    id: string;
    fullName: string;
    passportNumber: string;
    source: "last_used" | "first_available";
  } | null;
  bridgeHref?: string;
  ogpComplaintDocumentCount?: number;
  claimsDocumentCount?: number;
  attorneyRequestDocumentCount?: number;
  documentEntryCapabilities?: DocumentEntryCapabilities;
  legalServicesAgreementDocumentCount?: number;
  workspaceCapabilities?: WorkspaceCapabilities;
}) {
  const blockReasons = props.documentEntryCapabilities?.blockReasons ?? [];
  const workspaceBlockReasons = props.workspaceCapabilities?.blockReasons ?? [];
  const hasCharacter = props.selectedCharacter !== null;
  const canOpenLawyerWorkspace = props.workspaceCapabilities?.canOpenLawyerWorkspace ?? false;
  const showGeneralCharacterNote =
    blockReasons.includes("character_required") &&
    (!props.documentEntryCapabilities?.canCreateSelfComplaint ||
      !props.documentEntryCapabilities?.canCreateClaims);
  const showLawyerAdvocateNote =
    workspaceBlockReasons.includes("advocate_character_required") && !canOpenLawyerWorkspace;
  const showLawyerAccessRequestHint =
    showLawyerAdvocateNote && workspaceBlockReasons.includes("access_request_required");
  const showLawyerTrustorNote =
    blockReasons.includes("trustor_required_temporarily") &&
    (!props.documentEntryCapabilities?.canCreateAttorneyRequest ||
      !props.documentEntryCapabilities?.canCreateLegalServicesAgreement);
  const ogpCount = props.ogpComplaintDocumentCount ?? null;
  const claimsCount = props.claimsDocumentCount ?? null;
  const attorneyCount = props.attorneyRequestDocumentCount ?? null;
  const agreementsCount = props.legalServicesAgreementDocumentCount ?? null;
  const totalKnownDocuments = [ogpCount, claimsCount, attorneyCount, agreementsCount].reduce<number>(
    (sum, value) => sum + (value ?? 0),
    0,
  );
  const hasDocumentCounts = [ogpCount, claimsCount, attorneyCount, agreementsCount].some(
    (value) => typeof value === "number",
  );
  const firstCreateAction = props.documentEntryCapabilities?.canCreateSelfComplaint
    ? {
        href: `/servers/${props.server.code}/documents/ogp-complaints/new`,
        label: "Создать жалобу в ОГП",
      }
    : props.documentEntryCapabilities?.canCreateClaims
      ? {
          href: `/servers/${props.server.code}/documents/claims/new`,
          label: "Выбрать тип иска",
        }
      : props.bridgeHref
        ? {
            href: props.bridgeHref,
            label: "Открыть персонажей сервера",
          }
        : null;

  return (
    <div className="space-y-6">
      <WorkspaceSurface className="space-y-6 bg-[linear-gradient(145deg,rgba(194,154,84,0.12),rgba(27,34,43,0.94)_32%,rgba(20,26,32,0.98)_100%)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Документы</p>
            <div className="space-y-3">
              <h1 className="max-w-4xl text-3xl font-semibold tracking-[-0.03em] md:text-4xl xl:text-[2.8rem]">
                Документы и черновики
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-[var(--muted)] md:text-base">
                Создавайте, проверяйте и открывайте документы по выбранному серверу.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="warning">Сервер: {props.server.name}</StatusBadge>
            {props.selectedCharacter ? (
              <StatusBadge tone="warning">Персонаж: {props.selectedCharacter.fullName}</StatusBadge>
            ) : (
              <StatusBadge tone="neutral">Персонаж пока не выбран</StatusBadge>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {hasDocumentCounts ? (
            <>
              {ogpCount !== null ? (
                <StatCard
                  helperText="Жалобы по выбранному серверу доступны из отдельного family-раздела."
                  label="Жалобы в ОГП"
                  tone={ogpCount > 0 ? "success" : "neutral"}
                  value={String(ogpCount)}
                />
              ) : null}
              {claimsCount !== null ? (
                <StatCard
                  helperText="Иски и связанные документы открываются отдельно от жалоб."
                  label="Иски"
                  tone={claimsCount > 0 ? "success" : "neutral"}
                  value={String(claimsCount)}
                />
              ) : null}
              {attorneyCount !== null ? (
                <StatCard
                  helperText="Адвокатские запросы остаются доступными через lawyer workspace и прямой family route."
                  label="Адвокатские запросы"
                  tone={attorneyCount > 0 ? "success" : "neutral"}
                  value={String(attorneyCount)}
                />
              ) : null}
              {agreementsCount !== null ? (
                <StatCard
                  helperText="Договоры считаются отдельно и не смешиваются с общими документами."
                  label="Договоры"
                  tone={agreementsCount > 0 ? "success" : "neutral"}
                  value={String(agreementsCount)}
                />
              ) : null}
            </>
          ) : (
            <PanelCard className="space-y-3 md:col-span-2 xl:col-span-4">
              <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">
                Состояние раздела
              </p>
              <h2 className="text-2xl font-semibold">Сводка по документам пока не собрана</h2>
              <p className="text-sm leading-6 text-[var(--muted)]">
                На этом экране пока доступны только существующие семейства документов и основные
                точки входа без дополнительной серверной агрегации по жизненному циклу.
              </p>
            </PanelCard>
          )}
        </div>
      </WorkspaceSurface>

      {hasDocumentCounts && totalKnownDocuments === 0 ? (
        <EmptyState
          action={
            firstCreateAction
              ? {
                  href: firstCreateAction.href,
                  label: firstCreateAction.label,
                  variant: "primary",
                }
              : undefined
          }
          description="Создайте первый документ, чтобы он появился в этом разделе."
          secondaryAction={
            !firstCreateAction && props.bridgeHref
              ? {
                  href: props.bridgeHref,
                  label: "Открыть персонажей сервера",
                  variant: "secondary",
                }
              : undefined
          }
          title="Документов пока нет"
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <PanelCard className="space-y-4 transition hover:border-[var(--button-secondary-border)] hover:bg-[var(--surface-hover)]">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">
              Раздел документов
            </p>
            <h2 className="text-2xl font-semibold">Жалобы в ОГП</h2>
            <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Создавайте и редактируйте жалобы в ОГП, собирайте готовый текст для форума и
              готовьте публикацию.
            </p>
            {showGeneralCharacterNote ? (
              <p className="text-sm leading-6 text-[var(--muted)]">
                Для этого действия нужен персонаж на выбранном сервере.
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-[var(--muted)]">
            {ogpCount !== null ? <StatusBadge tone="info">Документов: {ogpCount}</StatusBadge> : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href={`/servers/${props.server.code}/documents/ogp-complaints`} variant="secondary">
              Открыть жалобы в ОГП
            </ButtonLink>
          </div>
        </PanelCard>

        <PanelCard className="space-y-4 transition hover:border-[var(--button-secondary-border)] hover:bg-[var(--surface-hover)]">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">
              Раздел документов
            </p>
            <h2 className="text-2xl font-semibold">Иски</h2>
            <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Отдельный раздел для исковых документов. Он не смешивается с жалобами в ОГП.
            </p>
            {showGeneralCharacterNote ? (
              <p className="text-sm leading-6 text-[var(--muted)]">
                Для этого действия нужен персонаж на выбранном сервере.
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-[var(--muted)]">
            {claimsCount !== null ? (
              <StatusBadge tone="info">Документов: {claimsCount}</StatusBadge>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href={`/servers/${props.server.code}/documents/claims`} variant="secondary">
              Открыть иски
            </ButtonLink>
            <ButtonLink href={`/servers/${props.server.code}/documents/claims/new`} variant="ghost">
              Выбрать тип иска
            </ButtonLink>
          </div>
        </PanelCard>
      </div>

      <PanelCard className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">
            Отдельный модуль
          </p>
          <h2 className="text-2xl font-semibold">Адвокатские документы</h2>
          <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
            Адвокатские запросы, договоры на оказание юридических услуг и работа в интересах
            доверителя открываются из отдельного адвокатского кабинета.
          </p>
          {!hasCharacter ? (
            <p className="text-sm leading-6 text-[var(--muted)]">
              Для этого действия нужен персонаж на выбранном сервере.
            </p>
          ) : null}
          {showLawyerAdvocateNote ? (
            <p className="text-sm leading-6 text-[var(--muted)]">
              Для этого действия нужен персонаж с адвокатским доступом.
            </p>
          ) : null}
          {showLawyerAccessRequestHint ? (
            <p className="text-sm leading-6 text-[var(--muted)]">
              Если персонаж уже готов, доступ оформляется через его заявку и дальнейшее
              рассмотрение.
            </p>
          ) : null}
          {showLawyerTrustorNote ? (
            <WarningNotice
              description="В текущей версии для этого действия нужен сохранённый доверитель."
              title="Текущий этап совместимости"
            />
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-[var(--muted)]">
          {attorneyCount !== null ? (
            <StatusBadge tone="info">Адвокатских запросов: {attorneyCount}</StatusBadge>
          ) : null}
          {agreementsCount !== null ? (
            <StatusBadge tone="info">Договоров: {agreementsCount}</StatusBadge>
          ) : null}
        </div>
        <ul className="space-y-2 text-sm leading-6 text-[var(--muted)]">
          <li>Адвокатские запросы.</li>
          <li>Договоры на оказание юридических услуг.</li>
          <li>Работа с доверителями и документами в их интересах.</li>
        </ul>
        <div className="flex flex-wrap gap-3">
          {canOpenLawyerWorkspace ? (
            <ButtonLink href={`/servers/${props.server.code}/lawyer`} variant="secondary">
              Открыть адвокатский кабинет
            </ButtonLink>
          ) : props.bridgeHref ? (
            <ButtonLink href={props.bridgeHref} variant="secondary">
              Открыть персонажей сервера
            </ButtonLink>
          ) : null}
        </div>
      </PanelCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <PanelCard className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">
              Дополнительные входы
            </p>
            <h2 className="text-2xl font-semibold">Прямые маршруты сохраняются</h2>
            <p className="text-sm leading-6 text-[var(--muted)]">
              Прямые маршруты для адвокатских запросов и договоров продолжают работать. Основной
              вход для этих сценариев теперь собран в отдельном адвокатском кабинете.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <ButtonLink
              href={`/servers/${props.server.code}/documents/attorney-requests`}
              variant="secondary"
            >
              Открыть адвокатские запросы
            </ButtonLink>
            <ButtonLink
              href={`/servers/${props.server.code}/documents/legal-services-agreements`}
              variant="secondary"
            >
              Открыть договоры
            </ButtonLink>
          </div>
        </PanelCard>
      </div>
    </div>
  );
}

export function OgpComplaintFoundation(props: {
  mode: "index" | "new" | "editor";
  server: {
    code: string;
    name: string;
  };
  selectedCharacter: {
    fullName: string;
    passportNumber: string;
    source: "last_used" | "first_available";
  };
  documentId?: string;
}) {
  const title =
    props.mode === "index"
      ? "Жалобы в ОГП"
      : props.mode === "new"
        ? "Новая жалоба в ОГП"
        : "Редактор жалобы в ОГП";

  const description =
    props.mode === "index"
      ? "Здесь будут отображаться жалобы в ОГП по выбранному серверу."
      : props.mode === "new"
        ? "Создайте черновик жалобы. До первого сохранения можно сменить выбранного персонажа."
        : "Откройте сохранённую жалобу и продолжите редактирование.";

  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <SectionHeader
          description={description}
          eyebrow="Жалоба в ОГП"
          meta={
            <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-[var(--muted)]">
              {props.mode === "editor" ? <StatusBadge tone="info">только для владельца</StatusBadge> : null}
              <StatusBadge tone="warning">Сервер: {props.server.name}</StatusBadge>
              <StatusBadge tone="warning">Персонаж: {props.selectedCharacter.fullName}</StatusBadge>
              <span>Паспорт: {props.selectedCharacter.passportNumber}</span>
            </div>
          }
          title={title}
        />
      </Card>

      <Card className="space-y-4">
        <h2 className="text-2xl font-semibold">Что доступно сейчас</h2>
        <ul className="space-y-2 text-sm leading-6 text-[var(--muted)]">
          <li>Черновик можно создать и затем открыть в редакторе жалобы.</li>
          <li>После сохранения данные персонажа фиксируются в документе.</li>
          <li>Сборка готового текста для форума доступна в сохранённом редакторе жалобы.</li>
          <li>
            Выбранный персонаж показан явно и может быть изменён до первого сохранения.
          </li>
        </ul>
        <div className="flex flex-wrap gap-3">
          {props.mode !== "index" ? (
            <FoundationLink href={`/servers/${props.server.code}/documents/ogp-complaints`}>
              Вернуться к жалобам в ОГП
            </FoundationLink>
          ) : null}
          {props.mode !== "new" ? (
            <FoundationLink href={`/servers/${props.server.code}/documents/ogp-complaints/new`}>
              Создать новую жалобу
            </FoundationLink>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

function formatClaimSubtypeLabel(subtype: "rehabilitation" | "lawsuit") {
  return subtype === "rehabilitation" ? "Реабилитация" : "Исковое заявление";
}

export function ClaimsFamilyFoundation(props: {
  mode: "index" | "new" | "editor";
  server: {
    code: string;
    name: string;
  };
  selectedCharacter: {
    fullName: string;
    passportNumber: string;
    source: "last_used" | "first_available";
  } | null;
  selectedSubtype?: "rehabilitation" | "lawsuit" | null;
  documentId?: string;
}) {
  const title =
    props.mode === "index"
      ? "Иски"
      : props.mode === "new"
        ? "Новый документ из раздела «Иски»"
        : "Редактор документа из раздела «Иски»";

  const description =
    props.mode === "index"
      ? "Здесь собраны документы из раздела исков."
      : props.mode === "new"
        ? "Сначала выберите вид документа, а затем создайте черновик."
        : "Откройте сохранённый документ и продолжите редактирование.";

  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <SectionHeader
          description={description}
          eyebrow="Иски"
          meta={
            <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-[var(--muted)]">
              {props.selectedSubtype ? (
                <StatusBadge tone="info">
                  Вид документа: {formatClaimSubtypeLabel(props.selectedSubtype)}
                </StatusBadge>
              ) : null}
              <StatusBadge tone="warning">Сервер: {props.server.name}</StatusBadge>
              {props.selectedCharacter ? (
                <>
                  <StatusBadge tone="warning">Персонаж: {props.selectedCharacter.fullName}</StatusBadge>
                  <span>Паспорт: {props.selectedCharacter.passportNumber}</span>
                  <span>
                    Сейчас выбран{" "}
                    {props.selectedCharacter.source === "last_used"
                      ? "последний использованный"
                      : "первый доступный"}{" "}
                    персонаж
                  </span>
                </>
              ) : (
                <StatusBadge tone="neutral">Персонаж пока не выбран</StatusBadge>
              )}
            </div>
          }
          title={title}
        />
      </Card>

      <Card className="space-y-4">
        <h2 className="text-2xl font-semibold">Что доступно в этом разделе</h2>
        <ul className="space-y-2 text-sm leading-6 text-[var(--muted)]">
          <li>Документ вида «Реабилитация».</li>
          <li>Документ вида «Исковое заявление».</li>
          <li>Черновики и итоговые версии документов по искам.</li>
          <li>Публикация на форуме для этого раздела не используется.</li>
          {props.mode === "editor" ? (
            <li>После первого сохранения вид документа уже не меняется автоматически.</li>
          ) : null}
        </ul>
      </Card>

      {props.mode === "new" ? (
        <Card className="space-y-4">
          <h2 className="text-2xl font-semibold">Выбор вида документа</h2>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Перед созданием черновика нужно выбрать, какой именно документ вы хотите подготовить.
          </p>
          <div className="flex flex-wrap gap-3">
            <FoundationLink href={`/servers/${props.server.code}/documents/claims/new?subtype=rehabilitation`}>
              Выбрать реабилитацию
            </FoundationLink>
            <FoundationLink href={`/servers/${props.server.code}/documents/claims/new?subtype=lawsuit`}>
              Выбрать исковое заявление
            </FoundationLink>
          </div>
          {props.selectedSubtype ? (
            <p className="text-sm leading-6 text-[var(--muted)]">
              Сейчас выбран документ вида «{formatClaimSubtypeLabel(props.selectedSubtype)}».
              Ниже можно перейти к созданию черновика.
            </p>
          ) : (
            <p className="text-sm leading-6 text-[var(--muted)]">
              Пока вид документа не выбран. Без этого новый черновик не создаётся.
            </p>
          )}
        </Card>
      ) : null}

      <Card className="space-y-4">
        <div className="flex flex-wrap gap-3">
          {props.mode !== "index" ? (
            <FoundationLink href={`/servers/${props.server.code}/documents/claims`}>
              Вернуться к искам
            </FoundationLink>
          ) : null}
          {props.mode !== "new" ? (
            <FoundationLink href={`/servers/${props.server.code}/documents/claims/new`}>
              Выбрать вид документа
            </FoundationLink>
          ) : null}
          <FoundationLink href={`/servers/${props.server.code}/documents`}>
            Вернуться к документам сервера
          </FoundationLink>
        </div>
      </Card>
    </div>
  );
}
