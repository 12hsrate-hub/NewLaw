import type { ReactNode } from "react";

import Link from "next/link";

import {
  resolveAssistantStatusUi,
  resolveDirectoryAvailabilityUi,
  resolveDocumentsAvailabilityUi,
} from "@/components/product/server-directory/status-ui";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { buildCharactersBridgePath } from "@/server/document-area/context";
import type {
  DocumentEntryCapabilities,
  WorkspaceCapabilities,
} from "@/server/navigation/capabilities";
import type { ServerHubRouteContext } from "@/server/server-directory/hub";
import { cn } from "@/utils/cn";
import { buildAccountCharactersFocusHref } from "@/lib/routes/account-characters";

function HubLink(props: {
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

function ServerHubNotFoundState() {
  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Сервер</p>
        <h1 className="text-3xl font-semibold">Сервер не найден</h1>
        <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
          Не удалось найти сервер с таким адресом. Вернитесь к списку серверов и выберите нужный
          вариант снова.
        </p>
        <div className="flex flex-wrap gap-3">
          <HubLink href="/servers">Вернуться к каталогу серверов</HubLink>
        </div>
      </Card>
    </div>
  );
}

function ServerHubUnavailableState(props: {
  server: {
    name: string;
  };
}) {
  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Сервер</p>
        <h1 className="text-3xl font-semibold">{props.server.name}</h1>
        <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
          Этот сервер временно недоступен. Попробуйте открыть его позже или выберите другой
          сервер из списка.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-[var(--muted)]">
          <Badge>Недоступен</Badge>
        </div>
        <div className="flex flex-wrap gap-3">
          <HubLink href="/servers">Вернуться к каталогу серверов</HubLink>
        </div>
      </Card>
    </div>
  );
}

function AssistantCard(props: {
  serverSlug: string;
  availability: ReturnType<typeof resolveAssistantStatusUi>;
  isInteractive: boolean;
}) {
  return (
    <Card className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">Раздел</p>
        <h2 className="text-2xl font-semibold">Юридический помощник</h2>
        <p className="text-sm font-medium">{props.availability.label}</p>
        <p className="text-sm leading-6 text-[var(--muted)]">{props.availability.description}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        {props.isInteractive ? (
          <HubLink href={`/assistant/${props.serverSlug}`}>Открыть помощника</HubLink>
        ) : (
          <span className="inline-flex items-center rounded-2xl border border-dashed border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--muted)]">
            Помощник временно недоступен
          </span>
        )}
      </div>
    </Card>
  );
}

function DocumentsCard(props: {
  serverCode: string;
  serverSlug: string;
  availability: ReturnType<typeof resolveDocumentsAvailabilityUi>;
  canOpenDocumentsWorkspace: boolean;
  documentEntryCapabilities?: DocumentEntryCapabilities;
  state: "available" | "needs_character" | "unavailable";
}) {
  const bridgeHref = buildCharactersBridgePath(props.serverCode);
  const blockReasons = props.documentEntryCapabilities?.blockReasons ?? [];
  const needsCharacterForGeneralDocuments =
    blockReasons.includes("character_required") &&
    (!props.documentEntryCapabilities?.canCreateSelfComplaint ||
      !props.documentEntryCapabilities?.canCreateClaims);
  const needsAdvocateCharacterForLawyerDocuments =
    blockReasons.includes("advocate_character_required") &&
    (!props.documentEntryCapabilities?.canCreateAttorneyRequest ||
      !props.documentEntryCapabilities?.canCreateLegalServicesAgreement);
  const needsCompatibilityTrustor =
    blockReasons.includes("trustor_required_temporarily") &&
    (!props.documentEntryCapabilities?.canCreateAttorneyRequest ||
      !props.documentEntryCapabilities?.canCreateLegalServicesAgreement);
  const canOpenDocuments =
    props.state !== "unavailable" && props.canOpenDocumentsWorkspace;

  return (
    <Card className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">Раздел</p>
        <h2 className="text-2xl font-semibold">Документы по серверу</h2>
        <p className="text-sm font-medium">{props.availability.label}</p>
        <p className="text-sm leading-6 text-[var(--muted)]">{props.availability.description}</p>
        {needsCharacterForGeneralDocuments ? (
          <p className="text-sm leading-6 text-[var(--muted)]">
            Раздел можно открыть уже сейчас, но для жалоб и исков сначала нужен персонаж на этом
            сервере.
          </p>
        ) : null}
        {needsAdvocateCharacterForLawyerDocuments ? (
          <p className="text-sm leading-6 text-[var(--muted)]">
            Для адвокатских документов потребуется персонаж с адвокатским доступом.
          </p>
        ) : null}
        {needsCompatibilityTrustor ? (
          <p className="text-sm leading-6 text-[var(--muted)]">
            В текущей версии для некоторых адвокатских действий нужен сохранённый доверитель.
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-3">
        {canOpenDocuments ? (
          <HubLink href={`/servers/${props.serverSlug}/documents`}>Открыть документы</HubLink>
        ) : null}
        {props.state === "needs_character" ? (
          <>
            <HubLink href={bridgeHref}>Создать персонажа на этом сервере</HubLink>
          </>
        ) : null}
        {props.state === "unavailable" || !props.canOpenDocumentsWorkspace ? (
          <span className="inline-flex items-center rounded-2xl border border-dashed border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--muted)]">
            Документы временно недоступны
          </span>
        ) : null}
      </div>
    </Card>
  );
}

function LawyerWorkspaceCard(props: {
  serverCode: string;
  serverSlug: string;
  canOpenLawyerWorkspace: boolean;
  selectedCharacterSummary: {
    fullName: string;
  } | null;
  workspaceCapabilities?: WorkspaceCapabilities;
}) {
  const blockReasons = props.workspaceCapabilities?.blockReasons ?? [];
  const needsCharacter = props.selectedCharacterSummary === null;
  const needsAdvocateAccess =
    !needsCharacter && !props.canOpenLawyerWorkspace && blockReasons.includes("advocate_character_required");
  const canRequestAccess = blockReasons.includes("access_request_required");

  return (
    <Card className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">Раздел</p>
        <h2 className="text-2xl font-semibold">Адвокатский кабинет</h2>
        <p className="text-sm leading-6 text-[var(--muted)]">
          Отдельный модуль для адвокатских сценариев по выбранному серверу. Здесь собраны входы в
          доверителей, договоры и адвокатские запросы.
        </p>
        {needsCharacter ? (
          <p className="text-sm leading-6 text-[var(--muted)]">
            Для адвокатского кабинета сначала нужен персонаж на этом сервере.
          </p>
        ) : null}
        {needsAdvocateAccess ? (
          <p className="text-sm leading-6 text-[var(--muted)]">
            Для адвокатского кабинета нужен персонаж с адвокатским доступом.
          </p>
        ) : null}
        {needsAdvocateAccess && canRequestAccess ? (
          <p className="text-sm leading-6 text-[var(--muted)]">
            Если персонаж уже готов, доступ оформляется через его заявку и дальнейшее рассмотрение.
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-3">
        {props.canOpenLawyerWorkspace ? (
          <HubLink href={`/servers/${props.serverSlug}/lawyer`}>Открыть адвокатский кабинет</HubLink>
        ) : (
          <HubLink href={buildAccountCharactersFocusHref(props.serverCode)}>
            Открыть персонажей сервера
          </HubLink>
        )}
      </div>
    </Card>
  );
}

export function AuthenticatedServerHub(props: {
  context: ServerHubRouteContext;
}) {
  if (props.context.status === "server_not_found") {
    return <ServerHubNotFoundState />;
  }

  if (props.context.status === "server_unavailable") {
    return <ServerHubUnavailableState server={props.context.server} />;
  }

  const availabilityUi = resolveDirectoryAvailabilityUi(props.context.server.directoryAvailability);
  const assistantUi = resolveAssistantStatusUi(props.context.assistantStatus);
  const documentsUi = resolveDocumentsAvailabilityUi(
    props.context.documentsAvailabilityForViewer,
  );
  const assistantInteractive =
    props.context.workspaceCapabilities?.canOpenAssistant ??
    (props.context.assistantStatus === "current_corpus_ready" ||
      props.context.assistantStatus === "corpus_bootstrap_incomplete" ||
      props.context.assistantStatus === "corpus_stale");
  const documentsInteractive =
    props.context.documentsAvailabilityForViewer !== "unavailable" &&
    (props.context.workspaceCapabilities?.canOpenDocumentsWorkspace ??
      props.context.documentsAvailabilityForViewer === "available");

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Сервер</p>
          <Badge>{availabilityUi.label}</Badge>
        </div>
        <h1 className="text-3xl font-semibold">{props.context.server.name}</h1>
        <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
          Здесь собраны основные действия и разделы для выбранного сервера.
        </p>
        <p className="text-sm leading-6 text-[var(--muted)]">{availabilityUi.description}</p>
        <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-[var(--muted)]">
          {props.context.selectedCharacterSummary ? (
            <>
              <Badge>Персонаж: {props.context.selectedCharacterSummary.fullName}</Badge>
              <span>Паспорт: {props.context.selectedCharacterSummary.passportNumber}</span>
              <span>
                Выбран персонаж:{" "}
                {props.context.selectedCharacterSummary.source === "last_used"
                  ? "последний использованный"
                  : "первый доступный"}
              </span>
            </>
          ) : (
            <Badge>Персонаж на сервере пока не выбран</Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <HubLink href="/servers">Вернуться к каталогу серверов</HubLink>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <AssistantCard
          availability={assistantUi}
          isInteractive={assistantInteractive}
          serverSlug={props.context.server.slug}
        />
        <DocumentsCard
          availability={documentsUi}
          canOpenDocumentsWorkspace={documentsInteractive}
          documentEntryCapabilities={props.context.documentEntryCapabilities}
          serverCode={props.context.server.code}
          serverSlug={props.context.server.slug}
          state={props.context.documentsAvailabilityForViewer}
        />
        <LawyerWorkspaceCard
          canOpenLawyerWorkspace={props.context.workspaceCapabilities?.canOpenLawyerWorkspace ?? false}
          selectedCharacterSummary={props.context.selectedCharacterSummary}
          serverCode={props.context.server.code}
          serverSlug={props.context.server.slug}
          workspaceCapabilities={props.context.workspaceCapabilities}
        />
      </div>
    </div>
  );
}
