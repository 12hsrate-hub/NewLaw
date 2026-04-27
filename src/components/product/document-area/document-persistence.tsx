import {
  AttorneyRequestDraftCreateClient,
  AttorneyRequestEditorClient,
} from "@/components/product/document-area/document-attorney-request-editor-client";
import {
  EditorActionSummary,
} from "@/components/product/document-area/editor-layout/editor-action-summary";
import {
  EditorDocumentMeta,
} from "@/components/product/document-area/editor-layout/editor-document-meta";
import {
  EditorProgressSummary,
} from "@/components/product/document-area/editor-layout/editor-progress-summary";
import {
  EditorContextAside,
  EditorMainColumn,
  EditorWorkspaceLayout,
} from "@/components/product/document-area/editor-layout/editor-workspace-layout";
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
import {
  attorneyRequestAddresseePresets,
} from "@/features/documents/attorney-request/presets";
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
          <Badge>Сервер: {props.server.name}</Badge>
          <Badge>Персонаж: {props.selectedCharacter.fullName}</Badge>
          <span>
            До первого сохранения персонажа можно сменить. Сейчас выбран{" "}
            {props.selectedCharacter.source === "last_used" ? "последний использованный" : "первый доступный"} персонаж.
          </span>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-2xl font-semibold">Черновик жалобы</h2>
        <p className="text-sm leading-6 text-[var(--muted)]">
          Заполните основные поля и сохраните черновик. После этого можно будет собрать готовый
          текст для форума и подготовить публикацию.
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
          <Badge>Сервер: {props.server.name}</Badge>
          <Badge>Персонаж: {props.selectedCharacter.fullName}</Badge>
          <span>
            Сейчас выбран{" "}
            {props.selectedCharacter.source === "last_used" ? "последний использованный" : "первый доступный"} персонаж.
          </span>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-2xl font-semibold">Черновик запроса</h2>
        <p className="text-sm leading-6 text-[var(--muted)]">
          Неполный черновик можно сохранить. После заполнения обязательных полей станет доступен
          предпросмотр и файлы для скачивания.
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
          редактируется уже внутри сохранённого черновика.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-[var(--muted)]">
          <Badge>Сервер: {props.server.name}</Badge>
          <Badge>Персонаж: {props.selectedCharacter.fullName}</Badge>
          <span>
            Сейчас выбран{" "}
            {props.selectedCharacter.source === "last_used" ? "последний использованный" : "первый доступный"} персонаж.
          </span>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-2xl font-semibold">Черновик договора</h2>
        <p className="text-sm leading-6 text-[var(--muted)]">
          Здесь заполняются только утверждённые ручные поля договора. Остальные данные берутся из
          сохранённых сведений о персонаже и доверителе.
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
          Здесь можно редактировать жалобу в ОГП, сохранить черновик, собрать готовый текст для
          форума и подготовить публикацию.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-[var(--muted)]">
          <Badge>Сервер: {props.document.server.name}</Badge>
          <Badge>Персонаж: {props.document.authorSnapshot.fullName}</Badge>
          <span>Паспорт: {props.document.authorSnapshot.passportNumber}</span>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-2xl font-semibold">О документе</h2>
        <ul className="space-y-2 text-sm leading-6 text-[var(--muted)]">
          <li>Создано: {new Date(props.document.createdAt).toLocaleString("ru-RU")}</li>
          <li>Обновлено: {new Date(props.document.updatedAt).toLocaleString("ru-RU")}</li>
          <li>
            Данные автора зафиксированы: {new Date(props.document.snapshotCapturedAt).toLocaleString("ru-RU")}
          </li>
          <li>
            Сервер и выбранный персонаж после первого сохранения не меняются.
          </li>
          <li>
            {props.document.generatedAt
              ? `Готовый текст для форума уже собран: ${new Date(props.document.generatedAt).toLocaleString("ru-RU")}.`
              : "Готовый текст для форума ещё не собирался."}
          </li>
          <li>Подключение форума: {formatForumConnectionState(props.document.forumConnection.state)}.</li>
          <li>Статус публикации: {formatForumSyncState(props.document.forumSyncState)}.</li>
          <li>
            Последняя публикация:{" "}
            {props.document.forumLastPublishedAt
              ? new Date(props.document.forumLastPublishedAt).toLocaleString("ru-RU")
              : "ещё не публиковался"}
          </li>
          <li>
            {props.document.isModifiedAfterGeneration
              ? "После последней сборки документ менялся. Перед публикацией лучше собрать текст заново."
              : "После последней сборки документ не менялся."}
          </li>
          {props.document.forumLastSyncError ? (
            <li>Не удалось подтвердить последнюю публикацию. Проверьте ссылку и попробуйте ещё раз.</li>
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
          <li>Статус: {formatForumConnectionState(props.document.forumConnection.state)}</li>
          <li>
            Аккаунт форума: {props.document.forumConnection.forumUsername ?? "ещё не подтверждён"}
          </li>
          <li>
            Последняя проверка:{" "}
            {props.document.forumConnection.validatedAt
              ? new Date(props.document.forumConnection.validatedAt).toLocaleString("ru-RU")
              : "ещё не подтверждалась"}
          </li>
          {props.document.forumConnection.lastValidationError ? (
            <li>Подключение требует повторной проверки в настройках аккаунта.</li>
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
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Новый документ</p>
        <h1 className="text-3xl font-semibold">Новый документ из раздела «Иски»</h1>
        <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
          Здесь создаётся черновик документа. После первого сохранения его вид
          «{formatClaimSubtype(props.documentType)}» фиксируется, а дальнейшая работа продолжается
          уже в редакторе сохранённого документа.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-[var(--muted)]">
          <Badge>Сервер: {props.server.name}</Badge>
          <Badge>Вид документа: {formatClaimSubtype(props.documentType)}</Badge>
          <Badge>Персонаж: {props.selectedCharacter.fullName}</Badge>
          <span>
            До первого сохранения персонажа можно сменить. Сейчас выбран{" "}
            {props.selectedCharacter.source === "last_used" ? "последний использованный" : "первый доступный"} персонаж.
          </span>
        </div>
      </Card>

        <Card className="space-y-4">
          <h2 className="text-2xl font-semibold">Черновик документа</h2>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Сохраните документ, чтобы продолжить работу в обычном редакторе. Публикация на форуме
            для этого раздела не используется.
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
  const lastGeneratedLabel = props.document.generatedAt
    ? new Date(props.document.generatedAt).toLocaleString("ru-RU")
    : "ещё не выполнялась";

  const generatedOutputLabel = props.document.generatedOutputFormat
    ? props.document.generatedOutputFormat.toUpperCase()
    : "ещё не подготовлен";

  const evidenceGroupCount = props.document.payload.evidenceGroups.length;
  const trustorLabel =
    props.document.payload.filingMode === "representative"
      ? props.document.payload.trustorSnapshot?.fullName ?? "пока не выбран"
      : "не используется";

  const publicationLabel = props.document.status === "published" ? "Зафиксирован" : "Не используется";

  return (
    <EditorWorkspaceLayout
      aside={
        <EditorContextAside>
          <EditorDocumentMeta
            badges={[
              { label: formatDocumentStatus(props.document.status) },
              { label: formatClaimSubtype(props.document.documentType), tone: "info" },
              {
                label:
                  props.document.payload.filingMode === "representative"
                    ? "Через представителя"
                    : "От своего имени",
              },
            ]}
            description="Ключевые сведения о документе собраны рядом, чтобы не терять контекст во время редактирования."
            items={[
              { label: "Сервер", value: props.document.server.name },
              { label: "Персонаж", value: props.document.authorSnapshot.fullName },
              { label: "Паспорт", value: props.document.authorSnapshot.passportNumber },
              { label: "Создано", value: new Date(props.document.createdAt).toLocaleString("ru-RU") },
              { label: "Обновлено", value: new Date(props.document.updatedAt).toLocaleString("ru-RU") },
              {
                label: "Данные автора зафиксированы",
                value: new Date(props.document.snapshotCapturedAt).toLocaleString("ru-RU"),
              },
            ]}
            title="О документе"
          />

          <EditorProgressSummary
            description="Этот блок помогает быстро понять, что уже готово, а что стоит проверить перед следующей сборкой."
            helperText="Сервер, персонаж и вид документа после первого сохранения не меняются."
            items={[
              {
                label: "Последняя сборка",
                value: lastGeneratedLabel,
                tone: props.document.generatedAt ? "success" : "warning",
              },
              {
                label: "Результат сборки",
                value: generatedOutputLabel,
                tone: props.document.generatedOutputFormat ? "success" : "neutral",
              },
              {
                label: "Изменения после сборки",
                value: props.document.isModifiedAfterGeneration ? "Есть изменения" : "Не обнаружены",
                tone: props.document.isModifiedAfterGeneration ? "warning" : "success",
              },
              {
                label: "Публикация",
                value: publicationLabel,
                tone: "info",
              },
            ]}
            title="Готовность"
          />

          <EditorActionSummary
            description="Здесь собраны только подсказки по текущему состоянию. Все действия по-прежнему выполняются в основной колонке."
            helperText={
              props.document.isModifiedAfterGeneration
                ? "После последней сборки в документе есть изменения. Перед использованием лучше собрать текст заново."
                : "После последней сборки документ не менялся."
            }
            items={[
              { label: "Черновик", value: "Доступен" },
              {
                label: "Доверитель",
                value: trustorLabel,
                tone: props.document.payload.filingMode === "representative" ? "info" : "neutral",
              },
              {
                label: "Группы доказательств",
                value: evidenceGroupCount > 0 ? `${evidenceGroupCount}` : "Пока нет",
                tone: evidenceGroupCount > 0 ? "success" : "neutral",
              },
              {
                label: "Следующий шаг",
                value: props.document.generatedAt ? "Проверить результат" : "Собрать первый результат",
                tone: props.document.generatedAt ? "neutral" : "warning",
              },
            ]}
            title="Следующие действия"
          />
        </EditorContextAside>
      }
      main={
        <EditorMainColumn>
          <Card className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
                Редактор документа
              </p>
              <Badge>{formatDocumentStatus(props.document.status)}</Badge>
              <Badge>Вид документа: {formatClaimSubtype(props.document.documentType)}</Badge>
            </div>
            <h1 className="text-3xl font-semibold">{props.document.title}</h1>
            <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Здесь можно сохранить черновик, собрать текст для просмотра и зафиксировать итоговую
              версию документа. Публикация на форуме для этого раздела не используется.
            </p>
            <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-[var(--muted)]">
              <Badge>Сервер: {props.document.server.name}</Badge>
              <Badge>Персонаж: {props.document.authorSnapshot.fullName}</Badge>
              <span>Паспорт: {props.document.authorSnapshot.passportNumber}</span>
            </div>
          </Card>

          <Card className="space-y-4">
            <h2 className="text-2xl font-semibold">Редактор документа</h2>
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
        </EditorMainColumn>
      }
    />
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
  const lastGeneratedLabel = props.document.generatedAt
    ? new Date(props.document.generatedAt).toLocaleString("ru-RU")
    : "ещё не выполнялась";

  const addresseeLabel = props.document.payload.targetOfficerInput.trim().length
    ? props.document.payload.targetOfficerInput
    : props.document.payload.addresseePreset
      ? attorneyRequestAddresseePresets[props.document.payload.addresseePreset]?.label ??
        props.document.payload.addresseePreset
      : "не указан";

  const signatureLabel = props.document.signatureSnapshot
    ? "Снимок подписи сохранён"
    : props.document.hasActiveCharacterSignature
      ? "Будет зафиксирована при сборке"
      : "Подпись не загружена";

  const generatedFilesLabel = props.document.generatedArtifact
    ? "PDF, PNG и JPG готовы"
    : "Ещё не собраны";

  return (
    <EditorWorkspaceLayout
      aside={
        <EditorContextAside>
          <EditorDocumentMeta
            badges={[
              { label: formatDocumentStatus(props.document.status) },
              { label: "Адвокатский запрос", tone: "info" },
              {
                label: props.document.signatureSnapshot ? "Подпись зафиксирована" : "Подпись проверяется",
                tone: props.document.signatureSnapshot ? "success" : "warning",
              },
            ]}
            description="Справа собраны ключевые сведения по запросу, чтобы их можно было быстро сверять во время редактирования."
            items={[
              { label: "Сервер", value: props.document.server.name },
              { label: "Персонаж", value: props.document.authorSnapshot.fullName },
              { label: "Паспорт", value: props.document.authorSnapshot.passportNumber },
              { label: "Доверитель", value: props.document.payload.trustorSnapshot.fullName || "не указан" },
              {
                label: "Номер запроса",
                value: props.document.payload.requestNumberNormalized || "не указан",
              },
              { label: "Номер договора", value: props.document.payload.contractNumber || "не указан" },
              { label: "Адресат", value: addresseeLabel },
              {
                label: "Должность в документе",
                value:
                  props.document.payload.signerTitleSnapshot?.bodyRu ??
                  props.document.authorSnapshot.position ??
                  "не указана",
              },
              { label: "Создано", value: new Date(props.document.createdAt).toLocaleString("ru-RU") },
              { label: "Обновлено", value: new Date(props.document.updatedAt).toLocaleString("ru-RU") },
              {
                label: "Снимок данных",
                value: new Date(props.document.snapshotCapturedAt).toLocaleString("ru-RU"),
              },
            ]}
            title="О запросе"
          />

          <EditorProgressSummary
            description="Эти подсказки помогают понять, можно ли уже собирать итоговые файлы или сначала стоит обновить данные."
            helperText="Доверитель и данные подписи фиксируются в документе и дальше не зависят от изменений в карточках аккаунта."
            items={[
              {
                label: "Последняя сборка",
                value: lastGeneratedLabel,
                tone: props.document.generatedAt ? "success" : "warning",
              },
              {
                label: "Файлы для скачивания",
                value: generatedFilesLabel,
                tone: props.document.generatedArtifact ? "success" : "neutral",
              },
              {
                label: "Изменения после сборки",
                value: props.document.isModifiedAfterGeneration ? "Есть изменения" : "Не обнаружены",
                tone: props.document.isModifiedAfterGeneration ? "warning" : "success",
              },
              {
                label: "Подпись",
                value: signatureLabel,
                tone: props.document.signatureSnapshot
                  ? "success"
                  : props.document.hasActiveCharacterSignature
                    ? "info"
                    : "warning",
              },
            ]}
            title="Готовность"
          />

          <EditorActionSummary
            description="Здесь нет новых действий: блок только подсказывает, что удобнее сделать следующим шагом."
            helperText={
              props.document.isModifiedAfterGeneration
                ? "После последней сборки документ менялся. Перед использованием лучше собрать его заново."
                : "После последней сборки документ не менялся."
            }
            items={[
              { label: "Черновик", value: "Доступен" },
              {
                label: "Снимок данных",
                value: new Date(props.document.snapshotCapturedAt).toLocaleString("ru-RU"),
                tone: "success",
              },
              {
                label: "Следующий шаг",
                value: props.document.generatedArtifact ? "Проверить и скачать файлы" : "Собрать первый результат",
                tone: props.document.generatedArtifact ? "neutral" : "warning",
              },
              {
                label: "Публикация",
                value: "Не используется",
                tone: "info",
              },
            ]}
            title="Следующие действия"
          />
        </EditorContextAside>
      }
      main={
        <EditorMainColumn>
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
              Здесь можно сохранить черновик, проверить данные и собрать предпросмотр документа с
              файлами для скачивания. Документ привязан к доверителю и не зависит от дальнейших
              изменений его карточки.
            </p>
            <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-[var(--muted)]">
              <Badge>Сервер: {props.document.server.name}</Badge>
              <Badge>Персонаж: {props.document.authorSnapshot.fullName}</Badge>
              <Badge>Доверитель: {props.document.payload.trustorSnapshot.fullName}</Badge>
              <span>Номер запроса: {props.document.payload.requestNumberNormalized || "не указан"}</span>
            </div>
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
        </EditorMainColumn>
      }
    />
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
  const lastGeneratedLabel = props.document.generatedAt
    ? new Date(props.document.generatedAt).toLocaleString("ru-RU")
    : "ещё не выполнялась";

  const generatedFilesLabel = props.document.generatedArtifact
    ? `${props.document.generatedArtifact.pageCount} стр. готовы`
    : "Ещё не собраны";

  const signatureLabel = props.document.generatedArtifact
    ? "Подставлены в собранных страницах"
    : "Появятся после сборки";

  return (
    <EditorWorkspaceLayout
      aside={
        <EditorContextAside>
          <EditorDocumentMeta
            badges={[
              { label: formatDocumentStatus(props.document.status) },
              { label: "Договор на юридические услуги", tone: "info" },
              {
                label: props.document.generatedArtifact ? "Страницы готовы" : "Ожидает сборки",
                tone: props.document.generatedArtifact ? "success" : "warning",
              },
            ]}
            description="Справа собраны сведения о договоре, доверителе и текущем результате сборки, чтобы их было удобно сверять во время редактирования."
            items={[
              { label: "Сервер", value: props.document.server.name },
              { label: "Персонаж", value: props.document.authorSnapshot.fullName },
              { label: "Паспорт персонажа", value: props.document.authorSnapshot.passportNumber },
              { label: "Доверитель", value: props.document.payload.trustorSnapshot.fullName || "не указан" },
              {
                label: "Паспорт доверителя",
                value: props.document.payload.trustorSnapshot.passportNumber || "не указан",
              },
              {
                label: "Номер договора",
                value: props.document.payload.manualFields.agreementNumber || "не указан",
              },
              {
                label: "Дата договора",
                value: props.document.payload.manualFields.agreementDate || "не указана",
              },
              { label: "Создано", value: new Date(props.document.createdAt).toLocaleString("ru-RU") },
              { label: "Обновлено", value: new Date(props.document.updatedAt).toLocaleString("ru-RU") },
              {
                label: "Снимок данных",
                value: new Date(props.document.snapshotCapturedAt).toLocaleString("ru-RU"),
              },
            ]}
            title="О договоре"
          />

          <EditorProgressSummary
            description="Этот блок помогает быстро понять, готовы ли страницы для проверки и не нужно ли заново собрать документ."
            helperText="Подписи персонажа и доверителя подставляются по сохранённым данным договора и появляются в итоговых страницах после сборки."
            items={[
              {
                label: "Последняя сборка",
                value: lastGeneratedLabel,
                tone: props.document.generatedAt ? "success" : "warning",
              },
              {
                label: "Файлы для скачивания",
                value: generatedFilesLabel,
                tone: props.document.generatedArtifact ? "success" : "neutral",
              },
              {
                label: "Исходные данные",
                value:
                  props.document.generatedArtifact?.referenceState === "ready"
                    ? "Готовы"
                    : "Нужно проверить",
                tone:
                  props.document.generatedArtifact?.referenceState === "ready"
                    ? "success"
                    : "warning",
              },
              {
                label: "Подписи",
                value: signatureLabel,
                tone: props.document.generatedArtifact ? "success" : "info",
              },
              {
                label: "Изменения после сборки",
                value: props.document.isModifiedAfterGeneration ? "Есть изменения" : "Не обнаружены",
                tone: props.document.isModifiedAfterGeneration ? "warning" : "success",
              },
            ]}
            title="Готовность"
          />

          <EditorActionSummary
            description="Блок справа не запускает действия, а только подсказывает, на что обратить внимание перед следующей сборкой или скачиванием."
            helperText={
              props.document.isModifiedAfterGeneration
                ? "После последней сборки документ менялся. Перед использованием лучше собрать его заново."
                : "После последней сборки документ не менялся."
            }
            items={[
              { label: "Черновик", value: "Доступен" },
              {
                label: "Страниц в результате",
                value: props.document.generatedArtifact ? `${props.document.generatedArtifact.pageCount}` : "Пока нет",
                tone: props.document.generatedArtifact ? "success" : "neutral",
              },
              {
                label: "Следующий шаг",
                value: props.document.generatedArtifact ? "Проверить и скачать страницы" : "Собрать первый результат",
                tone: props.document.generatedArtifact ? "neutral" : "warning",
              },
              {
                label: "Публикация",
                value: "Не используется",
                tone: "info",
              },
            ]}
            title="Следующие действия"
          />
        </EditorContextAside>
      }
      main={
        <EditorMainColumn>
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
              Здесь можно заполнить данные договора и собрать итоговые страницы для проверки и
              скачивания. Основной текст договора формируется по утверждённому шаблону.
            </p>
            <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-[var(--muted)]">
              <Badge>Сервер: {props.document.server.name}</Badge>
              <Badge>Персонаж: {props.document.authorSnapshot.fullName}</Badge>
              <Badge>Доверитель: {props.document.payload.trustorSnapshot.fullName}</Badge>
              <span>
                Номер договора: {props.document.payload.manualFields.agreementNumber || "не указан"}
              </span>
            </div>
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
        </EditorMainColumn>
      }
    />
  );
}
