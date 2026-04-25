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
  formatClaimSubtype,
  formatDocumentStatus,
  formatFilingMode,
  formatForumConnectionState,
  formatForumSyncState,
} from "@/components/product/document-area/document-persistence-shared";
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
  DocumentTrustorRegistrySummary,
} from "@/server/document-area/context";
import { getDocumentTitleForType } from "@/server/document-area/persistence";
import type {
  ClaimDocumentType,
  ClaimsDraftPayload,
  ClaimsRenderedOutput,
  OgpForumSyncState,
  OgpComplaintDraftPayload,
} from "@/schemas/document";
import type { ForumConnectionSummary } from "@/schemas/forum-integration";

export {
  AccountDocumentsPersistedOverview,
  OgpComplaintFamilyPersistedList,
  AttorneyRequestFamilyPersistedList,
  LegalServicesAgreementFamilyPersistedList,
  ClaimsFamilyPersistedList,
} from "@/components/product/document-area/document-persistence-overview";
export {
  OwnedDocumentUnavailableState,
  InvalidDocumentDataState,
} from "@/components/product/document-area/document-persistence-states";
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
