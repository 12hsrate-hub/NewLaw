import { AccessBlockedCard } from "@/components/product/foundation/access-blocked-card";
import { EmptyStateCard } from "@/components/product/foundation/empty-state-card";
import { WorkspaceCard } from "@/components/product/foundation/workspace-card";
import { Badge } from "@/components/ui/badge";
import { EmbeddedCard } from "@/components/ui/embedded-card";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  buildDocumentEditorHref,
  getDocumentFamilyLabel,
  getDocumentOpenActionLabel,
  getDocumentSubtypeLabel,
  getDocumentTypeLabel,
} from "@/lib/documents/family-registry";
import type {
  DocumentAreaPersistedListItem,
  DocumentAreaServerSummary,
  DocumentTrustorRegistrySummary,
} from "@/server/document-area/context";

import {
  DocumentLink,
  formatFilingMode,
  formatForumSyncState,
  formatDocumentStatus,
} from "@/components/product/document-area/document-persistence-shared";

function formatDocumentSubtype(documentType: DocumentAreaPersistedListItem["documentType"]) {
  return getDocumentSubtypeLabel(documentType);
}

function PersistedDocumentList(props: {
  documents: DocumentAreaPersistedListItem[];
}) {
  if (props.documents.length === 0) {
    return (
      <EmptyStateCard
        description="Созданные черновики и собранные документы появятся здесь."
        title="Пока нет документов"
      />
    );
  }

  return (
    <div className="space-y-4">
      {props.documents.map((document) => (
        <WorkspaceCard
          actions={[
            {
              href: buildDocumentEditorHref({
                serverCode: document.server.code,
                documentId: document.id,
                documentType: document.documentType,
              }),
              label: getDocumentOpenActionLabel(document.documentType),
            },
          ]}
          description={`Персонаж: ${document.authorSnapshot.fullName}, паспорт ${document.authorSnapshot.passportNumber}. Данные сохранены: ${new Date(document.snapshotCapturedAt).toLocaleString("ru-RU")}.`}
          eyebrow="Документ"
          key={document.id}
          meta={
            <>
              <Badge>{getDocumentFamilyLabel(document.documentType)}</Badge>
              {formatDocumentSubtype(document.documentType) ? (
                <Badge>{formatDocumentSubtype(document.documentType)}</Badge>
              ) : (
                <Badge>{getDocumentTypeLabel(document.documentType)}</Badge>
              )}
              <StatusBadge tone="info">{formatDocumentStatus(document.status)}</StatusBadge>
              {document.dataHealth === "invalid_payload" ? (
                <StatusBadge tone="warning">Требует восстановления</StatusBadge>
              ) : null}
              {document.documentType === "ogp_complaint" && formatForumSyncState(document.forumSyncState) ? (
                <StatusBadge tone="neutral">Форум: {formatForumSyncState(document.forumSyncState)}</StatusBadge>
              ) : null}
              {formatFilingMode(document.filingMode) ? (
                <StatusBadge tone="neutral">Подача: {formatFilingMode(document.filingMode)}</StatusBadge>
              ) : null}
              <span className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                {document.server.name}
              </span>
            </>
          }
          title={document.title}
        >
          <div className="space-y-2">
            {document.dataHealth === "invalid_payload" ? (
              <EmbeddedCard className="border-[rgba(184,135,57,0.3)] bg-[rgba(122,88,34,0.18)] text-[#f0d4a0]">
                Документ требует восстановления данных. Карточка открыта в безопасном режиме, часть
                полей скрыта до ручной проверки.
              </EmbeddedCard>
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
                    ? `Договор привязан к доверителю: ${document.trustorName ?? "не указан"}. После сборки здесь доступны готовые страницы для проверки и скачивания.`
                    : "Этот документ относится к разделу исков и собирается отдельно от жалоб в ОГП."}
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
                Сборка выполнена: {new Date(document.generatedAt).toLocaleString("ru-RU")}.
                {document.isModifiedAfterGeneration ? " После последней сборки в документе есть изменения." : ""}
              </p>
            ) : null}
            {document.publicationUrl ? (
              <p className="text-sm leading-6 text-[var(--muted)]">
                Ссылка на публикацию: {document.publicationUrl}. Отмечено как опубликованное вручную: {document.isSiteForumSynced ? "да" : "нет"}.
                {document.forumSyncState ? ` Статус: ${formatForumSyncState(document.forumSyncState)}.` : ""}
              </p>
            ) : null}
            {document.documentType === "ogp_complaint" && document.forumLastSyncError ? (
              <EmbeddedCard className="border-[rgba(200,112,92,0.35)] bg-[rgba(116,48,33,0.2)] text-[#f2b8ad]">
                Не удалось подтвердить последнюю публикацию. Проверьте ссылку и попробуйте ещё раз.
              </EmbeddedCard>
            ) : null}
            {document.workingNotesPreview ? (
              <p className="text-sm leading-6 text-[var(--muted)]">
                Рабочие заметки: {document.workingNotesPreview}
              </p>
            ) : null}
          </div>
        </WorkspaceCard>
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
      <EmbeddedCard className="space-y-3">
        <SectionHeader
          description="Здесь собраны ваши сохранённые документы по всем серверам. Создание и редактирование открываются из раздела конкретного сервера."
          eyebrow="Документы"
          title="Мои документы"
        />
      </EmbeddedCard>

      <PersistedDocumentList documents={props.documents} />

      <WorkspaceCard
        description="Откройте нужный сервер, чтобы перейти к документам этого рабочего контекста."
        eyebrow="Навигация"
        title="Документы по серверам"
      >
        <div className="grid gap-4 md:grid-cols-2">
          {props.servers.map((server) => (
            <EmbeddedCard className="space-y-3" key={server.id}>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{server.name}</Badge>
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
            </EmbeddedCard>
          ))}
        </div>
      </WorkspaceCard>
    </div>
  );
}

function buildFamilyMeta(props: {
  serverName: string;
  selectedCharacter:
    | {
        fullName: string;
        passportNumber: string;
        source: "last_used" | "first_available";
      }
    | null;
  extra?: string | null;
  unavailableLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-[var(--muted)]">
      <StatusBadge tone="warning">Сервер: {props.serverName}</StatusBadge>
      {props.selectedCharacter ? (
        <>
          <StatusBadge tone="warning">Персонаж: {props.selectedCharacter.fullName}</StatusBadge>
          <span>
            Выбор:{" "}
            {props.selectedCharacter.source === "last_used" ? "последний использованный" : "первый доступный"}
          </span>
        </>
      ) : (
        <StatusBadge tone="neutral">{props.unavailableLabel ?? "Создание недоступно: на сервере нет персонажей"}</StatusBadge>
      )}
      {props.extra ? <span>{props.extra}</span> : null}
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
      <WorkspaceCard
        actions={[
          ...(props.canCreateDocuments
            ? [
                {
                  href: `/servers/${props.server.code}/documents/ogp-complaints/new`,
                  label: "Создать черновик",
                },
              ]
            : []),
          {
            href: `/servers/${props.server.code}/documents`,
            label: "Вернуться к документам сервера",
          },
        ]}
        description="Здесь отображаются сохранённые жалобы в ОГП на выбранном сервере."
        eyebrow="Жалобы в ОГП"
        meta={buildFamilyMeta({
          serverName: props.server.name,
          selectedCharacter: props.selectedCharacter,
          extra: props.selectedCharacter
            ? `Может подавать как представитель: ${props.selectedCharacter.canUseRepresentative ? "да" : "нет"}`
            : null,
        })}
        title="Жалобы в ОГП"
      />

      {!props.canCreateDocuments ? (
        <AccessBlockedCard
          description="На сервере сейчас нет доступных персонажей, поэтому новую жалобу создать нельзя."
          helperText="Уже сохранённые черновики остаются доступны."
          title="Создание временно недоступно"
        />
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
      <WorkspaceCard
        actions={[
          ...(props.canCreateDocuments
            ? [
                {
                  href: `/servers/${props.server.code}/documents/attorney-requests/new`,
                  label: "Создать адвокатский запрос",
                },
              ]
            : []),
          {
            href: `/servers/${props.server.code}/documents`,
            label: "Вернуться к документам сервера",
          },
        ]}
        description="Здесь отображаются сохранённые адвокатские запросы на выбранном сервере. Каждый запрос фиксируется за конкретным доверителем при первом сохранении."
        eyebrow="Адвокатские запросы"
        meta={buildFamilyMeta({
          serverName: props.server.name,
          selectedCharacter: props.selectedCharacter,
          extra: `${props.selectedCharacter ? `Роль адвоката: ${props.selectedCharacter.canCreateAttorneyRequest ? "есть" : "нет"}. ` : ""}Доверителей на сервере: ${props.trustorRegistry.length}`,
        })}
        title="Адвокатские запросы"
      />

      {!props.canCreateDocuments ? (
        <AccessBlockedCard
          description="Для создания нужен персонаж с ролью адвоката и хотя бы один доверитель на этом сервере."
          helperText="Сохранённые запросы при этом остаются доступны."
          title="Создание пока недоступно"
        />
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
      <WorkspaceCard
        actions={[
          ...(props.canCreateDocuments
            ? [
                {
                  href: `/servers/${props.server.code}/documents/legal-services-agreements/new`,
                  label: "Создать договор",
                },
              ]
            : []),
          {
            href: `/servers/${props.server.code}/documents`,
            label: "Вернуться к документам сервера",
          },
        ]}
        description="Здесь отображаются сохранённые договоры. После заполнения данных можно собрать готовые страницы договора для проверки и скачивания."
        eyebrow="Договоры на оказание юридических услуг"
        meta={buildFamilyMeta({
          serverName: props.server.name,
          selectedCharacter: props.selectedCharacter,
          extra: `Доверителей на сервере: ${props.trustorRegistry.length}`,
        })}
        title="Договоры на оказание юридических услуг"
      />

      {!props.canCreateDocuments ? (
        <AccessBlockedCard
          description="Для создания нужен хотя бы один персонаж и хотя бы один доверитель на этом сервере."
          helperText="Уже сохранённые договоры остаются доступны."
          title="Создание пока недоступно"
        />
      ) : null}

      <PersistedDocumentList documents={props.documents} />
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
      <WorkspaceCard
        actions={[
          ...(props.canCreateDocuments
            ? [
                {
                  href: `/servers/${props.server.code}/documents/claims/new`,
                  label: "Создать черновик",
                },
              ]
            : []),
          {
            href: `/servers/${props.server.code}/documents`,
            label: "Вернуться к документам сервера",
          },
        ]}
        description="Здесь отображаются сохранённые документы из раздела исков. Вид документа выбирается при создании черновика и дальше уже не меняется автоматически."
        eyebrow="Иски"
        meta={buildFamilyMeta({
          serverName: props.server.name,
          selectedCharacter: props.selectedCharacter,
          unavailableLabel: "Создание недоступно: на сервере нет персонажей",
        })}
        title="Иски"
      />

      {!props.canCreateDocuments ? (
        <AccessBlockedCard
          description="На сервере сейчас нет доступных персонажей, поэтому новый документ из раздела исков создать нельзя."
          helperText="Уже сохранённые черновики при этом остаются доступны."
          title="Создание временно недоступно"
        />
      ) : null}

      <PersistedDocumentList documents={props.documents} />
    </div>
  );
}
