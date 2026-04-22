import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type {
  PublicServerDirectoryItem,
  ServerAssistantStatus,
  ServerDirectoryAvailability,
  ServerDocumentsAvailabilityForViewer,
} from "@/server/server-directory/context";

type PublicServerDirectoryProps = {
  servers: PublicServerDirectoryItem[];
};

function resolveDirectoryAvailabilityUi(status: ServerDirectoryAvailability) {
  switch (status) {
    case "active":
      return {
        label: "Доступен",
        description: "Сервер открыт для user-facing модулей.",
      };
    case "maintenance":
      return {
        label: "Maintenance",
        description: "Сервер временно находится в обслуживании.",
      };
    case "unavailable":
      return {
        label: "Недоступен",
        description: "Сервер виден в каталоге, но user-facing вход сейчас закрыт.",
      };
  }
}

function resolveAssistantStatusUi(status: ServerAssistantStatus) {
  switch (status) {
    case "current_corpus_ready":
      return {
        label: "Assistant ready",
        description: "Подтверждённый corpus готов для работы assistant.",
      };
    case "corpus_bootstrap_incomplete":
      return {
        label: "Assistant limited",
        description: "Corpus уже собран частично, но ещё не считается полностью готовым.",
      };
    case "corpus_stale":
      return {
        label: "Assistant limited",
        description: "Corpus требует внимания, поэтому ответы лучше проверять особенно внимательно.",
      };
    case "assistant_disabled":
      return {
        label: "Assistant disabled",
        description: "Assistant для этого сервера сейчас недоступен.",
      };
    case "maintenance_mode":
      return {
        label: "Server maintenance",
        description: "Обычный assistant flow временно выключен из-за обслуживания сервера.",
      };
    case "no_corpus":
      return {
        label: "Assistant unavailable",
        description: "Подтверждённого corpus для assistant пока нет.",
      };
  }
}

function resolveDocumentsAvailabilityUi(status: ServerDocumentsAvailabilityForViewer) {
  switch (status) {
    case "available":
      return {
        label: "Documents доступны",
        description: "Можно открыть server-scoped document area по этому серверу.",
      };
    case "needs_character":
      return {
        label: "Нужен персонаж",
        description: "Документы появятся после добавления персонажа на этом сервере.",
      };
    case "unavailable":
      return {
        label: "Documents недоступны",
        description: "Пока сервер недоступен, document area тоже закрыта.",
      };
    case "requires_auth":
      return {
        label: "Нужен вход",
        description: "Documents остаются private route и открываются только после входа.",
      };
  }
}

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
