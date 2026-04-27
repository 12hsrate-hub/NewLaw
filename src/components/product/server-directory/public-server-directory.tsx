import Link from "next/link";

import { WorkspaceCard } from "@/components/product/foundation/workspace-card";
import {
  resolveAssistantStatusUi,
  resolveDirectoryAvailabilityUi,
  resolveDocumentsAvailabilityUi,
} from "@/components/product/server-directory/status-ui";
import { EmptyStateCard } from "@/components/product/foundation/empty-state-card";
import { StatusBadge } from "@/components/ui/status-badge";
import type { PublicServerDirectoryItem } from "@/server/server-directory/context";

type PublicServerDirectoryProps = {
  servers: PublicServerDirectoryItem[];
};

function DocumentsAction({ server }: { server: PublicServerDirectoryItem }) {
  const documentsHref = `/servers/${server.slug}/documents`;
  const documentsUi = resolveDocumentsAvailabilityUi(server.documentsAvailabilityForViewer);

  if (server.documentsAvailabilityForViewer === "available") {
    return (
      <Link
        href={documentsHref}
        className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1 text-xs font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-hover)]"
      >
        Документы
      </Link>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full border border-dashed border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1 text-xs font-medium text-[var(--muted)]">
      {documentsUi.label}
    </span>
  );
}

function AssistantAction({ server }: { server: PublicServerDirectoryItem }) {
  const assistantHref = `/assistant/${server.slug}`;

  if (server.directoryAvailability !== "active") {
    return (
      <span className="inline-flex items-center rounded-full border border-dashed border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1 text-xs font-medium text-[var(--muted)]">
        Помощник временно недоступен
      </span>
    );
  }

  return (
    <Link
      href={assistantHref}
      className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1 text-xs font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-hover)]"
    >
      Юридический помощник
    </Link>
  );
}

export function PublicServerDirectory({ servers }: PublicServerDirectoryProps) {
  if (servers.length === 0) {
    return (
      <EmptyStateCard
        description="Список серверов появится здесь позже."
        title="Пока нет доступных серверов"
      />
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {servers.map((server) => {
        const availabilityUi = resolveDirectoryAvailabilityUi(server.directoryAvailability);
        const assistantUi = resolveAssistantStatusUi(server.assistantStatus);
        const documentsUi = resolveDocumentsAvailabilityUi(server.documentsAvailabilityForViewer);

        return (
          <WorkspaceCard
            className="h-full"
            description={availabilityUi.description}
            eyebrow="Сервер"
            key={server.id}
            meta={
              <>
                <StatusBadge tone="warning">{server.name}</StatusBadge>
                <StatusBadge
                  tone={server.directoryAvailability === "active" ? "success" : "neutral"}
                >
                  {availabilityUi.label}
                </StatusBadge>
              </>
            }
            title={server.name}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
                  Юридический помощник
                </p>
                <p className="mt-2 text-sm font-medium">{assistantUi.label}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  {assistantUi.description}
                </p>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
                  Документы по серверу
                </p>
                <p className="mt-2 text-sm font-medium">{documentsUi.label}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  {documentsUi.description}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <AssistantAction server={server} />
              <DocumentsAction server={server} />
            </div>
          </WorkspaceCard>
        );
      })}
    </div>
  );
}
