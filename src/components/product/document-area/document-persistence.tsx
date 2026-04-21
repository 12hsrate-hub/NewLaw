import type { ReactNode } from "react";

import Link from "next/link";

import {
  ClaimsDraftCreateClient,
  ClaimsDraftEditorClient,
} from "@/components/product/document-area/document-claims-editor-client";
import {
  DocumentDraftEditorClient,
  OgpComplaintDraftCreateClient,
} from "@/components/product/document-area/document-draft-editor-client";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type {
  DocumentAreaPersistedListItem,
  DocumentAreaServerSummary,
} from "@/server/document-area/context";
import { getDocumentTitleForType } from "@/server/document-area/persistence";
import type { ClaimDocumentType, ClaimsDraftPayload, OgpComplaintDraftPayload } from "@/schemas/document";

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

function formatDocumentFamily(documentType: DocumentAreaPersistedListItem["documentType"]) {
  return documentType === "ogp_complaint" ? "OGP complaints" : "Claims";
}

function formatDocumentSubtype(documentType: DocumentAreaPersistedListItem["documentType"]) {
  if (documentType === "rehabilitation") {
    return "Rehabilitation";
  }

  if (documentType === "lawsuit") {
    return "Lawsuit";
  }

  return null;
}

function formatClaimSubtype(documentType: ClaimDocumentType) {
  return documentType === "rehabilitation" ? "Rehabilitation" : "Lawsuit";
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

function formatFilingMode(mode: DocumentAreaPersistedListItem["filingMode"]) {
  if (!mode) {
    return null;
  }

  return mode === "representative" ? "representative" : "self";
}

function buildDocumentEditorHref(document: DocumentAreaPersistedListItem) {
  if (document.documentType === "ogp_complaint") {
    return `/servers/${document.server.code}/documents/ogp-complaints/${document.id}`;
  }

  return `/servers/${document.server.code}/documents/claims/${document.id}`;
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
              <Badge>{formatDocumentFamily(document.documentType)}</Badge>
              {formatDocumentSubtype(document.documentType) ? (
                <Badge>{formatDocumentSubtype(document.documentType)}</Badge>
              ) : (
                <Badge>{formatDocumentType(document.documentType)}</Badge>
              )}
              <Badge>{formatDocumentStatus(document.status)}</Badge>
              {formatFilingMode(document.filingMode) ? (
                <Badge>filing mode: {formatFilingMode(document.filingMode)}</Badge>
              ) : null}
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
            {document.documentType === "ogp_complaint" &&
            (document.appealNumber || document.objectOrganization || document.objectFullName) ? (
              <p className="text-sm leading-6 text-[var(--muted)]">
                Appeal number: {document.appealNumber || "не указан"}. Object:{" "}
                {document.objectOrganization || "—"} / {document.objectFullName || "—"}.
              </p>
            ) : null}
            {document.documentType !== "ogp_complaint" ? (
              <p className="text-sm leading-6 text-[var(--muted)]">
                Claims editor уже работает внутри отдельной family `Claims`: subtype{" "}
                `{formatDocumentSubtype(document.documentType)}` фиксируется через internal
                `document_type`, а payload живёт отдельно от OGP и не наследует его generation/publication workflow.
              </p>
            ) : null}
            <p className="text-sm leading-6 text-[var(--muted)]">
              Последнее обновление: {new Date(document.updatedAt).toLocaleString("ru-RU")}.
            </p>
            {document.generatedAt ? (
              <p className="text-sm leading-6 text-[var(--muted)]">
                Generated at: {new Date(document.generatedAt).toLocaleString("ru-RU")}.
                {document.isModifiedAfterGeneration ? " После генерации есть несинхронизированные изменения." : ""}
              </p>
            ) : null}
            {document.publicationUrl ? (
              <p className="text-sm leading-6 text-[var(--muted)]">
                Publication URL: {document.publicationUrl}. Forum sync: {document.isSiteForumSynced ? "да" : "нет"}.
              </p>
            ) : null}
            {document.workingNotesPreview ? (
              <p className="text-sm leading-6 text-[var(--muted)]">
                Рабочие заметки: {document.workingNotesPreview}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <DocumentLink href={buildDocumentEditorHref(document)}>
              {document.documentType === "ogp_complaint"
                ? "Открыть persisted complaint"
                : "Открыть persisted claim"}
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
          create/edit route: рабочая зона по-прежнему живёт в server-scoped маршрутах. `OGP
          complaints` уже persisted, а family `Claims` теперь тоже уже может появляться рядом с
          ними как persisted `rehabilitation | lawsuit` без отдельного account editor center.
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
                  Персонажей на сервере: {server.characterCount}. persisted OGP complaints:{" "}
                  {server.ogpComplaintDocumentCount}. persisted claims: {server.claimsDocumentCount}.
                  Это bridge в server-scoped document area, а не editor внутри account zone. Claims
                  family тоже живёт в том же server-scoped hub, но не наследует OGP
                  generation/publication workflow автоматически.
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
    isProfileComplete: boolean;
    canUseRepresentative: boolean;
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
              <span>
                Representative: {props.selectedCharacter.canUseRepresentative ? "да" : "нет"}
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
    evidenceGroups: [],
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
          `/new` отвечает за pre-draft create entry. После первого сохранения работа продолжается
          в owner-only route `[documentId]`.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-[var(--muted)]">
          <Badge>serverSlug: {props.server.code}</Badge>
          <Badge>Сервер: {props.server.name}</Badge>
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
        <h2 className="text-2xl font-semibold">Complaint create entry</h2>
        <p className="text-sm leading-6 text-[var(--muted)]">
          На этом route создаётся persisted complaint draft и фиксируется immutable author snapshot.
          BBCode generation и manual publication metadata появятся после first save уже в owner-only
          route `[documentId]`.
        </p>
        <OgpComplaintDraftCreateClient
          characters={props.characters}
          initialPayload={buildInitialCreatePayload()}
          initialTitle="Жалоба в ОГП"
          selectedCharacter={props.selectedCharacter}
          server={props.server}
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
  const familyLabel = props.familyLabel ?? "persisted документам";

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
          <DocumentLink href={familyHref}>
            Вернуться к {familyLabel}
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
    payload: OgpComplaintDraftPayload;
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
          <Badge>filing mode: {formatFilingMode(props.document.payload.filingMode)}</Badge>
        </div>
        <h1 className="text-3xl font-semibold">{props.document.title}</h1>
        <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
          Это уже реальный OGP complaint editor route. Здесь грузится persisted payload, работает
          owner-only access, manual/autosave и deterministic BBCode generation без forum automation.
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
          <li>
            Generation status: {props.document.generatedAt ? "есть generated BBCode" : "ещё не генерировался"}.
          </li>
        </ul>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-2xl font-semibold">OGP complaint editor</h2>
        <DocumentDraftEditorClient
          authorSnapshot={{
            canUseRepresentative: props.document.authorSnapshot.accessFlags.includes("advocate"),
            fullName: props.document.authorSnapshot.fullName,
            isProfileComplete: props.document.authorSnapshot.isProfileComplete,
            passportNumber: props.document.authorSnapshot.passportNumber,
          }}
          documentId={props.document.id}
          generatedFormSchemaVersion={props.document.generatedFormSchemaVersion}
          generatedAt={props.document.generatedAt}
          generatedLawVersion={props.document.generatedLawVersion}
          generatedTemplateVersion={props.document.generatedTemplateVersion}
          initialIsModifiedAfterGeneration={props.document.isModifiedAfterGeneration}
          initialIsSiteForumSynced={props.document.isSiteForumSynced}
          initialLastGeneratedBbcode={props.document.lastGeneratedBbcode}
          initialPublicationUrl={props.document.publicationUrl}
          initialPayload={props.document.payload}
          initialTitle={props.document.title}
          server={props.document.server}
          status={props.document.status}
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
          owner-only access и базовый manual/autosave foundation без generation/publication слоя.
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
          <li>Nickname snapshot: {props.document.authorSnapshot.nickname}</li>
          <li>Role keys: {props.document.authorSnapshot.roleKeys.join(", ") || "нет"}</li>
          <li>Access flags: {props.document.authorSnapshot.accessFlags.join(", ") || "нет"}</li>
          <li>Server, character snapshot и subtype после first save больше не меняются.</li>
          <li>Claims generation/publication capability на этом шаге ещё не включена.</li>
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
          initialPayload={props.document.payload}
          initialTitle={props.document.title}
          server={props.document.server}
          status={props.document.status}
          updatedAt={props.document.updatedAt}
        />
      </Card>
    </div>
  );
}
