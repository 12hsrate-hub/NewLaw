import Link from "next/link";

import {
  resolveAssistantStatusUi,
  resolveDirectoryAvailabilityUi,
  resolveDocumentsAvailabilityUi,
} from "@/components/product/server-directory/status-ui";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
        className="inline-flex items-center rounded-full border border-[var(--border)] px-3 py-1 text-xs font-medium text-[var(--foreground)] transition hover:bg-white/80"
      >
        Documents
      </Link>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full border border-dashed border-[var(--border)] px-3 py-1 text-xs font-medium text-[var(--muted)]">
      {documentsUi.label}
    </span>
  );
}

function AssistantAction({ server }: { server: PublicServerDirectoryItem }) {
  const assistantHref = `/assistant/${server.slug}`;

  if (server.directoryAvailability !== "active") {
    return (
      <span className="inline-flex items-center rounded-full border border-dashed border-[var(--border)] px-3 py-1 text-xs font-medium text-[var(--muted)]">
        Assistant unavailable
      </span>
    );
  }

  return (
    <Link
      href={assistantHref}
      className="inline-flex items-center rounded-full border border-[var(--border)] px-3 py-1 text-xs font-medium text-[var(--foreground)] transition hover:bg-white/80"
    >
      Assistant
    </Link>
  );
}

export function PublicServerDirectory({ servers }: PublicServerDirectoryProps) {
  if (servers.length === 0) {
    return (
      <Card className="space-y-3">
        <h1 className="text-2xl font-semibold">Серверы пока не добавлены</h1>
        <p className="max-w-2xl text-sm leading-7 text-[var(--muted)]">
          Публичный server directory уже готов, но для него пока не заведены серверные карточки.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {servers.map((server) => {
        const availabilityUi = resolveDirectoryAvailabilityUi(server.directoryAvailability);
        const assistantUi = resolveAssistantStatusUi(server.assistantStatus);
        const documentsUi = resolveDocumentsAvailabilityUi(server.documentsAvailabilityForViewer);

        return (
          <Card key={server.id} className="flex h-full flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{server.name}</Badge>
              <Badge className="bg-[rgba(32,99,69,0.12)] text-[#206345]">
                {availabilityUi.label}
              </Badge>
              <span className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
                {server.code}
              </span>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-semibold">{server.name}</h2>
              <p className="text-sm leading-7 text-[var(--muted)]">
                Server slug: <span className="font-medium text-[var(--foreground)]">{server.slug}</span>
              </p>
              <p className="text-sm leading-7 text-[var(--muted)]">{availabilityUi.description}</p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-[var(--border)] bg-white/50 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
                  Assistant
                </p>
                <p className="mt-2 text-sm font-medium">{assistantUi.label}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  {assistantUi.description}
                </p>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-white/50 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
                  Documents
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
          </Card>
        );
      })}
    </div>
  );
}
