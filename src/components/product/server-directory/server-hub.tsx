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
import type { ServerHubRouteContext } from "@/server/server-directory/hub";
import { cn } from "@/utils/cn";

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

function ServerHubNotFoundState(props: {
  requestedServerSlug: string;
}) {
  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Server Hub</p>
        <h1 className="text-3xl font-semibold">Сервер не найден</h1>
        <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
          Такой `serverSlug` сейчас не найден в server-scoped зоне: {props.requestedServerSlug}.
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
    code: string;
    name: string;
  };
}) {
  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Server Hub</p>
        <h1 className="text-3xl font-semibold">{props.server.name}</h1>
        <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
          Этот сервер сейчас недоступен для user-facing входа. Hub честно показывает состояние, а
          не маскирует его под 404.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-[var(--muted)]">
          <Badge>serverSlug: {props.server.code}</Badge>
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
        <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">Server Module</p>
        <h2 className="text-2xl font-semibold">Assistant</h2>
        <p className="text-sm font-medium">{props.availability.label}</p>
        <p className="text-sm leading-6 text-[var(--muted)]">{props.availability.description}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        {props.isInteractive ? (
          <HubLink href={`/assistant/${props.serverSlug}`}>Открыть assistant</HubLink>
        ) : (
          <span className="inline-flex items-center rounded-2xl border border-dashed border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--muted)]">
            Assistant временно недоступен
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
  state: "available" | "needs_character" | "unavailable";
}) {
  const bridgeHref = buildCharactersBridgePath(props.serverCode);

  return (
    <Card className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">Server Module</p>
        <h2 className="text-2xl font-semibold">Documents</h2>
        <p className="text-sm font-medium">{props.availability.label}</p>
        <p className="text-sm leading-6 text-[var(--muted)]">{props.availability.description}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        {props.state === "available" ? (
          <HubLink href={`/servers/${props.serverSlug}/documents`}>Открыть documents</HubLink>
        ) : props.state === "needs_character" ? (
          <>
            <span className="inline-flex items-center rounded-2xl border border-dashed border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--muted)]">
              Documents пока недоступны
            </span>
            <HubLink href={bridgeHref}>Создать персонажа на этом сервере</HubLink>
          </>
        ) : (
          <span className="inline-flex items-center rounded-2xl border border-dashed border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--muted)]">
            Documents временно недоступны
          </span>
        )}
      </div>
    </Card>
  );
}

export function AuthenticatedServerHub(props: {
  context: ServerHubRouteContext;
}) {
  if (props.context.status === "server_not_found") {
    return <ServerHubNotFoundState requestedServerSlug={props.context.requestedServerSlug} />;
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
    props.context.assistantStatus === "current_corpus_ready" ||
    props.context.assistantStatus === "corpus_bootstrap_incomplete" ||
    props.context.assistantStatus === "corpus_stale";

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Server Hub</p>
          <Badge>{availabilityUi.label}</Badge>
          <Badge>serverSlug: {props.context.server.slug}</Badge>
        </div>
        <h1 className="text-3xl font-semibold">{props.context.server.name}</h1>
        <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
          Это auth-gated server entry point. Source of truth по серверу берётся только из URL, а не
          из active server shell state.
        </p>
        <p className="text-sm leading-6 text-[var(--muted)]">{availabilityUi.description}</p>
        <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-[var(--muted)]">
          {props.context.selectedCharacterSummary ? (
            <>
              <Badge>Персонаж: {props.context.selectedCharacterSummary.fullName}</Badge>
              <span>Паспорт: {props.context.selectedCharacterSummary.passportNumber}</span>
              <span>
                UX-default:{" "}
                {props.context.selectedCharacterSummary.source === "last_used"
                  ? "last-used"
                  : "first available"}
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

      <div className="grid gap-4 lg:grid-cols-2">
        <AssistantCard
          availability={assistantUi}
          isInteractive={assistantInteractive}
          serverSlug={props.context.server.slug}
        />
        <DocumentsCard
          availability={documentsUi}
          serverCode={props.context.server.code}
          serverSlug={props.context.server.slug}
          state={props.context.documentsAvailabilityForViewer}
        />
      </div>
    </div>
  );
}
