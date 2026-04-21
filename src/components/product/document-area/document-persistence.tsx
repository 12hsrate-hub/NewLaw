import type { ReactNode } from "react";

import Link from "next/link";

import { DocumentDraftEditorClient } from "@/components/product/document-area/document-draft-editor-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createOgpComplaintDraftAction } from "@/server/actions/documents";
import type {
  DocumentAreaPersistedListItem,
  DocumentAreaServerSummary,
} from "@/server/document-area/context";

function DocumentLink({
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

function formatDocumentType(documentType: DocumentAreaPersistedListItem["documentType"]) {
  if (documentType === "ogp_complaint") {
    return "OGP complaint";
  }

  if (documentType === "rehabilitation") {
    return "Rehabilitation";
  }

  return "Lawsuit";
}

function formatDocumentStatus(status: DocumentAreaPersistedListItem["status"]) {
  if (status === "draft") {
    return "draft";
  }

  if (status === "generated") {
    return "generated";
  }

  return "published";
}

function PersistedDocumentList(props: {
  documents: DocumentAreaPersistedListItem[];
}) {
  if (props.documents.length === 0) {
    return (
      <Card className="space-y-3">
        <h2 className="text-2xl font-semibold">Документы пока не созданы</h2>
        <p className="text-sm leading-6 text-[var(--muted)]">
          Persistence foundation уже заведён, но у этого аккаунта пока нет сохранённых документов.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {props.documents.map((document) => (
        <Card className="space-y-4" key={document.id}>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{formatDocumentType(document.documentType)}</Badge>
              <Badge>{formatDocumentStatus(document.status)}</Badge>
              <span className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                {document.server.name} / {document.server.code}
              </span>
            </div>
            <h3 className="text-xl font-semibold">{document.title}</h3>
            <p className="text-sm leading-6 text-[var(--muted)]">
              Author snapshot: {document.authorSnapshot.fullName}, паспорт{" "}
              {document.authorSnapshot.passportNumber}. Snapshot captured:{" "}
              {new Date(document.snapshotCapturedAt).toLocaleString("ru-RU")}.
            </p>
            <p className="text-sm leading-6 text-[var(--muted)]">
              Последнее обновление: {new Date(document.updatedAt).toLocaleString("ru-RU")}.
            </p>
            {document.workingNotesPreview ? (
              <p className="text-sm leading-6 text-[var(--muted)]">
                Рабочие заметки: {document.workingNotesPreview}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <DocumentLink
              href={`/servers/${document.server.code}/documents/ogp-complaints/${document.id}`}
            >
              Открыть persisted draft
            </DocumentLink>
          </div>
        </Card>
      ))}
    </div>
  );
}

export function AccountDocumentsPersistedOverview(props: {
  documents: DocumentAreaPersistedListItem[];
  servers: DocumentAreaServerSummary[];
}) {
  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
          Account Documents
        </p>
        <h1 className="text-3xl font-semibold">Мои документы</h1>
        <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
          `/account/documents` остаётся cross-server обзором persisted документов. Это не главный
          create/edit route: рабочая зона по-прежнему живёт в server-scoped маршрутах.
        </p>
      </Card>

      <PersistedDocumentList documents={props.documents} />

      <Card className="space-y-4">
        <h2 className="text-2xl font-semibold">Document area по серверам</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {props.servers.map((server) => (
            <Card className="space-y-3" key={server.id}>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{server.name}</Badge>
                  <span className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    {server.code}
                  </span>
                </div>
                <p className="text-sm leading-6 text-[var(--muted)]">
                  Персонажей на сервере: {server.characterCount}. Это bridge в server-scoped
                  document area, а не editor внутри account zone.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <DocumentLink href={`/servers/${server.code}/documents`}>
                  Открыть document area сервера
                </DocumentLink>
              </div>
            </Card>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function OgpComplaintFamilyPersistedList(props: {
  server: {
    code: string;
    name: string;
  };
  documents: DocumentAreaPersistedListItem[];
  canCreateDocuments: boolean;
  selectedCharacter: {
    fullName: string;
    passportNumber: string;
    source: "last_used" | "first_available";
  } | null;
}) {
  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
          OGP Complaint Family
        </p>
        <h1 className="text-3xl font-semibold">OGP complaints</h1>
        <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
          Это уже не пустой foundation route: здесь читаются реальные persisted документы типа
          `ogp_complaint` на выбранном сервере.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-[var(--muted)]">
          <Badge>serverSlug: {props.server.code}</Badge>
          <Badge>Сервер: {props.server.name}</Badge>
          {props.selectedCharacter ? (
            <>
              <Badge>UX-default персонаж: {props.selectedCharacter.fullName}</Badge>
              <span>
                Источник:{" "}
                {props.selectedCharacter.source === "last_used" ? "last-used" : "first available"}
              </span>
            </>
          ) : (
            <Badge>Новых create-flow сейчас нет: на сервере нет персонажей</Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          {props.canCreateDocuments ? (
            <DocumentLink href={`/servers/${props.server.code}/documents/ogp-complaints/new`}>
              Создать новый draft
            </DocumentLink>
          ) : null}
          <DocumentLink href={`/servers/${props.server.code}/documents`}>
            Вернуться к hub сервера
          </DocumentLink>
        </div>
      </Card>

      {!props.canCreateDocuments ? (
        <Card className="space-y-3">
          <h2 className="text-2xl font-semibold">Создание временно недоступно</h2>
          <p className="text-sm leading-6 text-[var(--muted)]">
            На сервере сейчас нет доступных персонажей, поэтому новый document создать нельзя.
            Existing persisted drafts при этом остаются доступны owner-аккаунту.
          </p>
        </Card>
      ) : null}

      <PersistedDocumentList documents={props.documents} />
    </div>
  );
}

export function OgpComplaintDraftCreateEntry(props: {
  server: {
    code: string;
    name: string;
  };
  characters: Array<{
    id: string;
    fullName: string;
    passportNumber: string;
  }>;
  selectedCharacter: {
    id: string;
    fullName: string;
    passportNumber: string;
    source: "last_used" | "first_available";
  };
  status?: string;
}) {
  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
          OGP Complaint Draft
        </p>
        <h1 className="text-3xl font-semibold">Новая жалоба в ОГП</h1>
        <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
          Первое сохранение уже создаёт реальный persisted `draft`, фиксирует `serverId`,
          `characterId`, author snapshot и переводит в owner-account editor route.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-[var(--muted)]">
          <Badge>serverSlug: {props.server.code}</Badge>
          <Badge>Сервер: {props.server.name}</Badge>
          <Badge>UX-default персонаж: {props.selectedCharacter.fullName}</Badge>
          <span>
            До первого сохранения персонажа можно сменить. Источник default:{" "}
            {props.selectedCharacter.source === "last_used" ? "last-used" : "first available"}.
          </span>
        </div>
        {props.status ? (
          <p className="text-sm leading-6 text-[var(--muted)]">Технический статус: {props.status}</p>
        ) : null}
      </Card>

      <Card className="space-y-4">
        <h2 className="text-2xl font-semibold">First-save snapshot capture</h2>
        <form action={createOgpComplaintDraftAction} className="space-y-4">
          <input name="serverSlug" type="hidden" value={props.server.code} />

          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--foreground)]" htmlFor="characterId">
              Персонаж для первого сохранения
            </label>
            <Select defaultValue={props.selectedCharacter.id} id="characterId" name="characterId">
              {props.characters.map((character) => (
                <option key={character.id} value={character.id}>
                  {character.fullName} ({character.passportNumber})
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--foreground)]" htmlFor="title">
              Название черновика
            </label>
            <Input defaultValue="Жалоба в ОГП" id="title" maxLength={160} name="title" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--foreground)]" htmlFor="workingNotes">
              Рабочие заметки foundation
            </label>
            <Textarea
              defaultValue=""
              id="workingNotes"
              name="workingNotes"
              placeholder="Пока это минимальный payload foundation. Полный OGP wizard появится следующим отдельным шагом."
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="submit">Создать persisted draft</Button>
            <DocumentLink href={`/servers/${props.server.code}/documents/ogp-complaints`}>
              Вернуться к persisted списку
            </DocumentLink>
          </div>
        </form>
      </Card>
    </div>
  );
}

export function OwnedDocumentUnavailableState(props: {
  server: {
    code: string;
    name: string;
  };
  documentId: string;
}) {
  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
            Owner Document Area
          </p>
          <Badge>owner-account only</Badge>
        </div>
        <h1 className="text-3xl font-semibold">Документ недоступен</h1>
        <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
          Документ `{props.documentId}` не найден в owner-account зоне этого сервера или не
          принадлежит текущему аккаунту.
        </p>
        <div className="flex flex-wrap gap-3">
          <DocumentLink href={`/servers/${props.server.code}/documents/ogp-complaints`}>
            Вернуться к persisted документам
          </DocumentLink>
          <DocumentLink href="/account/documents">Открыть общий обзор документов</DocumentLink>
        </div>
      </Card>
    </div>
  );
}

export function OgpComplaintPersistedEditor(props: {
  document: {
    id: string;
    title: string;
    status: "draft" | "generated" | "published";
    createdAt: string;
    updatedAt: string;
    snapshotCapturedAt: string;
    formSchemaVersion: string;
    server: {
      code: string;
      name: string;
    };
    authorSnapshot: {
      fullName: string;
      passportNumber: string;
      nickname: string;
      roleKeys: string[];
      accessFlags: string[];
    };
    workingNotes: string;
  };
  status?: string;
}) {
  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
            Owner Document Editor
          </p>
          <Badge>{formatDocumentStatus(props.document.status)}</Badge>
          <Badge>owner-account route</Badge>
        </div>
        <h1 className="text-3xl font-semibold">{props.document.title}</h1>
        <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
          Это уже реальный persisted draft route. Здесь загружается document owner-аккаунта,
          показывается зафиксированный snapshot и работает базовый autosave/manual save foundation.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-[var(--muted)]">
          <Badge>serverSlug: {props.document.server.code}</Badge>
          <Badge>Сервер: {props.document.server.name}</Badge>
          <Badge>Author snapshot: {props.document.authorSnapshot.fullName}</Badge>
          <span>Passport: {props.document.authorSnapshot.passportNumber}</span>
        </div>
        {props.status ? (
          <p className="text-sm leading-6 text-[var(--muted)]">Route status: {props.status}</p>
        ) : null}
      </Card>

      <Card className="space-y-4">
        <h2 className="text-2xl font-semibold">Persisted context</h2>
        <ul className="space-y-2 text-sm leading-6 text-[var(--muted)]">
          <li>Document ID: {props.document.id}</li>
          <li>Created at: {new Date(props.document.createdAt).toLocaleString("ru-RU")}</li>
          <li>Updated at: {new Date(props.document.updatedAt).toLocaleString("ru-RU")}</li>
          <li>
            Snapshot captured at: {new Date(props.document.snapshotCapturedAt).toLocaleString("ru-RU")}
          </li>
          <li>Form schema version: {props.document.formSchemaVersion}</li>
          <li>Nickname snapshot: {props.document.authorSnapshot.nickname}</li>
          <li>Role keys: {props.document.authorSnapshot.roleKeys.join(", ") || "нет"}</li>
          <li>Access flags: {props.document.authorSnapshot.accessFlags.join(", ") || "нет"}</li>
          <li>
            Server и character snapshot после first save больше не меняются в рамках этого шага.
          </li>
        </ul>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-2xl font-semibold">Draft persistence foundation</h2>
        <DocumentDraftEditorClient
          documentId={props.document.id}
          initialTitle={props.document.title}
          initialWorkingNotes={props.document.workingNotes}
          status={props.document.status}
          updatedAt={props.document.updatedAt}
        />
      </Card>
    </div>
  );
}
