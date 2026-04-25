import type { ReactNode } from "react";

import Link from "next/link";

import {
  AttorneyRequestDraftCreateClient,
  AttorneyRequestEditorClient,
} from "@/components/product/document-area/document-attorney-request-editor-client";
import {
  ClaimsDraftCreateClient,
  ClaimsDraftEditorClient,
} from "@/components/product/document-area/document-claims-editor-client";
import {
  LegalServicesAgreementDraftCreateClient,
  LegalServicesAgreementEditorClient,
} from "@/components/product/document-area/document-legal-services-agreement-editor-client";
import {
  DocumentDraftEditorClient,
  OgpComplaintDraftCreateClient,
} from "@/components/product/document-area/document-draft-editor-client";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type {
  AttorneyRequestDraftPayload,
  AttorneyRequestRenderedArtifact,
} from "@/features/documents/attorney-request/schemas";
import type {
  LegalServicesAgreementDraftPayload,
  LegalServicesAgreementRenderedArtifact,
} from "@/features/documents/legal-services-agreement/schemas";
import type {
  DocumentAreaPersistedListItem,
  DocumentAreaServerSummary,
  DocumentTrustorRegistrySummary,
} from "@/server/document-area/context";
import {
  buildDocumentEditorHref,
  getDocumentFamilyLabel,
  getDocumentOpenActionLabel,
  getDocumentSubtypeLabel,
  getDocumentTypeLabel,
} from "@/lib/documents/family-registry";
import { getDocumentTitleForType } from "@/server/document-area/persistence";
import type {
  ClaimDocumentType,
  ClaimsDraftPayload,
  ClaimsRenderedOutput,
  OgpForumSyncState,
  OgpComplaintDraftPayload,
} from "@/schemas/document";
import type { ForumConnectionSummary } from "@/schemas/forum-integration";

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

function formatDocumentSubtype(documentType: DocumentAreaPersistedListItem["documentType"]) {
  return getDocumentSubtypeLabel(documentType);
}

function formatClaimSubtype(documentType: ClaimDocumentType) {
  return documentType === "rehabilitation" ? "Rehabilitation" : "Lawsuit";
}

function formatForumConnectionState(state: ForumConnectionSummary["state"]) {
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

function formatForumSyncState(state: OgpForumSyncState | null) {
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

function formatDocumentStatus(status: DocumentAreaPersistedListItem["status"]) {
  if (status === "draft") {
    return "черновик";
  }

  if (status === "generated") {
    return "сгенерировано";
  }

  return "опубликовано";
}

function formatFilingMode(mode: DocumentAreaPersistedListItem["filingMode"]) {
  if (!mode) {
    return null;
  }

  return mode === "representative" ? "как представитель" : "от своего имени";
}

function PersistedDocumentList(props: {
  documents: DocumentAreaPersistedListItem[];
}) {
  if (props.documents.length === 0) {
    return (
      <Card className="space-y-3">
        <h2 className="text-2xl font-semibold">Документы пока не созданы</h2>
        <p className="text-sm leading-6 text-[var(--muted)]">
          У этого аккаунта пока нет сохранённых документов.
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
              <Badge>{getDocumentFamilyLabel(document.documentType)}</Badge>
              {formatDocumentSubtype(document.documentType) ? (
                <Badge>{formatDocumentSubtype(document.documentType)}</Badge>
              ) : (
                <Badge>{getDocumentTypeLabel(document.documentType)}</Badge>
              )}
              <Badge>{formatDocumentStatus(document.status)}</Badge>
              {document.dataHealth === "invalid_payload" ? (
                <Badge className="bg-[#f6d6d0] text-[#8a2d1d]">Требует восстановления</Badge>
              ) : null}
              {document.documentType === "ogp_complaint" && formatForumSyncState(document.forumSyncState) ? (
                <Badge>Форум: {formatForumSyncState(document.forumSyncState)}</Badge>
              ) : null}
              {formatFilingMode(document.filingMode) ? (
                <Badge>Подача: {formatFilingMode(document.filingMode)}</Badge>
              ) : null}
              <span className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                {document.server.name} / {document.server.code}
              </span>
            </div>
            <h3 className="text-xl font-semibold">{document.title}</h3>
            <p className="text-sm leading-6 text-[var(--muted)]">
              Персонаж: {document.authorSnapshot.fullName}, паспорт{" "}
              {document.authorSnapshot.passportNumber}. Данные сохранены:{" "}
              {new Date(document.snapshotCapturedAt).toLocaleString("ru-RU")}.
            </p>
            {document.dataHealth === "invalid_payload" ? (
              <p className="text-sm leading-6 text-[#8a2d1d]">
                Документ требует восстановления данных. Карточка открыта в безопасном режиме, часть
                полей скрыта до ручной проверки.
              </p>
            ) : null}
            {document.documentType === "ogp_complaint" &&
            document.dataHealth === "ok" &&
            (document.appealNumber || document.objectOrganization || document.objectFullName) ? (
              <p className="text-sm leading-6 text-[var(--muted)]">
                Номер обращения: {document.appealNumber || "не указан"}. Объект жалобы:{" "}
                {document.objectOrganization || "—"} / {document.objectFullName || "—"}.
              </p>
            ) : null}
            {document.documentType !== "ogp_complaint" && document.dataHealth === "ok" ? (
              <p className="text-sm leading-6 text-[var(--muted)]">
                {document.documentType === "attorney_request"
                  ? `Адвокатский запрос привязан к доверителю: ${document.trustorName ?? "не указан"}.`
                  : document.documentType === "legal_services_agreement"
                    ? `Договор привязан к доверителю: ${document.trustorName ?? "не указан"}. Текст берётся из reference template, а страницы выгружаются отдельно как PNG.`
                    : "Этот документ относится к разделу исков. Его данные и результат подготовки хранятся отдельно от жалоб в ОГП."}
              </p>
            ) : null}
            {document.documentType === "attorney_request" && document.dataHealth === "ok" ? (
              <p className="text-sm leading-6 text-[var(--muted)]">
                Номер запроса: {document.requestNumber || "не указан"}.
              </p>
            ) : null}
            {document.documentType === "legal_services_agreement" && document.dataHealth === "ok" ? (
              <p className="text-sm leading-6 text-[var(--muted)]">
                Номер договора: {document.agreementNumber || "не указан"}.
              </p>
            ) : null}
            <p className="text-sm leading-6 text-[var(--muted)]">
              Последнее обновление: {new Date(document.updatedAt).toLocaleString("ru-RU")}.
            </p>
            {document.generatedAt ? (
              <p className="text-sm leading-6 text-[var(--muted)]">
                Сгенерировано: {new Date(document.generatedAt).toLocaleString("ru-RU")}.
                {document.isModifiedAfterGeneration ? " После генерации есть несинхронизированные изменения." : ""}
              </p>
            ) : null}
            {document.publicationUrl ? (
              <p className="text-sm leading-6 text-[var(--muted)]">
                Ссылка на публикацию: {document.publicationUrl}. Отмечено как опубликованное вручную: {document.isSiteForumSynced ? "да" : "нет"}.
                {document.forumSyncState ? ` Статус: ${formatForumSyncState(document.forumSyncState)}.` : ""}
              </p>
            ) : null}
            {document.documentType === "ogp_complaint" && document.forumLastSyncError ? (
              <p className="text-sm leading-6 text-[#8a2d1d]">
                Последняя ошибка публикации: {document.forumLastSyncError}
              </p>
            ) : null}
            {document.workingNotesPreview ? (
              <p className="text-sm leading-6 text-[var(--muted)]">
                Рабочие заметки: {document.workingNotesPreview}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <DocumentLink
              href={buildDocumentEditorHref({
                serverCode: document.server.code,
                documentId: document.id,
                documentType: document.documentType,
              })}
            >
              {getDocumentOpenActionLabel(document.documentType)}
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
          Документы
        </p>
        <h1 className="text-3xl font-semibold">Мои документы</h1>
        <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
          Здесь собраны ваши сохранённые документы по всем серверам. Создание и редактирование
          открываются из раздела конкретного сервера.
        </p>
      </Card>

      <PersistedDocumentList documents={props.documents} />

      <Card className="space-y-4">
        <h2 className="text-2xl font-semibold">Документы по серверам</h2>
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
                  Персонажей на сервере: {server.characterCount}. Жалоб в ОГП:{" "}
                  {server.ogpComplaintDocumentCount}. Адвокатских запросов:{" "}
                  {server.attorneyRequestDocumentCount}. Договоров:{" "}
                  {server.legalServicesAgreementDocumentCount ?? 0}. Других документов:{" "}
                  {server.claimsDocumentCount}. Откройте сервер, чтобы создать или отредактировать
                  документы.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <DocumentLink href={`/servers/${server.code}/documents`}>
                  Открыть документы сервера
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
    isProfileComplete: boolean;
    canUseRepresentative: boolean;
  } | null;
}) {
  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
          Жалобы в ОГП
        </p>
        <h1 className="text-3xl font-semibold">Жалобы в ОГП</h1>
        <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
          Здесь отображаются сохранённые жалобы в ОГП на выбранном сервере.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-[var(--muted)]">
          <Badge>Код сервера: {props.server.code}</Badge>
          <Badge>Сервер: {props.server.name}</Badge>
          {props.selectedCharacter ? (
            <>
              <Badge>Персонаж: {props.selectedCharacter.fullName}</Badge>
              <span>
                Выбор:{" "}
                {props.selectedCharacter.source === "last_used" ? "последний использованный" : "первый доступный"}
              </span>
              <span>
                Может подавать как представитель: {props.selectedCharacter.canUseRepresentative ? "да" : "нет"}
              </span>
            </>
          ) : (
            <Badge>Создание недоступно: на сервере нет персонажей</Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          {props.canCreateDocuments ? (
            <DocumentLink href={`/servers/${props.server.code}/documents/ogp-complaints/new`}>
              Создать черновик
            </DocumentLink>
          ) : null}
          <DocumentLink href={`/servers/${props.server.code}/documents`}>
            Вернуться к документам сервера
          </DocumentLink>
        </div>
      </Card>

      {!props.canCreateDocuments ? (
        <Card className="space-y-3">
          <h2 className="text-2xl font-semibold">Создание временно недоступно</h2>
          <p className="text-sm leading-6 text-[var(--muted)]">
            На сервере сейчас нет доступных персонажей, поэтому новую жалобу создать нельзя.
            Уже сохранённые черновики остаются доступны.
          </p>
        </Card>
      ) : null}

      <PersistedDocumentList documents={props.documents} />
    </div>
  );
}

export function AttorneyRequestFamilyPersistedList(props: {
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
    isProfileComplete: boolean;
    canCreateAttorneyRequest?: boolean;
  } | null;
  trustorRegistry: DocumentTrustorRegistrySummary[];
}) {
  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
          Адвокатские запросы
        </p>
        <h1 className="text-3xl font-semibold">Адвокатские запросы</h1>
        <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
          Здесь отображаются сохранённые адвокатские запросы на выбранном сервере. Каждый
          запрос фиксируется за конкретным доверителем при первом сохранении.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-[var(--muted)]">
          <Badge>Код сервера: {props.server.code}</Badge>
          <Badge>Сервер: {props.server.name}</Badge>
          {props.selectedCharacter ? (
            <>
              <Badge>Персонаж: {props.selectedCharacter.fullName}</Badge>
              <span>
                Роль адвоката: {props.selectedCharacter.canCreateAttorneyRequest ? "есть" : "нет"}
              </span>
            </>
          ) : (
            <Badge>Создание недоступно: на сервере нет персонажей</Badge>
          )}
          <span>Доверителей на сервере: {props.trustorRegistry.length}</span>
        </div>
        <div className="flex flex-wrap gap-3">
          {props.canCreateDocuments ? (
            <DocumentLink href={`/servers/${props.server.code}/documents/attorney-requests/new`}>
              Создать адвокатский запрос
            </DocumentLink>
          ) : null}
          <DocumentLink href={`/servers/${props.server.code}/documents`}>
            Вернуться к документам сервера
          </DocumentLink>
        </div>
      </Card>

      {!props.canCreateDocuments ? (
        <Card className="space-y-3">
          <h2 className="text-2xl font-semibold">Создание пока недоступно</h2>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Для создания нужен персонаж с ролью адвоката и хотя бы один доверитель на этом
            сервере. Сохранённые запросы при этом остаются доступны.
          </p>
        </Card>
      ) : null}

      <PersistedDocumentList documents={props.documents} />
    </div>
  );
}

export function LegalServicesAgreementFamilyPersistedList(props: {
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
    isProfileComplete: boolean;
    hasActiveSignature?: boolean;
  } | null;
  trustorRegistry: DocumentTrustorRegistrySummary[];
}) {
  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
          Договоры на оказание юридических услуг
        </p>
        <h1 className="text-3xl font-semibold">Договоры на оказание юридических услуг</h1>
        <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
          Это rigid-template family внутри server documents hub. Static эталон берётся из
          reference PDF, текст не редактируется свободно, а генерация собирает отдельные PNG по
          страницам.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-[var(--muted)]">
          <Badge>Код сервера: {props.server.code}</Badge>
          <Badge>Сервер: {props.server.name}</Badge>
          {props.selectedCharacter ? (
            <>
              <Badge>Персонаж: {props.selectedCharacter.fullName}</Badge>
            </>
          ) : (
            <Badge>Создание недоступно: на сервере нет персонажей</Badge>
          )}
          <span>Доверителей на сервере: {props.trustorRegistry.length}</span>
        </div>
        <div className="flex flex-wrap gap-3">
          {props.canCreateDocuments ? (
            <DocumentLink href={`/servers/${props.server.code}/documents/legal-services-agreements/new`}>
              Создать договор
            </DocumentLink>
          ) : null}
          <DocumentLink href={`/servers/${props.server.code}/documents`}>
            Вернуться к документам сервера
          </DocumentLink>
        </div>
      </Card>

      {!props.canCreateDocuments ? (
        <Card className="space-y-3">
        <h2 className="text-2xl font-semibold">Создание пока недоступно</h2>
        <p className="text-sm leading-6 text-[var(--muted)]">
            Для создания нужен хотя бы один персонаж и хотя бы один доверитель на этом сервере.
            Уже сохранённые договоры остаются доступны.
          </p>
        </Card>
      ) : null}

      <PersistedDocumentList documents={props.documents} />
    </div>
  );
}

function buildInitialCreatePayload(): OgpComplaintDraftPayload {
  return {
    filingMode: "self",
    appealNumber: "",
    objectOrganization: "",
    objectFullName: "",
    incidentAt: "",
    situationDescription: "",
    violationSummary: "",
    workingNotes: "",
    trustorSnapshot: null,
    evidenceItems: [],
  };
}

function buildInitialClaimsCreatePayload(documentType: ClaimDocumentType): ClaimsDraftPayload {
  const commonFields = {
    filingMode: "self" as const,
    respondentName: "",
    claimSubject: "",
    factualBackground: "",
    legalBasisSummary: "",
    requestedRelief: "",
    workingNotes: "",
    trustorSnapshot: null,
    evidenceGroups: [],
  };

  if (documentType === "rehabilitation") {
    return {
      ...commonFields,
      caseReference: "",
      rehabilitationBasis: "",
      harmSummary: "",
    };
  }

  return {
    ...commonFields,
    courtName: "",
    defendantName: "",
    claimAmount: "",
    pretrialSummary: "",
  };
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
    isProfileComplete: boolean;
    canUseRepresentative: boolean;
  }>;
  selectedCharacter: {
    id: string;
    fullName: string;
    passportNumber: string;
    source: "last_used" | "first_available";
    isProfileComplete: boolean;
    canUseRepresentative: boolean;
  };
  trustorRegistry: DocumentTrustorRegistrySummary[];
  status?: string;
}) {
  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
          Новая жалоба
        </p>
        <h1 className="text-3xl font-semibold">Новая жалоба в ОГП</h1>
        <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
          Создайте черновик жалобы. После первого сохранения откроется обычный редактор документа.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-[var(--muted)]">
          <Badge>Код сервера: {props.server.code}</Badge>
          <Badge>Сервер: {props.server.name}</Badge>
          <Badge>Персонаж: {props.selectedCharacter.fullName}</Badge>
          <span>
            До первого сохранения персонажа можно сменить. Сейчас выбран{" "}
            {props.selectedCharacter.source === "last_used" ? "последний использованный" : "первый доступный"} персонаж.
          </span>
        </div>
        {props.status ? (
          <p className="text-sm leading-6 text-[var(--muted)]">Технический статус: {props.status}</p>
        ) : null}
      </Card>

      <Card className="space-y-4">
        <h2 className="text-2xl font-semibold">Черновик жалобы</h2>
        <p className="text-sm leading-6 text-[var(--muted)]">
          Заполните основные поля и сохраните черновик. Генерация BBCode и публикация на форуме
          будут доступны после сохранения.
        </p>
        <OgpComplaintDraftCreateClient
          characters={props.characters}
          initialPayload={buildInitialCreatePayload()}
          initialTitle="Жалоба в ОГП"
          selectedCharacter={props.selectedCharacter}
          server={props.server}
          trustorRegistry={props.trustorRegistry}
        />
      </Card>
    </div>
  );
}

export function AttorneyRequestDraftCreateEntry(props: {
  server: {
    code: string;
    name: string;
  };
  characters: Array<{
    id: string;
    fullName: string;
    passportNumber: string;
    isProfileComplete: boolean;
    canCreateAttorneyRequest?: boolean;
    hasActiveSignature: boolean;
  }>;
  selectedCharacter: {
    id: string;
    fullName: string;
    passportNumber: string;
    source: "last_used" | "first_available";
    isProfileComplete: boolean;
    canCreateAttorneyRequest?: boolean;
    hasActiveSignature: boolean;
  };
  trustorRegistry: DocumentTrustorRegistrySummary[];
  status?: string;
  initialTrustorId?: string | null;
}) {
  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
          Новый адвокатский запрос
        </p>
        <h1 className="text-3xl font-semibold">Новый адвокатский запрос</h1>
        <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
          Создайте черновик запроса. После первого сохранения сервер, персонаж и доверитель
          фиксируются в документе.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-[var(--muted)]">
          <Badge>Код сервера: {props.server.code}</Badge>
          <Badge>Сервер: {props.server.name}</Badge>
          <Badge>Персонаж: {props.selectedCharacter.fullName}</Badge>
          <span>
            Источник выбора:{" "}
            {props.selectedCharacter.source === "last_used" ? "последний использованный" : "первый доступный"}.
          </span>
        </div>
        {props.status ? (
          <p className="text-sm leading-6 text-[var(--muted)]">Статус: {props.status}</p>
        ) : null}
      </Card>

      <Card className="space-y-4">
        <h2 className="text-2xl font-semibold">Черновик запроса</h2>
        <p className="text-sm leading-6 text-[var(--muted)]">
          Неполный черновик можно сохранить. Генерация preview / PDF / JPG станет доступна
          после заполнения обязательных полей.
        </p>
        <AttorneyRequestDraftCreateClient
          characters={props.characters}
          initialTitle="Адвокатский запрос"
          initialTrustorId={props.initialTrustorId}
          selectedCharacter={props.selectedCharacter}
          server={props.server}
          trustorRegistry={props.trustorRegistry}
        />
      </Card>
    </div>
  );
}

export function LegalServicesAgreementDraftCreateEntry(props: {
  server: {
    code: string;
    name: string;
  };
  characters: Array<{
    id: string;
    fullName: string;
    passportNumber: string;
    isProfileComplete: boolean;
    hasActiveSignature?: boolean;
  }>;
  selectedCharacter: {
    id: string;
    fullName: string;
    passportNumber: string;
    source: "last_used" | "first_available";
    isProfileComplete: boolean;
    hasActiveSignature?: boolean;
  };
  trustorRegistry: DocumentTrustorRegistrySummary[];
  status?: string;
}) {
  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
          Новый договор
        </p>
        <h1 className="text-3xl font-semibold">Новый договор на оказание юридических услуг</h1>
        <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
          После первого сохранения сервер, персонаж и доверитель фиксируются, а дальше документ
          редактируется только как owner-only rigid template.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-[var(--muted)]">
          <Badge>Код сервера: {props.server.code}</Badge>
          <Badge>Сервер: {props.server.name}</Badge>
          <Badge>Персонаж: {props.selectedCharacter.fullName}</Badge>
          <span>
            Источник выбора:{" "}
            {props.selectedCharacter.source === "last_used" ? "последний использованный" : "первый доступный"}.
          </span>
        </div>
        {props.status ? (
          <p className="text-sm leading-6 text-[var(--muted)]">Статус: {props.status}</p>
        ) : null}
      </Card>

      <Card className="space-y-4">
        <h2 className="text-2xl font-semibold">Черновик договора</h2>
        <p className="text-sm leading-6 text-[var(--muted)]">
          Здесь заполняются только утверждённые ручные поля договора. Остальные данные подставляются
          из frozen snapshots персонажа и доверителя.
        </p>
        <LegalServicesAgreementDraftCreateClient
          characters={props.characters}
          initialTitle={getDocumentTitleForType("legal_services_agreement")}
          selectedCharacter={props.selectedCharacter}
          server={props.server}
          trustorRegistry={props.trustorRegistry}
        />
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
  familyHref?: string;
  familyLabel?: string;
}) {
  const familyHref = props.familyHref ?? `/servers/${props.server.code}/documents/ogp-complaints`;
  const familyLabel = props.familyLabel ?? "сохранённым документам";

  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
            Документ
          </p>
          <Badge>только для владельца</Badge>
        </div>
        <h1 className="text-3xl font-semibold">Документ недоступен</h1>
        <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
          Документ `{props.documentId}` не найден на этом сервере или не принадлежит текущему
          аккаунту.
        </p>
        <div className="flex flex-wrap gap-3">
          <DocumentLink href={familyHref}>
            Вернуться к {familyLabel}
          </DocumentLink>
          <DocumentLink href="/account/documents">Открыть общий обзор документов</DocumentLink>
        </div>
      </Card>
    </div>
  );
}

export function InvalidDocumentDataState(props: {
  server: {
    code: string;
    name: string;
  };
  document: {
    id: string;
    title: string;
    status: "draft" | "generated" | "published";
    createdAt: string;
    updatedAt: string;
    snapshotCapturedAt: string;
  };
  familyHref: string;
  familyLabel: string;
}) {
  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
            Документ
          </p>
          <Badge className="bg-[#f6d6d0] text-[#8a2d1d]">Требует восстановления</Badge>
        </div>
        <h1 className="text-3xl font-semibold">{props.document.title}</h1>
        <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
          Данные документа `{props.document.id}` не удалось безопасно прочитать. Сам документ не
          удалён, но его payload или snapshots повреждены либо устарели и требуют ручного
          восстановления.
        </p>
        <div className="space-y-1 text-sm leading-6 text-[var(--muted)]">
          <p>Статус: {formatDocumentStatus(props.document.status)}.</p>
          <p>Сохранено: {new Date(props.document.snapshotCapturedAt).toLocaleString("ru-RU")}.</p>
          <p>Последнее обновление: {new Date(props.document.updatedAt).toLocaleString("ru-RU")}.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <DocumentLink href={props.familyHref}>
            Вернуться к {props.familyLabel}
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
        lastGeneratedBbcode: string | null;
        generatedAt: string | null;
        generatedLawVersion: string | null;
        generatedTemplateVersion: string | null;
        generatedFormSchemaVersion: string | null;
        publicationUrl: string | null;
        isSiteForumSynced: boolean;
        forumSyncState: OgpForumSyncState;
        forumThreadId: string | null;
        forumPostId: string | null;
        forumPublishedBbcodeHash: string | null;
        forumLastPublishedAt: string | null;
        forumLastSyncError: string | null;
        isModifiedAfterGeneration: boolean;
        forumConnection: ForumConnectionSummary;
        server: {
          code: string;
          name: string;
    };
    authorSnapshot: {
      fullName: string;
      passportNumber: string;
      position?: string;
      address?: string;
      phone?: string;
      icEmail?: string;
      passportImageUrl?: string;
      nickname: string;
      roleKeys: string[];
      accessFlags: string[];
      isProfileComplete: boolean;
    };
    trustorRegistry: DocumentTrustorRegistrySummary[];
    payload: OgpComplaintDraftPayload;
  };
  status?: string;
}) {
  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
            Редактор жалобы
          </p>
          <Badge>{formatDocumentStatus(props.document.status)}</Badge>
          <Badge>только для владельца</Badge>
          <Badge>Подача: {formatFilingMode(props.document.payload.filingMode)}</Badge>
        </div>
        <h1 className="text-3xl font-semibold">{props.document.title}</h1>
        <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
          Здесь можно редактировать жалобу в ОГП, сохранить черновик, сгенерировать BBCode и
          подготовить публикацию на форуме.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-[var(--muted)]">
          <Badge>Код сервера: {props.document.server.code}</Badge>
          <Badge>Сервер: {props.document.server.name}</Badge>
          <Badge>Персонаж: {props.document.authorSnapshot.fullName}</Badge>
          <span>Паспорт: {props.document.authorSnapshot.passportNumber}</span>
        </div>
        {props.status ? (
          <p className="text-sm leading-6 text-[var(--muted)]">Статус: {props.status}</p>
        ) : null}
      </Card>

      <Card className="space-y-4">
        <h2 className="text-2xl font-semibold">Служебные сведения</h2>
        <ul className="space-y-2 text-sm leading-6 text-[var(--muted)]">
          <li>ID документа: {props.document.id}</li>
          <li>Создано: {new Date(props.document.createdAt).toLocaleString("ru-RU")}</li>
          <li>Обновлено: {new Date(props.document.updatedAt).toLocaleString("ru-RU")}</li>
          <li>
            Данные персонажа сохранены: {new Date(props.document.snapshotCapturedAt).toLocaleString("ru-RU")}
          </li>
          <li>Версия формы: {props.document.formSchemaVersion}</li>
          <li>Ник: {props.document.authorSnapshot.nickname}</li>
          <li>Роли: {props.document.authorSnapshot.roleKeys.join(", ") || "нет"}</li>
          <li>Доступы: {props.document.authorSnapshot.accessFlags.join(", ") || "нет"}</li>
          <li>
            Сервер и выбранный персонаж после первого сохранения не меняются.
          </li>
          <li>
            Генерация: {props.document.generatedAt ? "BBCode уже создан" : "ещё не выполнялась"}.
          </li>
          <li>Подключение форума: {formatForumConnectionState(props.document.forumConnection.state)}.</li>
          <li>Статус публикации: {formatForumSyncState(props.document.forumSyncState)}.</li>
          <li>
            Опубликовано через приложение:{" "}
            {props.document.forumThreadId && props.document.forumPostId ? "да" : "нет"}
          </li>
          <li>
            Последняя публикация на форуме:{" "}
            {props.document.forumLastPublishedAt
              ? new Date(props.document.forumLastPublishedAt).toLocaleString("ru-RU")
              : "ещё не публиковался"}
          </li>
          {props.document.forumLastSyncError ? (
            <li>Последняя ошибка публикации: {props.document.forumLastSyncError}</li>
          ) : null}
        </ul>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-2xl font-semibold">Подключение форума</h2>
        <p className="text-sm leading-6 text-[var(--muted)]">
          Подключение форума управляется в настройках аккаунта. Редактор использует его только
          для публикации жалобы в ОГП.
        </p>
        <ul className="space-y-2 text-sm leading-6 text-[var(--muted)]">
          <li>Форум: {props.document.forumConnection.providerKey}</li>
          <li>Статус: {formatForumConnectionState(props.document.forumConnection.state)}</li>
          <li>
            Форумный аккаунт:{" "}
            {props.document.forumConnection.forumUsername ?? "ещё не извлечена"}
            {props.document.forumConnection.forumUserId
              ? ` (${props.document.forumConnection.forumUserId})`
              : ""}
          </li>
          <li>
            Последняя проверка:{" "}
            {props.document.forumConnection.validatedAt
              ? new Date(props.document.forumConnection.validatedAt).toLocaleString("ru-RU")
              : "ещё не подтверждалась"}
          </li>
          {props.document.forumConnection.lastValidationError ? (
            <li>Последняя ошибка проверки: {props.document.forumConnection.lastValidationError}</li>
          ) : null}
        </ul>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-2xl font-semibold">Редактор жалобы в ОГП</h2>
        <DocumentDraftEditorClient
          authorSnapshot={{
            canUseRepresentative: props.document.authorSnapshot.accessFlags.includes("advocate"),
            address: props.document.authorSnapshot.address,
            fullName: props.document.authorSnapshot.fullName,
            icEmail: props.document.authorSnapshot.icEmail,
            isProfileComplete: props.document.authorSnapshot.isProfileComplete,
            passportNumber: props.document.authorSnapshot.passportNumber,
            passportImageUrl: props.document.authorSnapshot.passportImageUrl,
            phone: props.document.authorSnapshot.phone,
            position: props.document.authorSnapshot.position,
          }}
          documentId={props.document.id}
          generatedFormSchemaVersion={props.document.generatedFormSchemaVersion}
          generatedAt={props.document.generatedAt}
          generatedLawVersion={props.document.generatedLawVersion}
          generatedTemplateVersion={props.document.generatedTemplateVersion}
          initialIsModifiedAfterGeneration={props.document.isModifiedAfterGeneration}
          initialIsSiteForumSynced={props.document.isSiteForumSynced}
          initialLastGeneratedBbcode={props.document.lastGeneratedBbcode}
          initialForumLastPublishedAt={props.document.forumLastPublishedAt}
          initialForumLastSyncError={props.document.forumLastSyncError}
          initialForumPostId={props.document.forumPostId}
          initialForumPublishedBbcodeHash={props.document.forumPublishedBbcodeHash}
          initialForumSyncState={props.document.forumSyncState}
          initialForumThreadId={props.document.forumThreadId}
          initialPublicationUrl={props.document.publicationUrl}
          initialPayload={props.document.payload}
          initialTitle={props.document.title}
          server={props.document.server}
          status={props.document.status}
          forumConnection={props.document.forumConnection}
          trustorRegistry={props.document.trustorRegistry}
          updatedAt={props.document.updatedAt}
        />
      </Card>
    </div>
  );
}

export function ClaimsFamilyPersistedList(props: {
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
    isProfileComplete: boolean;
  } | null;
}) {
  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Claims Family</p>
        <h1 className="text-3xl font-semibold">Claims</h1>
        <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
          Это уже не purely foundation route: здесь читаются реальные persisted документы family
          `Claims` на выбранном сервере. User-facing family остаётся одной, а subtype
          фиксируется через internal `document_type`.
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
            <DocumentLink href={`/servers/${props.server.code}/documents/claims/new`}>
              Создать новый claim draft
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
            На сервере сейчас нет доступных персонажей, поэтому новый claim создать нельзя.
            Existing persisted drafts при этом остаются доступны owner-аккаунту.
          </p>
        </Card>
      ) : null}

      <PersistedDocumentList documents={props.documents} />
    </div>
  );
}

export function ClaimsDraftCreateEntry(props: {
  server: {
    code: string;
    name: string;
  };
  documentType: ClaimDocumentType;
  characters: Array<{
    id: string;
    fullName: string;
    passportNumber: string;
    isProfileComplete: boolean;
    canUseRepresentative: boolean;
  }>;
  selectedCharacter: {
    id: string;
    fullName: string;
    passportNumber: string;
    source: "last_used" | "first_available";
    isProfileComplete: boolean;
    canUseRepresentative: boolean;
  };
  trustorRegistry: DocumentTrustorRegistrySummary[];
  status?: string;
}) {
  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Claims Draft</p>
        <h1 className="text-3xl font-semibold">Новый claim</h1>
        <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
          `/new` отвечает за pre-draft create entry. После первого сохранения работа продолжается
          в owner-only route `[documentId]`, а subtype `{formatClaimSubtype(props.documentType)}`
          становится immutable.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-[var(--muted)]">
          <Badge>serverSlug: {props.server.code}</Badge>
          <Badge>Сервер: {props.server.name}</Badge>
          <Badge>Subtype: {formatClaimSubtype(props.documentType)}</Badge>
          <Badge>UX-default персонаж: {props.selectedCharacter.fullName}</Badge>
          <span>
            До first save персонажа можно сменить. Источник default:{" "}
            {props.selectedCharacter.source === "last_used" ? "last-used" : "first available"}.
          </span>
        </div>
        {props.status ? (
          <p className="text-sm leading-6 text-[var(--muted)]">Технический статус: {props.status}</p>
        ) : null}
      </Card>

        <Card className="space-y-4">
          <h2 className="text-2xl font-semibold">Claims create entry</h2>
          <p className="text-sm leading-6 text-[var(--muted)]">
            На этом route создаётся persisted claims draft, фиксируется immutable author snapshot,
            а subtype-specific payload уже собирается внутри editor flow без generation/publication слоя.
          </p>
          <ClaimsDraftCreateClient
            characters={props.characters}
          documentType={props.documentType}
          initialPayload={buildInitialClaimsCreatePayload(props.documentType)}
          initialTitle={getDocumentTitleForType(props.documentType)}
          selectedCharacter={props.selectedCharacter}
          server={props.server}
          trustorRegistry={props.trustorRegistry}
        />
      </Card>
    </div>
  );
}

export function ClaimsPersistedEditor(props: {
  document: {
    id: string;
    title: string;
    documentType: ClaimDocumentType;
    status: "draft" | "generated" | "published";
    createdAt: string;
    updatedAt: string;
    snapshotCapturedAt: string;
    formSchemaVersion: string;
    generatedAt: string | null;
    generatedFormSchemaVersion: string | null;
    generatedOutputFormat: string | null;
    generatedRendererVersion: string | null;
    generatedArtifact: ClaimsRenderedOutput | null;
    isModifiedAfterGeneration: boolean;
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
      isProfileComplete: boolean;
    };
    trustorRegistry: DocumentTrustorRegistrySummary[];
    payload: ClaimsDraftPayload;
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
          <Badge>Subtype: {formatClaimSubtype(props.document.documentType)}</Badge>
        </div>
        <h1 className="text-3xl font-semibold">{props.document.title}</h1>
        <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
          Это уже реальный claims editor route. Здесь грузится persisted draft, работает
          owner-only access, базовый manual/autosave foundation и claims generated checkpoint без
          publication слоя.
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
          <li>Subtype: {formatClaimSubtype(props.document.documentType)}</li>
          <li>Created at: {new Date(props.document.createdAt).toLocaleString("ru-RU")}</li>
          <li>Updated at: {new Date(props.document.updatedAt).toLocaleString("ru-RU")}</li>
          <li>
            Snapshot captured at: {new Date(props.document.snapshotCapturedAt).toLocaleString("ru-RU")}
          </li>
          <li>Form schema version: {props.document.formSchemaVersion}</li>
          <li>
            Generated at:{" "}
            {props.document.generatedAt
              ? new Date(props.document.generatedAt).toLocaleString("ru-RU")
              : "ещё не фиксировался"}
          </li>
          <li>Generated form schema version: {props.document.generatedFormSchemaVersion ?? "ещё не зафиксирована"}</li>
          <li>Generated output format: {props.document.generatedOutputFormat ?? "ещё не зафиксирован"}</li>
          <li>Generated renderer version: {props.document.generatedRendererVersion ?? "ещё не зафиксирована"}</li>
          <li>
            Modified after generation: {props.document.isModifiedAfterGeneration ? "да" : "нет"}
          </li>
          <li>Nickname snapshot: {props.document.authorSnapshot.nickname}</li>
          <li>Role keys: {props.document.authorSnapshot.roleKeys.join(", ") || "нет"}</li>
          <li>Access flags: {props.document.authorSnapshot.accessFlags.join(", ") || "нет"}</li>
          <li>Server, character snapshot и subtype после first save больше не меняются.</li>
          <li>Claims generated checkpoint не активирует publication workflow и не использует OGP BBCode.</li>
        </ul>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-2xl font-semibold">Claims editor MVP</h2>
        <ClaimsDraftEditorClient
          authorSnapshot={{
            canUseRepresentative: props.document.authorSnapshot.accessFlags.includes("advocate"),
            fullName: props.document.authorSnapshot.fullName,
            isProfileComplete: props.document.authorSnapshot.isProfileComplete,
            passportNumber: props.document.authorSnapshot.passportNumber,
          }}
          documentId={props.document.id}
          documentType={props.document.documentType}
          generatedArtifact={props.document.generatedArtifact}
          generatedAt={props.document.generatedAt}
          generatedFormSchemaVersion={props.document.generatedFormSchemaVersion}
          generatedOutputFormat={props.document.generatedOutputFormat}
          generatedRendererVersion={props.document.generatedRendererVersion}
          initialPayload={props.document.payload}
          isModifiedAfterGeneration={props.document.isModifiedAfterGeneration}
          initialTitle={props.document.title}
          server={props.document.server}
          status={props.document.status}
          trustorRegistry={props.document.trustorRegistry}
          updatedAt={props.document.updatedAt}
        />
      </Card>
    </div>
  );
}

export function AttorneyRequestPersistedEditor(props: {
  document: {
    id: string;
    title: string;
    status: "draft" | "generated" | "published";
    createdAt: string;
    updatedAt: string;
    snapshotCapturedAt: string;
    formSchemaVersion: string;
    generatedAt: string | null;
    generatedFormSchemaVersion: string | null;
    generatedOutputFormat: string | null;
    generatedRendererVersion: string | null;
    generatedArtifact: AttorneyRequestRenderedArtifact | null;
    isModifiedAfterGeneration: boolean;
    hasActiveCharacterSignature: boolean;
    signatureSnapshot: {
      signatureId: string;
      storagePath: string;
      mimeType: string;
      width: number;
      height: number;
      fileSize: number;
    } | null;
    server: {
      code: string;
      name: string;
    };
    authorSnapshot: {
      fullName: string;
      passportNumber: string;
      position?: string;
      address?: string;
      phone?: string;
      icEmail?: string;
      passportImageUrl?: string;
      nickname: string;
      roleKeys: string[];
      accessFlags: string[];
      isProfileComplete: boolean;
    };
    payload: AttorneyRequestDraftPayload;
  };
  status?: string;
}) {
  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
            Редактор адвокатского запроса
          </p>
          <Badge>{formatDocumentStatus(props.document.status)}</Badge>
          <Badge>только для владельца</Badge>
        </div>
        <h1 className="text-3xl font-semibold">{props.document.title}</h1>
        <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
          Здесь можно сохранить черновик, проверить данные и сгенерировать preview / PDF / JPG.
          Документ привязан к доверителю и не зависит от дальнейших изменений карточки доверителя.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-[var(--muted)]">
          <Badge>Код сервера: {props.document.server.code}</Badge>
          <Badge>Сервер: {props.document.server.name}</Badge>
          <Badge>Персонаж: {props.document.authorSnapshot.fullName}</Badge>
          <Badge>Доверитель: {props.document.payload.trustorSnapshot.fullName}</Badge>
          <span>Номер запроса: {props.document.payload.requestNumberNormalized || "не указан"}</span>
        </div>
        {props.status ? (
          <p className="text-sm leading-6 text-[var(--muted)]">Статус: {props.status}</p>
        ) : null}
      </Card>

      <Card className="space-y-4">
        <h2 className="text-2xl font-semibold">Служебные сведения</h2>
        <ul className="space-y-2 text-sm leading-6 text-[var(--muted)]">
          <li>ID документа: {props.document.id}</li>
          <li>Создано: {new Date(props.document.createdAt).toLocaleString("ru-RU")}</li>
          <li>Обновлено: {new Date(props.document.updatedAt).toLocaleString("ru-RU")}</li>
          <li>
            Снимок персонажа и доверителя сохранён:{" "}
            {new Date(props.document.snapshotCapturedAt).toLocaleString("ru-RU")}
          </li>
          <li>Версия формы: {props.document.formSchemaVersion}</li>
          <li>Ник персонажа: {props.document.authorSnapshot.nickname}</li>
          <li>Роли: {props.document.authorSnapshot.roleKeys.join(", ") || "нет"}</li>
          <li>
            Должность для шаблона:{" "}
            {props.document.payload.signerTitleSnapshot?.bodyRu ?? props.document.authorSnapshot.position ?? "не указана"}
          </li>
          <li>
            Подпись персонажа в документе:{" "}
            {props.document.signatureSnapshot
              ? "снимок подписи уже зафиксирован"
              : props.document.hasActiveCharacterSignature
                ? "текущая активная подпись будет зафиксирована при генерации"
                : "активная подпись пока не загружена"}
            .
          </li>
          <li>
            Генерация: {props.document.generatedAt ? "результат уже создан" : "ещё не выполнялась"}.
          </li>
          <li>
            Изменено после генерации: {props.document.isModifiedAfterGeneration ? "да" : "нет"}.
          </li>
        </ul>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-2xl font-semibold">Редактор запроса</h2>
        <AttorneyRequestEditorClient
          documentId={props.document.id}
          generatedArtifact={props.document.generatedArtifact}
          generatedAt={props.document.generatedAt}
          generatedOutputFormat={props.document.generatedOutputFormat}
          generatedRendererVersion={props.document.generatedRendererVersion}
          hasActiveCharacterSignature={props.document.hasActiveCharacterSignature}
          hasSignatureSnapshot={props.document.signatureSnapshot !== null}
          initialPayload={props.document.payload}
          initialTitle={props.document.title}
          isModifiedAfterGeneration={props.document.isModifiedAfterGeneration}
          server={props.document.server}
          status={props.document.status}
          updatedAt={props.document.updatedAt}
        />
      </Card>
    </div>
  );
}

export function LegalServicesAgreementPersistedEditor(props: {
  document: {
    id: string;
    title: string;
    status: "draft" | "generated" | "published";
    createdAt: string;
    updatedAt: string;
    snapshotCapturedAt: string;
    formSchemaVersion: string;
    generatedAt: string | null;
    generatedFormSchemaVersion: string | null;
    generatedOutputFormat: string | null;
    generatedRendererVersion: string | null;
    generatedArtifact: LegalServicesAgreementRenderedArtifact | null;
    isModifiedAfterGeneration: boolean;
    server: {
      code: string;
      name: string;
    };
    authorSnapshot: {
      fullName: string;
      passportNumber: string;
      position?: string;
      address?: string;
      phone?: string;
      icEmail?: string;
      passportImageUrl?: string;
      nickname: string;
      roleKeys: string[];
      accessFlags: string[];
      isProfileComplete: boolean;
    };
    payload: LegalServicesAgreementDraftPayload;
  };
  status?: string;
}) {
  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
            Редактор договора
          </p>
          <Badge>{formatDocumentStatus(props.document.status)}</Badge>
          <Badge>только для владельца</Badge>
        </div>
        <h1 className="text-3xl font-semibold">{props.document.title}</h1>
        <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
          Это rigid-template editor для reference PDF. Static текст договора не редактируется, а
          генерация собирает postраничный PNG-export.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-[var(--muted)]">
          <Badge>Код сервера: {props.document.server.code}</Badge>
          <Badge>Сервер: {props.document.server.name}</Badge>
          <Badge>Персонаж: {props.document.authorSnapshot.fullName}</Badge>
          <Badge>Доверитель: {props.document.payload.trustorSnapshot.fullName}</Badge>
          <span>
            Номер договора: {props.document.payload.manualFields.agreementNumber || "не указан"}
          </span>
        </div>
        {props.status ? (
          <p className="text-sm leading-6 text-[var(--muted)]">Статус: {props.status}</p>
        ) : null}
      </Card>

      <Card className="space-y-4">
        <h2 className="text-2xl font-semibold">Служебные сведения</h2>
        <ul className="space-y-2 text-sm leading-6 text-[var(--muted)]">
          <li>ID документа: {props.document.id}</li>
          <li>Создано: {new Date(props.document.createdAt).toLocaleString("ru-RU")}</li>
          <li>Обновлено: {new Date(props.document.updatedAt).toLocaleString("ru-RU")}</li>
          <li>
            Снимок персонажа и доверителя сохранён:{" "}
            {new Date(props.document.snapshotCapturedAt).toLocaleString("ru-RU")}
          </li>
          <li>Версия формы: {props.document.formSchemaVersion}</li>
          <li>Ник персонажа: {props.document.authorSnapshot.nickname}</li>
          <li>Роли: {props.document.authorSnapshot.roleKeys.join(", ") || "нет"}</li>
          <li>
            Подписи персонажа и доверителя генерируются шрифтом из frozen snapshots.
          </li>
          <li>
            Генерация: {props.document.generatedAt ? "страницы уже собраны" : "ещё не выполнялась"}.
          </li>
          <li>
            Изменено после генерации: {props.document.isModifiedAfterGeneration ? "да" : "нет"}.
          </li>
        </ul>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-2xl font-semibold">Редактор договора</h2>
        <LegalServicesAgreementEditorClient
          documentId={props.document.id}
          generatedArtifact={props.document.generatedArtifact}
          generatedAt={props.document.generatedAt}
          generatedOutputFormat={props.document.generatedOutputFormat}
          generatedRendererVersion={props.document.generatedRendererVersion}
          initialPayload={props.document.payload}
          initialTitle={props.document.title}
          isModifiedAfterGeneration={props.document.isModifiedAfterGeneration}
          server={props.document.server}
          status={props.document.status}
          updatedAt={props.document.updatedAt}
        />
      </Card>
    </div>
  );
}
