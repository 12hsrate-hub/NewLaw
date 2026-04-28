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
import { PanelCard } from "@/components/ui/panel-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { WarningNotice } from "@/components/ui/warning-notice";
import { WorkspaceSurface } from "@/components/ui/workspace-surface";
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

const editorMetaTitle = "О документе";
const editorProgressTitle = "Готовность";
const editorActionTitle = "Следующие действия";
const unspecifiedLabel = "Не указано";
const noDataLabel = "Нет данных";
const notBuiltLabel = "Не собрано";
const savedDraftLabel = "Сохранён";
const readyToDownloadLabel = "Готово к скачиванию";
const forumPublishedLabel = "Опубликовано на форуме";
const forumNotPublishedLabel = "Не опубликовано";

function withFallback(value: string | null | undefined, fallback = unspecifiedLabel) {
  const normalized = value?.trim();

  return normalized && normalized.length > 0 ? normalized : fallback;
}

function formatDateTimeLabel(value: string | null | undefined, fallback = noDataLabel) {
  return value ? new Date(value).toLocaleString("ru-RU") : fallback;
}

function formatModifiedAfterGenerationLabel(isModifiedAfterGeneration: boolean) {
  return isModifiedAfterGeneration ? "Есть изменения после сборки" : "Без изменений после сборки";
}

function formatForumPublicationStatusLabel(state: OgpForumSyncState) {
  if (state === "current") {
    return forumPublishedLabel;
  }

  if (state === "not_published") {
    return forumNotPublishedLabel;
  }

  return formatForumSyncState(state) ?? forumNotPublishedLabel;
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
      <WorkspaceSurface className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
              Жалоба в ОГП
            </p>
            <h1 className="text-3xl font-semibold tracking-[-0.04em]">
              Новая жалоба в Офис Генерального прокурора
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Заполните данные обращения, потерпевшего, объекта заявления и доказательства. Итоговый
              BBCode будет сформирован после проверки обязательных полей.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="info">Сервер: {props.server.name}</StatusBadge>
            <StatusBadge tone="success">Персонаж: {props.selectedCharacter.fullName}</StatusBadge>
            <StatusBadge
              tone={props.selectedCharacter.canUseRepresentative ? "success" : "neutral"}
            >
              Представитель: {props.selectedCharacter.canUseRepresentative ? "доступен" : "недоступен"}
            </StatusBadge>
            {props.status ? <StatusBadge tone="warning">Статус: {props.status}</StatusBadge> : null}
          </div>

          <p className="text-sm leading-6 text-[var(--muted)]">
            До первого сохранения персонажа можно сменить. Сейчас выбран{" "}
            {props.selectedCharacter.source === "last_used"
              ? "последний использованный"
              : "первый доступный"}{" "}
            профиль. После сохранения черновика данные жалобы продолжают использовать выбранный
            контекст сервера и персонажа.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <PanelCard className="space-y-4">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-[-0.03em]">Рабочая форма жалобы</h2>
              <p className="text-sm leading-6 text-[var(--muted)]">
                Заполните поля обращения и сохраните черновик. После этого можно будет проверить
                обязательные разделы и собрать текст для форума.
              </p>
            </div>
            <OgpComplaintDraftCreateClient
              characters={props.characters}
              initialPayload={buildInitialCreatePayload()}
              initialTitle="Жалоба в ОГП"
              selectedCharacter={props.selectedCharacter}
              server={props.server}
              trustorRegistry={props.trustorRegistry}
            />
          </PanelCard>

          <div className="space-y-4">
            <PanelCard className="space-y-3">
              <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">Контекст</p>
              <div className="space-y-2 text-sm leading-6 text-[var(--muted)]">
                <p>
                  Сервер: <span className="font-medium text-[var(--foreground)]">{props.server.name}</span>
                </p>
                <p>
                  Персонаж:{" "}
                  <span className="font-medium text-[var(--foreground)]">
                    {props.selectedCharacter.fullName}
                  </span>
                </p>
                <p>
                  Паспорт:{" "}
                  <span className="font-medium text-[var(--foreground)]">
                    {props.selectedCharacter.passportNumber}
                  </span>
                </p>
                <p>
                  Источник выбора:{" "}
                  <span className="font-medium text-[var(--foreground)]">
                    {props.selectedCharacter.source === "last_used"
                      ? "последний использованный"
                      : "первый доступный"}
                  </span>
                </p>
              </div>
            </PanelCard>

            {!props.selectedCharacter.isProfileComplete ? (
              <WarningNotice
                description="Профиль персонажа заполнен не полностью. Черновик можно создать, но итоговая сборка станет доступна только после заполнения обязательных полей профиля."
                title="Проверьте профиль персонажа"
              />
            ) : null}

            <WarningNotice
              description="Данные жалобы и выбранного персонажа будут зафиксированы после сохранения черновика. Перед генерацией проверьте потерпевшего, объект заявления и доказательства."
              title="Что важно перед сохранением"
            />
          </div>
        </div>
      </WorkspaceSurface>
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
      <WorkspaceSurface className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
              Адвокатский запрос
            </p>
            <h1 className="text-3xl font-semibold tracking-[-0.04em]">
              Новый адвокатский запрос
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Заполните данные запроса, адресата, сотрудника, период событий и основание. Итоговый
              документ будет сформирован по серверному шаблону после проверки обязательных полей.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="info">Сервер: {props.server.name}</StatusBadge>
            <StatusBadge tone="success">Персонаж: {props.selectedCharacter.fullName}</StatusBadge>
            <StatusBadge
              tone={props.selectedCharacter.canCreateAttorneyRequest ? "success" : "warning"}
            >
              Адвокатский доступ: {props.selectedCharacter.canCreateAttorneyRequest ? "есть" : "нет"}
            </StatusBadge>
            <StatusBadge
              tone={props.selectedCharacter.hasActiveSignature ? "success" : "warning"}
            >
              Подпись: {props.selectedCharacter.hasActiveSignature ? "загружена" : "не загружена"}
            </StatusBadge>
            <StatusBadge
              tone={props.selectedCharacter.isProfileComplete ? "success" : "warning"}
            >
              Профиль: {props.selectedCharacter.isProfileComplete ? "готов" : "нужно проверить"}
            </StatusBadge>
            {props.status ? <StatusBadge tone="warning">Статус: {props.status}</StatusBadge> : null}
          </div>

          <p className="text-sm leading-6 text-[var(--muted)]">
            До первого сохранения можно сменить персонажа и доверителя. Сейчас выбран{" "}
            {props.selectedCharacter.source === "last_used"
              ? "последний использованный"
              : "первый доступный"}{" "}
            профиль. После сохранения черновика запрос продолжит использовать тот же серверный и
            представительский контекст.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <PanelCard className="space-y-4">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-[-0.03em]">Рабочая форма запроса</h2>
              <p className="text-sm leading-6 text-[var(--muted)]">
                Создайте черновик и затем заполните содержательные разделы, основание, период
                событий и итоговый текст запроса в сохранённом документе.
              </p>
            </div>
            <AttorneyRequestDraftCreateClient
              characters={props.characters}
              initialTitle="Адвокатский запрос"
              initialTrustorId={props.initialTrustorId}
              selectedCharacter={props.selectedCharacter}
              server={props.server}
              trustorRegistry={props.trustorRegistry}
            />
          </PanelCard>

          <div className="space-y-4">
            <PanelCard className="space-y-3">
              <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">Контекст</p>
              <div className="space-y-2 text-sm leading-6 text-[var(--muted)]">
                <p>
                  Сервер: <span className="font-medium text-[var(--foreground)]">{props.server.name}</span>
                </p>
                <p>
                  Персонаж:{" "}
                  <span className="font-medium text-[var(--foreground)]">
                    {props.selectedCharacter.fullName}
                  </span>
                </p>
                <p>
                  Паспорт:{" "}
                  <span className="font-medium text-[var(--foreground)]">
                    {props.selectedCharacter.passportNumber}
                  </span>
                </p>
                <p>
                  Подпись:{" "}
                  <span className="font-medium text-[var(--foreground)]">
                    {props.selectedCharacter.hasActiveSignature ? "доступна" : "пока не загружена"}
                  </span>
                </p>
                <p>
                  Доверители на сервере:{" "}
                  <span className="font-medium text-[var(--foreground)]">
                    {props.trustorRegistry.length}
                  </span>
                </p>
              </div>
            </PanelCard>

            {!props.selectedCharacter.isProfileComplete ? (
              <WarningNotice
                description="Профиль персонажа заполнен не полностью. Черновик можно создать, но перед финальной генерацией нужно проверить обязательные поля профиля."
                title="Проверьте профиль персонажа"
              />
            ) : null}

            {!props.selectedCharacter.hasActiveSignature ? (
              <WarningNotice
                description="Без подписи запрос сохранится как черновик, но итоговые файлы не будут собраны, пока у персонажа не появится активная подпись."
                title="Подпись понадобится для генерации"
              />
            ) : null}

            <WarningNotice
              description="После первого сохранения сервер, персонаж и доверитель фиксируются в документе. Перед созданием черновика проверьте выбранный контекст и представительство."
              title="Что важно перед сохранением"
            />
          </div>
        </div>
      </WorkspaceSurface>
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
      <WorkspaceSurface className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Договор</p>
            <h1 className="text-3xl font-semibold tracking-[-0.04em]">
              Новый договор на оказание юридических услуг
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Заполните данные доверителя, условия договора и сведения представителя. Итоговый
              документ будет сформирован по серверному шаблону после проверки обязательных полей.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="info">Сервер: {props.server.name}</StatusBadge>
            <StatusBadge tone="success">Персонаж: {props.selectedCharacter.fullName}</StatusBadge>
            <StatusBadge
              tone={props.selectedCharacter.hasActiveSignature ? "success" : "warning"}
            >
              Подпись: {props.selectedCharacter.hasActiveSignature ? "загружена" : "не загружена"}
            </StatusBadge>
            <StatusBadge
              tone={props.selectedCharacter.isProfileComplete ? "success" : "warning"}
            >
              Профиль: {props.selectedCharacter.isProfileComplete ? "готов" : "нужно проверить"}
            </StatusBadge>
            <StatusBadge tone={props.trustorRegistry.length > 0 ? "success" : "warning"}>
              Доверитель: {props.trustorRegistry.length > 0 ? "выбран существующий" : "не найден"}
            </StatusBadge>
            {props.status ? <StatusBadge tone="warning">Статус: {props.status}</StatusBadge> : null}
          </div>

          <p className="text-sm leading-6 text-[var(--muted)]">
            До первого сохранения можно сменить персонажа и доверителя. Сейчас выбран{" "}
            {props.selectedCharacter.source === "last_used"
              ? "последний использованный"
              : "первый доступный"}{" "}
            профиль. После сохранения черновика договор продолжит использовать тот же серверный и
            представительский контекст.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <PanelCard className="space-y-4">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-[-0.03em]">Рабочая форма договора</h2>
              <p className="text-sm leading-6 text-[var(--muted)]">
                Здесь заполняются только утверждённые ручные поля договора. Остальные данные берутся
                из сохранённых сведений о персонаже и доверителе.
              </p>
            </div>
            <LegalServicesAgreementDraftCreateClient
              characters={props.characters}
              initialTitle={getDocumentTitleForType("legal_services_agreement")}
              selectedCharacter={props.selectedCharacter}
              server={props.server}
              trustorRegistry={props.trustorRegistry}
            />
          </PanelCard>

          <div className="space-y-4">
            <PanelCard className="space-y-3">
              <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">Контекст</p>
              <div className="space-y-2 text-sm leading-6 text-[var(--muted)]">
                <p>
                  Сервер: <span className="font-medium text-[var(--foreground)]">{props.server.name}</span>
                </p>
                <p>
                  Персонаж:{" "}
                  <span className="font-medium text-[var(--foreground)]">
                    {props.selectedCharacter.fullName}
                  </span>
                </p>
                <p>
                  Паспорт:{" "}
                  <span className="font-medium text-[var(--foreground)]">
                    {props.selectedCharacter.passportNumber}
                  </span>
                </p>
                <p>
                  Подпись:{" "}
                  <span className="font-medium text-[var(--foreground)]">
                    {props.selectedCharacter.hasActiveSignature ? "доступна" : "пока не загружена"}
                  </span>
                </p>
                <p>
                  Доверители на сервере:{" "}
                  <span className="font-medium text-[var(--foreground)]">
                    {props.trustorRegistry.length}
                  </span>
                </p>
              </div>
            </PanelCard>

            {!props.selectedCharacter.isProfileComplete ? (
              <WarningNotice
                description="Профиль персонажа заполнен не полностью. Черновик можно создать, но перед сборкой договора лучше проверить обязательные поля представителя."
                title="Проверьте профиль персонажа"
              />
            ) : null}

            {!props.selectedCharacter.hasActiveSignature ? (
              <WarningNotice
                description="Без подписи договор сохранится как черновик, но итоговые страницы не будут готовы к полной проверке и скачиванию."
                title="Подпись понадобится для сборки"
              />
            ) : null}

            <WarningNotice
              description="После первого сохранения сервер, персонаж и доверитель фиксируются в документе. Перед созданием черновика проверьте выбранный контекст и сохранённого доверителя."
              title="Что важно перед сохранением"
            />
          </div>
        </div>
      </WorkspaceSurface>
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
  const lastGeneratedLabel = formatDateTimeLabel(props.document.generatedAt, notBuiltLabel);
  const publicationStatusLabel = formatForumPublicationStatusLabel(props.document.forumSyncState);
  const trustorLabel = withFallback(props.document.payload.trustorSnapshot?.fullName);
  const appealNumberLabel = withFallback(props.document.payload.appealNumber);
  const objectOrganizationLabel = withFallback(props.document.payload.objectOrganization);
  const objectFullNameLabel = withFallback(props.document.payload.objectFullName);
  const generatedTextLabel = props.document.lastGeneratedBbcode ? "Собрано" : notBuiltLabel;
  const evidenceCount = props.document.payload.evidenceItems.length;

  const nextStepLabel = !props.document.generatedAt
    ? "Собрать результат"
    : props.document.isModifiedAfterGeneration
      ? "Собрать результат заново"
      : props.document.forumSyncState === "not_published"
        ? "Проверить и опубликовать"
        : "Проверить результат";

  return (
    <EditorWorkspaceLayout
      aside={
        <EditorContextAside>
          <EditorDocumentMeta
            badges={[
              { label: formatDocumentStatus(props.document.status) },
              { label: "Жалоба в ОГП", tone: "info" },
              {
                label: `Подача: ${formatFilingMode(props.document.payload.filingMode)}`,
              },
            ]}
            description="Ключевые сведения по жалобе для быстрой сверки."
            items={[
              { label: "Сервер", value: props.document.server.name },
              { label: "Персонаж", value: props.document.authorSnapshot.fullName },
              { label: "Паспорт", value: props.document.authorSnapshot.passportNumber },
              { label: "Доверитель", value: trustorLabel },
              { label: "Номер обращения", value: appealNumberLabel },
              { label: "Организация", value: objectOrganizationLabel },
              { label: "Объект заявления", value: objectFullNameLabel },
              { label: "Создано", value: new Date(props.document.createdAt).toLocaleString("ru-RU") },
              { label: "Обновлено", value: new Date(props.document.updatedAt).toLocaleString("ru-RU") },
              {
                label: "Снимок данных",
                value: new Date(props.document.snapshotCapturedAt).toLocaleString("ru-RU"),
              },
            ]}
            title={editorMetaTitle}
          />

          <EditorProgressSummary
            description="Показывает, готова ли жалоба к сборке и публикации."
            helperText="Сервер и персонаж уже зафиксированы."
            items={[
              {
                label: "Последняя сборка",
                value: lastGeneratedLabel,
                tone: props.document.generatedAt ? "success" : "warning",
              },
              {
                label: "BBCode",
                value: generatedTextLabel,
                tone: props.document.lastGeneratedBbcode ? "success" : "neutral",
              },
              {
                label: "Подключение форума",
                value: formatForumConnectionState(props.document.forumConnection.state),
                tone: props.document.forumConnection.state === "valid" ? "success" : "warning",
              },
              {
                label: "Статус публикации",
                value: publicationStatusLabel,
                tone:
                  props.document.forumSyncState === "current"
                    ? "success"
                    : props.document.forumSyncState === "failed" || props.document.forumSyncState === "outdated"
                      ? "warning"
                      : "neutral",
              },
              {
                label: "Изменения после сборки",
                value: formatModifiedAfterGenerationLabel(props.document.isModifiedAfterGeneration),
                tone: props.document.isModifiedAfterGeneration ? "warning" : "success",
              },
            ]}
            title={editorProgressTitle}
          />

          <EditorActionSummary
            description="Подсказывает следующий шаг."
            helperText={
              props.document.forumLastSyncError
                ? "Проверка публикации не подтвердилась. Проверьте ссылку и попробуйте ещё раз."
                : props.document.forumLastPublishedAt
                  ? `Публикация подтверждена ${new Date(props.document.forumLastPublishedAt).toLocaleString("ru-RU")}.`
                  : "Публикация ещё не подтверждена."
            }
            items={[
              { label: "Черновик", value: savedDraftLabel },
              {
                label: "Группы доказательств",
                value: evidenceCount > 0 ? `${evidenceCount}` : noDataLabel,
                tone: evidenceCount > 0 ? "success" : "neutral",
              },
              {
                label: "Публикация",
                value: props.document.publicationUrl ? forumPublishedLabel : forumNotPublishedLabel,
                tone: props.document.publicationUrl ? "success" : "neutral",
              },
              {
                label: "Следующий шаг",
                value: nextStepLabel,
                tone:
                  nextStepLabel === "Проверить результат"
                    ? "neutral"
                    : "warning",
              },
            ]}
            title={editorActionTitle}
          />
        </EditorContextAside>
      }
      main={
        <EditorMainColumn>
          <WorkspaceSurface className="space-y-4">
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
              <StatusBadge tone="info">Сервер: {props.document.server.name}</StatusBadge>
              <StatusBadge tone="neutral">Персонаж: {props.document.authorSnapshot.fullName}</StatusBadge>
              <StatusBadge
                tone={
                  props.document.isModifiedAfterGeneration
                    ? "warning"
                    : props.document.generatedAt
                      ? "success"
                      : "neutral"
                }
              >
                {props.document.isModifiedAfterGeneration
                  ? "Документ нужно пересобрать"
                  : props.document.generatedAt
                    ? "BBCode собран"
                    : "Черновик без сборки"}
              </StatusBadge>
              <span>Паспорт: {props.document.authorSnapshot.passportNumber}</span>
            </div>
          </WorkspaceSurface>

          <div className="space-y-4">
            <PanelCard className="space-y-4 p-6">
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold">Редактор жалобы в ОГП</h2>
                <p className="text-sm leading-6 text-[var(--muted)]">
                  Сохранённая жалоба уже привязана к серверу, персонажу и снимку данных. Ниже можно
                  обновить поля, пересобрать BBCode и проверить публикацию без изменения самого flow.
                </p>
              </div>

              {props.document.isModifiedAfterGeneration ? (
                <WarningNotice
                  description="После последней сборки документ менялся. Перед публикацией лучше заново собрать текст для форума, чтобы публикация совпадала с текущими данными жалобы."
                  title="Документ нужно пересобрать"
                />
              ) : null}

              {props.document.forumLastSyncError ? (
                <WarningNotice
                  description="Последняя проверка публикации завершилась с ошибкой. Проверьте ссылку на форум и при необходимости обновите публикацию повторно."
                  title="Проверьте публикацию на форуме"
                />
              ) : null}
            </PanelCard>

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
          </div>
        </EditorMainColumn>
      }
    />
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
      <WorkspaceSurface className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Исковое заявление</p>
            <h1 className="text-3xl font-semibold tracking-[-0.04em]">
              {props.documentType === "rehabilitation"
                ? "Новый документ по реабилитации"
                : "Новое исковое заявление"}
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Заполните данные дела, участников, обстоятельства и требования. Итоговый документ
              будет сформирован после проверки обязательных полей.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="info">Сервер: {props.server.name}</StatusBadge>
            <StatusBadge tone="success">Персонаж: {props.selectedCharacter.fullName}</StatusBadge>
            <StatusBadge tone="neutral">Вид документа: {formatClaimSubtype(props.documentType)}</StatusBadge>
            <StatusBadge
              tone={props.selectedCharacter.canUseRepresentative ? "success" : "neutral"}
            >
              Представитель: {props.selectedCharacter.canUseRepresentative ? "доступен" : "недоступен"}
            </StatusBadge>
            {props.status ? <StatusBadge tone="warning">Статус: {props.status}</StatusBadge> : null}
          </div>

          <p className="text-sm leading-6 text-[var(--muted)]">
            До первого сохранения персонажа можно сменить. Сейчас выбран{" "}
            {props.selectedCharacter.source === "last_used"
              ? "последний использованный"
              : "первый доступный"}{" "}
            профиль. После сохранения подтип документа, автор и связанные данные будут
            зафиксированы внутри черновика.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <PanelCard className="space-y-4">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-[-0.03em]">Рабочая форма документа</h2>
              <p className="text-sm leading-6 text-[var(--muted)]">
                Сохраните документ, чтобы продолжить работу в редакторе сохранённого черновика.
                Публикация на форуме для этого раздела не используется.
              </p>
            </div>
            <ClaimsDraftCreateClient
              characters={props.characters}
              documentType={props.documentType}
              initialPayload={buildInitialClaimsCreatePayload(props.documentType)}
              initialTitle={getDocumentTitleForType(props.documentType)}
              selectedCharacter={props.selectedCharacter}
              server={props.server}
              trustorRegistry={props.trustorRegistry}
            />
          </PanelCard>

          <div className="space-y-4">
            <PanelCard className="space-y-3">
              <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">Контекст</p>
              <div className="space-y-2 text-sm leading-6 text-[var(--muted)]">
                <p>
                  Сервер: <span className="font-medium text-[var(--foreground)]">{props.server.name}</span>
                </p>
                <p>
                  Персонаж:{" "}
                  <span className="font-medium text-[var(--foreground)]">
                    {props.selectedCharacter.fullName}
                  </span>
                </p>
                <p>
                  Паспорт:{" "}
                  <span className="font-medium text-[var(--foreground)]">
                    {props.selectedCharacter.passportNumber}
                  </span>
                </p>
                <p>
                  Подтип:{" "}
                  <span className="font-medium text-[var(--foreground)]">
                    {formatClaimSubtype(props.documentType)}
                  </span>
                </p>
              </div>
            </PanelCard>

            {!props.selectedCharacter.isProfileComplete ? (
              <WarningNotice
                description="Профиль персонажа заполнен не полностью. Черновик можно создать, но перед генерацией и использованием документа лучше проверить недостающие данные профиля."
                title="Проверьте профиль персонажа"
              />
            ) : null}

            <WarningNotice
              description="Данные документа, выбранного подтипа и автора будут зафиксированы после первого сохранения. Перед продолжением проверьте ответчика, требования и доказательства."
              title="Что важно перед сохранением"
            />
          </div>
        </div>
      </WorkspaceSurface>
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
  const lastGeneratedLabel = formatDateTimeLabel(props.document.generatedAt, notBuiltLabel);
  const generatedOutputLabel = props.document.generatedOutputFormat ? "Собрано" : notBuiltLabel;

  const evidenceGroupCount = props.document.payload.evidenceGroups.length;
  const trustorLabel =
    props.document.payload.filingMode === "representative"
      ? withFallback(props.document.payload.trustorSnapshot?.fullName)
      : noDataLabel;

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
            description="Ключевые сведения о документе для быстрой сверки."
            items={[
              { label: "Сервер", value: props.document.server.name },
              { label: "Персонаж", value: props.document.authorSnapshot.fullName },
              { label: "Паспорт", value: props.document.authorSnapshot.passportNumber },
              { label: "Создано", value: new Date(props.document.createdAt).toLocaleString("ru-RU") },
              { label: "Обновлено", value: new Date(props.document.updatedAt).toLocaleString("ru-RU") },
              {
                label: "Снимок данных",
                value: new Date(props.document.snapshotCapturedAt).toLocaleString("ru-RU"),
              },
            ]}
            title={editorMetaTitle}
          />

          <EditorProgressSummary
            description="Показывает, что уже готово к следующей сборке."
            helperText="Сервер, персонаж и вид документа уже зафиксированы."
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
                value: formatModifiedAfterGenerationLabel(props.document.isModifiedAfterGeneration),
                tone: props.document.isModifiedAfterGeneration ? "warning" : "success",
              },
            ]}
            title={editorProgressTitle}
          />

          <EditorActionSummary
            description="Подсказывает следующий шаг."
            helperText={
              props.document.isModifiedAfterGeneration
                ? "После сборки есть изменения. Перед использованием соберите документ заново."
                : "После сборки изменений нет."
            }
            items={[
              { label: "Черновик", value: savedDraftLabel },
              {
                label: "Доверитель",
                value: trustorLabel,
                tone: props.document.payload.filingMode === "representative" ? "info" : "neutral",
              },
              {
                label: "Группы доказательств",
                value: evidenceGroupCount > 0 ? `${evidenceGroupCount}` : noDataLabel,
                tone: evidenceGroupCount > 0 ? "success" : "neutral",
              },
              {
                label: "Следующий шаг",
                value: props.document.generatedAt ? "Проверить результат" : "Собрать результат",
                tone: props.document.generatedAt ? "neutral" : "warning",
              },
            ]}
            title={editorActionTitle}
          />
        </EditorContextAside>
      }
      main={
        <EditorMainColumn>
          <WorkspaceSurface className="space-y-4">
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
              <StatusBadge tone="info">Сервер: {props.document.server.name}</StatusBadge>
              <StatusBadge tone="neutral">Персонаж: {props.document.authorSnapshot.fullName}</StatusBadge>
              <StatusBadge
                tone={
                  props.document.isModifiedAfterGeneration
                    ? "warning"
                    : props.document.generatedAt
                      ? "success"
                      : "neutral"
                }
              >
                {props.document.isModifiedAfterGeneration
                  ? "Документ нужно пересобрать"
                  : props.document.generatedAt
                    ? "Результат собран"
                    : "Черновик без сборки"}
              </StatusBadge>
              <span>Паспорт: {props.document.authorSnapshot.passportNumber}</span>
            </div>
          </WorkspaceSurface>

          <div className="space-y-4">
            <PanelCard className="space-y-4 p-6">
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold">Редактор документа</h2>
                <p className="text-sm leading-6 text-[var(--muted)]">
                  Сохранённый документ уже привязан к серверу, персонажу и выбранному подтипу. Ниже
                  можно обновить поля, пересобрать результат и проверить подготовленный предпросмотр.
                </p>
              </div>

              {props.document.isModifiedAfterGeneration ? (
                <WarningNotice
                  description="После последней сборки документ менялся. Перед использованием лучше снова собрать итоговую версию, чтобы предпросмотр и сохранённый результат совпадали с текущими данными."
                  title="Документ нужно пересобрать"
                />
              ) : null}
            </PanelCard>

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
          </div>
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
  const lastGeneratedLabel = formatDateTimeLabel(props.document.generatedAt, notBuiltLabel);

  const addresseeLabel = props.document.payload.targetOfficerInput.trim().length
    ? props.document.payload.targetOfficerInput
    : props.document.payload.addresseePreset
      ? attorneyRequestAddresseePresets[props.document.payload.addresseePreset]?.label ??
        props.document.payload.addresseePreset
      : unspecifiedLabel;

  const signatureLabel = props.document.signatureSnapshot
    ? "Снимок подписи сохранён"
    : props.document.hasActiveCharacterSignature
      ? "Будет зафиксирована при сборке"
      : "Подпись не загружена";

  const generatedFilesLabel = props.document.generatedArtifact
      ? readyToDownloadLabel
      : notBuiltLabel;

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
            description="Ключевые сведения по запросу для быстрой сверки."
            items={[
              { label: "Сервер", value: props.document.server.name },
              { label: "Персонаж", value: props.document.authorSnapshot.fullName },
              { label: "Паспорт", value: props.document.authorSnapshot.passportNumber },
              { label: "Доверитель", value: withFallback(props.document.payload.trustorSnapshot.fullName) },
              {
                label: "Номер запроса",
                value: withFallback(props.document.payload.requestNumberNormalized),
              },
              { label: "Номер договора", value: withFallback(props.document.payload.contractNumber) },
              { label: "Адресат", value: addresseeLabel },
              {
                label: "Должность",
                value:
                  props.document.payload.signerTitleSnapshot?.bodyRu ??
                  props.document.authorSnapshot.position ??
                  unspecifiedLabel,
              },
              { label: "Создано", value: new Date(props.document.createdAt).toLocaleString("ru-RU") },
              { label: "Обновлено", value: new Date(props.document.updatedAt).toLocaleString("ru-RU") },
              {
                label: "Снимок данных",
                value: new Date(props.document.snapshotCapturedAt).toLocaleString("ru-RU"),
              },
            ]}
            title={editorMetaTitle}
          />

          <EditorProgressSummary
            description="Показывает, можно ли уже собирать итоговые файлы."
            helperText="Доверитель и подпись фиксируются в документе."
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
                value: formatModifiedAfterGenerationLabel(props.document.isModifiedAfterGeneration),
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
            title={editorProgressTitle}
          />

          <EditorActionSummary
            description="Подсказывает следующий шаг."
            helperText={
              props.document.isModifiedAfterGeneration
                ? "После сборки есть изменения. Перед использованием соберите документ заново."
                : "После сборки изменений нет."
            }
            items={[
              { label: "Черновик", value: savedDraftLabel },
              {
                label: "Снимок данных",
                value: formatDateTimeLabel(props.document.snapshotCapturedAt),
                tone: "success",
              },
              {
                label: "Следующий шаг",
                value: props.document.generatedArtifact ? "Проверить результат" : "Собрать результат",
                tone: props.document.generatedArtifact ? "neutral" : "warning",
              },
            ]}
            title={editorActionTitle}
          />
        </EditorContextAside>
      }
      main={
        <EditorMainColumn>
          <WorkspaceSurface className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
                Редактор адвокатского запроса
              </p>
              <StatusBadge tone="neutral">{formatDocumentStatus(props.document.status)}</StatusBadge>
              <StatusBadge
                tone={
                  props.document.isModifiedAfterGeneration
                    ? "warning"
                    : props.document.generatedAt
                      ? "success"
                      : "neutral"
                }
              >
                {props.document.isModifiedAfterGeneration
                  ? "Результат нужно обновить"
                  : props.document.generatedAt
                    ? "Файлы собраны"
                    : "Черновик без сборки"}
              </StatusBadge>
              <StatusBadge
                tone={props.document.signatureSnapshot ? "success" : props.document.hasActiveCharacterSignature ? "info" : "warning"}
              >
                {props.document.signatureSnapshot
                  ? "Подпись зафиксирована"
                  : props.document.hasActiveCharacterSignature
                    ? "Подпись будет зафиксирована при сборке"
                    : "Подпись не загружена"}
              </StatusBadge>
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em]">{props.document.title}</h1>
            <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Здесь можно сохранить черновик, проверить данные и собрать предпросмотр документа с
              файлами для скачивания. Документ привязан к доверителю и не зависит от дальнейших
              изменений его карточки.
            </p>
            <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-[var(--muted)]">
              <StatusBadge tone="info">Сервер: {props.document.server.name}</StatusBadge>
              <StatusBadge tone="neutral">Персонаж: {props.document.authorSnapshot.fullName}</StatusBadge>
              <StatusBadge tone="neutral">Доверитель: {props.document.payload.trustorSnapshot.fullName}</StatusBadge>
              <span>Номер запроса: {props.document.payload.requestNumberNormalized || "не указан"}</span>
            </div>
          </WorkspaceSurface>

          <div className="space-y-4">
            <PanelCard className="space-y-4 p-6">
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold">Редактор запроса</h2>
                <p className="text-sm leading-6 text-[var(--muted)]">
                  Сохранённый адвокатский запрос уже привязан к серверу, персонажу, доверителю и
                  снимку подписи. Ниже можно обновить данные, пересобрать итоговые файлы и
                  перепроверить предпросмотр без изменения самого шаблона.
                </p>
              </div>

              {props.document.isModifiedAfterGeneration ? (
                <WarningNotice
                  description="После последней сборки документ менялся. Перед использованием лучше заново собрать результат, чтобы предпросмотр, PDF и изображения совпадали с текущими данными запроса."
                  title="Результат нужно пересобрать"
                />
              ) : null}

              {!props.document.signatureSnapshot && !props.document.hasActiveCharacterSignature ? (
                <WarningNotice
                  description="У персонажа нет активной подписи. Черновик можно редактировать и сохранять, но генерация итоговых файлов останется недоступной, пока подпись не появится."
                  title="Подпись ещё не загружена"
                />
              ) : null}
            </PanelCard>

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
          </div>
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
  const lastGeneratedLabel = formatDateTimeLabel(props.document.generatedAt, notBuiltLabel);

  const generatedFilesLabel = props.document.generatedArtifact
    ? readyToDownloadLabel
    : notBuiltLabel;

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
            description="Ключевые сведения по договору для быстрой сверки."
            items={[
              { label: "Сервер", value: props.document.server.name },
              { label: "Персонаж", value: props.document.authorSnapshot.fullName },
              { label: "Паспорт персонажа", value: props.document.authorSnapshot.passportNumber },
              { label: "Доверитель", value: withFallback(props.document.payload.trustorSnapshot.fullName) },
              {
                label: "Паспорт доверителя",
                value: withFallback(props.document.payload.trustorSnapshot.passportNumber),
              },
              {
                label: "Номер договора",
                value: withFallback(props.document.payload.manualFields.agreementNumber),
              },
              {
                label: "Дата договора",
                value: withFallback(props.document.payload.manualFields.agreementDate),
              },
              { label: "Создано", value: new Date(props.document.createdAt).toLocaleString("ru-RU") },
              { label: "Обновлено", value: new Date(props.document.updatedAt).toLocaleString("ru-RU") },
              {
                label: "Снимок данных",
                value: new Date(props.document.snapshotCapturedAt).toLocaleString("ru-RU"),
              },
            ]}
            title={editorMetaTitle}
          />

          <EditorProgressSummary
            description="Показывает, готовы ли страницы к проверке."
            helperText="Подписи появятся в итоговых страницах после сборки."
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
                value: formatModifiedAfterGenerationLabel(props.document.isModifiedAfterGeneration),
                tone: props.document.isModifiedAfterGeneration ? "warning" : "success",
              },
            ]}
            title={editorProgressTitle}
          />

          <EditorActionSummary
            description="Подсказывает следующий шаг."
            helperText={
              props.document.isModifiedAfterGeneration
                ? "После сборки есть изменения. Перед использованием соберите документ заново."
                : "После сборки изменений нет."
            }
            items={[
              { label: "Черновик", value: savedDraftLabel },
              {
                label: "Страницы",
                value: props.document.generatedArtifact ? `${props.document.generatedArtifact.pageCount}` : noDataLabel,
                tone: props.document.generatedArtifact ? "success" : "neutral",
              },
              {
                label: "Следующий шаг",
                value: props.document.generatedArtifact ? "Проверить результат" : "Собрать результат",
                tone: props.document.generatedArtifact ? "neutral" : "warning",
              },
            ]}
            title={editorActionTitle}
          />
        </EditorContextAside>
      }
      main={
        <EditorMainColumn>
          <WorkspaceSurface className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
                Редактор договора
              </p>
              <StatusBadge tone="neutral">{formatDocumentStatus(props.document.status)}</StatusBadge>
              <StatusBadge
                tone={
                  props.document.isModifiedAfterGeneration
                    ? "warning"
                    : props.document.generatedArtifact
                      ? "success"
                      : "neutral"
                }
              >
                {props.document.isModifiedAfterGeneration
                  ? "Результат нужно обновить"
                  : props.document.generatedArtifact
                    ? "Страницы собраны"
                    : "Черновик без сборки"}
              </StatusBadge>
              <StatusBadge
                tone={props.document.generatedArtifact ? "success" : "info"}
              >
                {props.document.generatedArtifact
                  ? "Подписи подставлены"
                  : "Подписи появятся после сборки"}
              </StatusBadge>
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em]">{props.document.title}</h1>
            <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Здесь можно заполнить данные договора и собрать итоговые страницы для проверки и
              скачивания. Основной текст договора формируется по утверждённому шаблону.
            </p>
            <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-[var(--muted)]">
              <StatusBadge tone="info">Сервер: {props.document.server.name}</StatusBadge>
              <StatusBadge tone="neutral">Персонаж: {props.document.authorSnapshot.fullName}</StatusBadge>
              <StatusBadge tone="neutral">Доверитель: {props.document.payload.trustorSnapshot.fullName}</StatusBadge>
              <span>
                Номер договора: {props.document.payload.manualFields.agreementNumber || "не указан"}
              </span>
            </div>
          </WorkspaceSurface>

          <div className="space-y-4">
            <PanelCard className="space-y-4 p-6">
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold">Редактор договора</h2>
                <p className="text-sm leading-6 text-[var(--muted)]">
                  Сохранённый договор уже привязан к серверу, персонажу и доверителю. Ниже можно
                  обновить ручные поля, пересобрать страницы и проверить итоговый предпросмотр без
                  изменения эталонного текста и шаблона.
                </p>
              </div>

              {props.document.isModifiedAfterGeneration ? (
                <WarningNotice
                  description="После последней сборки договор менялся. Перед использованием лучше заново собрать страницы, чтобы preview и PNG-файлы совпадали с текущими данными."
                  title="Результат нужно пересобрать"
                />
              ) : null}
            </PanelCard>

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
          </div>
        </EditorMainColumn>
      }
    />
  );
}
