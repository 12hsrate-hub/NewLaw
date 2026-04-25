import type { ReactNode } from "react";

import Link from "next/link";

import type { ClaimDocumentType, OgpForumSyncState } from "@/schemas/document";
import type { ForumConnectionSummary } from "@/schemas/forum-integration";
import type { DocumentAreaPersistedListItem } from "@/server/document-area/context";

export function DocumentLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      className="inline-flex items-center justify-center rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-white"
      href={href}
    >
      {children}
    </Link>
  );
}

export function formatClaimSubtype(documentType: ClaimDocumentType) {
  return documentType === "rehabilitation" ? "Rehabilitation" : "Lawsuit";
}

export function formatForumConnectionState(state: ForumConnectionSummary["state"]) {
  if (state === "not_connected") {
    return "не подключено";
  }

  if (state === "connected_unvalidated") {
    return "подключено, но не проверено";
  }

  if (state === "valid") {
    return "подключение работает";
  }

  if (state === "invalid") {
    return "нужно подключить заново";
  }

  return "отключено";
}

export function formatForumSyncState(state: OgpForumSyncState | null) {
  if (!state) {
    return null;
  }

  if (state === "not_published") {
    return "ещё не опубликовано";
  }

  if (state === "current") {
    return "публикация актуальна";
  }

  if (state === "outdated") {
    return "нужно обновить публикацию";
  }

  if (state === "failed") {
    return "ошибка публикации";
  }

  return "указана вручную";
}

export function formatDocumentStatus(status: DocumentAreaPersistedListItem["status"]) {
  if (status === "draft") {
    return "черновик";
  }

  if (status === "generated") {
    return "сгенерировано";
  }

  return "опубликовано";
}

export function formatFilingMode(mode: DocumentAreaPersistedListItem["filingMode"]) {
  if (!mode) {
    return null;
  }

  return mode === "representative" ? "как представитель" : "от своего имени";
}
