import { EmptyStateCard } from "@/components/product/foundation/empty-state-card";
import { WorkspaceCard } from "@/components/product/foundation/workspace-card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button-link";
import { EmbeddedCard } from "@/components/ui/embedded-card";
import { EmptyState } from "@/components/ui/empty-state";
import { PanelCard } from "@/components/ui/panel-card";
import { SectionHeader } from "@/components/ui/section-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { WarningNotice } from "@/components/ui/warning-notice";
import { WorkspaceSurface } from "@/components/ui/workspace-surface";
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

type FamilySelectedCharacter = {
  fullName: string;
  passportNumber: string;
  source: "last_used" | "first_available";
};

type FamilyHeroBadge = {
  label: string;
  tone?: "neutral" | "success" | "warning" | "info";
};

type FamilyStat = {
  label: string;
  value: string;
  helperText?: string | null;
  tone?: "neutral" | "success" | "warning" | "danger";
};

type FamilyOverviewLayoutProps = {
  eyebrow: string;
  title: string;
  description: string;
  server: {
    code: string;
    name: string;
  };
  selectedCharacter: FamilySelectedCharacter | null;
  documents: DocumentAreaPersistedListItem[];
  canCreateDocuments: boolean;
  createHref: string;
  createLabel: string;
  hubHref: string;
  heroBadges?: FamilyHeroBadge[];
  heroSupportingText?: string | null;
  stats: FamilyStat[];
  notice?: {
    title?: string;
    description: string;
    tone?: "warning" | "danger";
  } | null;
  emptyState: {
    title: string;
    description: string;
  };
  listDescription: string;
};

function buildCharacterSourceLabel(source: FamilySelectedCharacter["source"]) {
  return source === "last_used" ? "последний использованный" : "первый доступный";
}

function getDocumentStatusTone(
  status: DocumentAreaPersistedListItem["status"],
): "neutral" | "success" | "info" {
  if (status === "draft") {
    return "neutral";
  }

  if (status === "generated") {
    return "success";
  }

  return "info";
}

function FamilyHeroMeta(props: {
  serverName: string;
  selectedCharacter: FamilySelectedCharacter | null;
  badges?: FamilyHeroBadge[];
  supportingText?: string | null;
  unavailableLabel?: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone="info">Сервер: {props.serverName}</StatusBadge>
        {props.selectedCharacter ? (
          <StatusBadge tone="success">Персонаж: {props.selectedCharacter.fullName}</StatusBadge>
        ) : (
          <StatusBadge tone="neutral">
            {props.unavailableLabel ?? "Персонаж не выбран"}
          </StatusBadge>
        )}
        {props.badges?.map((badge) => (
          <StatusBadge key={badge.label} tone={badge.tone ?? "neutral"}>
            {badge.label}
          </StatusBadge>
        ))}
      </div>
      {props.selectedCharacter ? (
        <p className="text-sm leading-6 text-[var(--muted)]">
          Паспорт: {props.selectedCharacter.passportNumber}. Выбран{" "}
          {buildCharacterSourceLabel(props.selectedCharacter.source)} профиль.
          {props.supportingText ? ` ${props.supportingText}` : ""}
        </p>
      ) : props.supportingText ? (
        <p className="text-sm leading-6 text-[var(--muted)]">{props.supportingText}</p>
      ) : null}
    </div>
  );
}

function FamilyDocumentCard(props: {
  document: DocumentAreaPersistedListItem;
}) {
  const { document } = props;
  const editorHref = buildDocumentEditorHref({
    serverCode: document.server.code,
    documentId: document.id,
    documentType: document.documentType,
  });
  const subtypeLabel =
    formatDocumentSubtype(document.documentType) ?? getDocumentTypeLabel(document.documentType);

  return (
    <PanelCard className="space-y-4 border-[var(--divider)] transition-colors hover:border-[var(--selected-row)] hover:bg-[rgba(255,255,255,0.03)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">Документ</p>
            <h2 className="text-2xl font-semibold tracking-[-0.03em]">{document.title}</h2>
            <p className="text-sm leading-6 text-[var(--muted)]">
              Персонаж: {document.authorSnapshot.fullName}, паспорт{" "}
              {document.authorSnapshot.passportNumber}. Снимок данных сохранён{" "}
              {new Date(document.snapshotCapturedAt).toLocaleString("ru-RU")}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{getDocumentFamilyLabel(document.documentType)}</Badge>
            <Badge>{subtypeLabel}</Badge>
            <StatusBadge tone={getDocumentStatusTone(document.status)}>
              {formatDocumentStatus(document.status)}
            </StatusBadge>
            {document.dataHealth === "invalid_payload" ? (
              <StatusBadge tone="warning">Требует восстановления</StatusBadge>
            ) : null}
            {document.documentType === "ogp_complaint" && formatForumSyncState(document.forumSyncState) ? (
              <StatusBadge tone="neutral">
                Форум: {formatForumSyncState(document.forumSyncState)}
              </StatusBadge>
            ) : null}
            {formatFilingMode(document.filingMode) ? (
              <StatusBadge tone="neutral">Подача: {formatFilingMode(document.filingMode)}</StatusBadge>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-3">
          <ButtonLink href={editorHref} variant="secondary">
            {getDocumentOpenActionLabel(document.documentType)}
          </ButtonLink>
        </div>
      </div>

      <div className="space-y-3 text-sm leading-6 text-[var(--muted)]">
        {document.dataHealth === "invalid_payload" ? (
          <WarningNotice
            description="Документ требует восстановления данных. Карточка открыта в безопасном режиме, часть полей скрыта до ручной проверки."
            title="Нужна ручная проверка"
          />
        ) : null}
        {document.documentType === "ogp_complaint" &&
        document.dataHealth === "ok" &&
        (document.appealNumber || document.objectOrganization || document.objectFullName) ? (
          <p>
            Номер обращения: {document.appealNumber || "не указан"}. Объект жалобы:{" "}
            {document.objectOrganization || "—"} / {document.objectFullName || "—"}.
          </p>
        ) : null}
        {document.documentType !== "ogp_complaint" && document.dataHealth === "ok" ? (
          <p>
            {document.documentType === "attorney_request"
              ? `Адвокатский запрос привязан к доверителю: ${document.trustorName ?? "не указан"}.`
              : document.documentType === "legal_services_agreement"
                ? `Договор привязан к доверителю: ${document.trustorName ?? "не указан"}. После сборки здесь доступны готовые страницы для проверки и скачивания.`
                : "Документ относится к разделу исков и собирается отдельно от жалоб в ОГП."}
          </p>
        ) : null}
        {document.documentType === "attorney_request" && document.dataHealth === "ok" ? (
          <p>Номер запроса: {document.requestNumber || "не указан"}.</p>
        ) : null}
        {document.documentType === "legal_services_agreement" && document.dataHealth === "ok" ? (
          <p>Номер договора: {document.agreementNumber || "не указан"}.</p>
        ) : null}
        <p>Последнее обновление: {new Date(document.updatedAt).toLocaleString("ru-RU")}.</p>
        {document.generatedAt ? (
          <p>
            Сборка выполнена: {new Date(document.generatedAt).toLocaleString("ru-RU")}.
            {document.isModifiedAfterGeneration
              ? " После последней сборки в документе есть изменения."
              : ""}
          </p>
        ) : null}
        {document.publicationUrl ? (
          <p>
            Ссылка на публикацию: {document.publicationUrl}. Отмечено как опубликованное вручную:{" "}
            {document.isSiteForumSynced ? "да" : "нет"}.
            {document.forumSyncState ? ` Статус: ${formatForumSyncState(document.forumSyncState)}.` : ""}
          </p>
        ) : null}
        {document.documentType === "ogp_complaint" && document.forumLastSyncError ? (
          <WarningNotice
            description="Не удалось подтвердить последнюю публикацию. Проверьте ссылку и попробуйте ещё раз."
            title="Не удалось сверить публикацию"
            tone="danger"
          />
        ) : null}
        {document.workingNotesPreview ? <p>Рабочие заметки: {document.workingNotesPreview}</p> : null}
      </div>
    </PanelCard>
  );
}

function FamilyDocumentList(props: {
  documents: DocumentAreaPersistedListItem[];
  listDescription: string;
  emptyState: {
    title: string;
    description: string;
  };
  canCreateDocuments: boolean;
  createHref: string;
  createLabel: string;
  hubHref: string;
}) {
  if (props.documents.length === 0) {
    return (
      <EmptyState
        action={
          props.canCreateDocuments
            ? {
                href: props.createHref,
                label: props.createLabel,
              }
            : undefined
        }
        description={props.emptyState.description}
        secondaryAction={{
          href: props.hubHref,
          label: "К документам сервера",
          variant: "secondary",
        }}
        title={props.emptyState.title}
      />
    );
  }

  return (
    <div className="space-y-4">
      <PanelCard className="space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">
              Список документов
            </p>
            <h2 className="text-2xl font-semibold tracking-[-0.03em]">
              Сохранённые документы
            </h2>
            <p className="text-sm leading-6 text-[var(--muted)]">{props.listDescription}</p>
          </div>
          <StatusBadge tone="info">Документов: {props.documents.length}</StatusBadge>
        </div>
      </PanelCard>

      <div className="space-y-4">
        {props.documents.map((document) => (
          <FamilyDocumentCard document={document} key={document.id} />
        ))}
      </div>
    </div>
  );
}

function DocumentFamilyOverviewLayout(props: FamilyOverviewLayoutProps) {
  return (
    <div className="space-y-6">
      <WorkspaceSurface className="space-y-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
                {props.eyebrow}
              </p>
              <h1 className="text-3xl font-semibold tracking-[-0.04em]">
                {props.title}
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
                {props.description}
              </p>
            </div>
            <FamilyHeroMeta
              badges={props.heroBadges}
              selectedCharacter={props.selectedCharacter}
              serverName={props.server.name}
              supportingText={props.heroSupportingText}
              unavailableLabel="Создание недоступно: выберите персонажа на сервере"
            />
          </div>

          <div className="flex flex-wrap gap-3 xl:max-w-sm xl:justify-end">
            {props.canCreateDocuments ? (
              <ButtonLink href={props.createHref}>{props.createLabel}</ButtonLink>
            ) : null}
            <ButtonLink href={props.hubHref} variant="secondary">
              К документам сервера
            </ButtonLink>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {props.stats.map((stat) => (
            <StatCard
              helperText={stat.helperText}
              key={stat.label}
              label={stat.label}
              tone={stat.tone}
              value={stat.value}
            />
          ))}
        </div>
      </WorkspaceSurface>

      {props.notice ? (
        <WarningNotice
          description={props.notice.description}
          title={props.notice.title}
          tone={props.notice.tone ?? "warning"}
        />
      ) : null}

      <FamilyDocumentList
        canCreateDocuments={props.canCreateDocuments}
        createHref={props.createHref}
        createLabel={props.createLabel}
        documents={props.documents}
        emptyState={props.emptyState}
        hubHref={props.hubHref}
        listDescription={props.listDescription}
      />
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
    <DocumentFamilyOverviewLayout
      canCreateDocuments={props.canCreateDocuments}
      createHref={`/servers/${props.server.code}/documents/ogp-complaints/new`}
      createLabel="Создать жалобу"
      description="Открывайте, проверяйте и создавайте жалобы в ОГП по выбранному серверу."
      documents={props.documents}
      emptyState={{
        title: "Жалоб пока нет",
        description: "Создайте первую жалобу в ОГП, чтобы она появилась в этом разделе.",
      }}
      eyebrow="Жалобы в ОГП"
      heroBadges={
        props.selectedCharacter
          ? [
              {
                label: `Представительство: ${props.selectedCharacter.canUseRepresentative ? "доступно" : "недоступно"}`,
                tone: props.selectedCharacter.canUseRepresentative ? "success" : "warning",
              },
            ]
          : undefined
      }
      heroSupportingText={
        props.selectedCharacter
          ? "Жалоба создаётся в контексте выбранного персонажа и может быть открыта для дальнейшей проверки."
          : "Новые жалобы можно создавать только после выбора доступного персонажа на сервере."
      }
      hubHref={`/servers/${props.server.code}/documents`}
      listDescription="Здесь собраны сохранённые жалобы в ОГП. Открывайте нужный документ, чтобы продолжить редактирование, сборку и публикацию."
      notice={
        !props.canCreateDocuments
          ? {
              title: "Создание временно недоступно",
              description:
                "На сервере сейчас нет доступных персонажей, поэтому новую жалобу создать нельзя. Уже сохранённые черновики остаются доступны.",
            }
          : null
      }
      selectedCharacter={props.selectedCharacter}
      server={props.server}
      stats={[
        {
          label: "Документы",
          value: String(props.documents.length),
          helperText: "Всего сохранённых жалоб на выбранном сервере.",
          tone: props.documents.length > 0 ? "success" : "neutral",
        },
        {
          label: "Создание",
          value: props.canCreateDocuments ? "Доступно" : "Ограничено",
          helperText: props.canCreateDocuments
            ? "Можно открыть новый черновик жалобы."
            : "Нужен доступный персонаж на сервере.",
          tone: props.canCreateDocuments ? "success" : "warning",
        },
        {
          label: "Представитель",
          value: props.selectedCharacter
            ? props.selectedCharacter.canUseRepresentative
              ? "Да"
              : "Нет"
            : "—",
          helperText: "Показывает, можно ли подавать жалобу как представитель.",
          tone: props.selectedCharacter?.canUseRepresentative ? "success" : "neutral",
        },
      ]}
      title="Жалобы в ОГП"
    />
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
    <DocumentFamilyOverviewLayout
      canCreateDocuments={props.canCreateDocuments}
      createHref={`/servers/${props.server.code}/documents/attorney-requests/new`}
      createLabel="Создать запрос"
      description="Открывайте и создавайте адвокатские запросы по выбранному серверу и доверителям."
      documents={props.documents}
      emptyState={{
        title: "Адвокатских запросов пока нет",
        description: "Создайте первый адвокатский запрос, чтобы он появился в этом разделе.",
      }}
      eyebrow="Адвокатские запросы"
      heroBadges={
        props.selectedCharacter
          ? [
              {
                label: `Адвокатский доступ: ${props.selectedCharacter.canCreateAttorneyRequest ? "есть" : "нет"}`,
                tone: props.selectedCharacter.canCreateAttorneyRequest ? "success" : "warning",
              },
            ]
          : undefined
      }
      heroSupportingText={`Доверителей на сервере: ${props.trustorRegistry.length}. После первого сохранения запрос фиксируется за конкретным доверителем.`}
      hubHref={`/servers/${props.server.code}/documents`}
      listDescription="Здесь собраны сохранённые адвокатские запросы. Каждый запрос остаётся привязанным к доверителю и открывается в том же server-scoped контуре."
      notice={
        !props.canCreateDocuments
          ? {
              title: "Создание пока недоступно",
              description:
                "Для создания нужен персонаж с ролью адвоката и хотя бы один доверитель на этом сервере. Сохранённые запросы при этом остаются доступны.",
            }
          : {
              title: "Снимок доверителя",
              description:
                "После первого сохранения доверитель фиксируется в документе, поэтому карточку запроса можно проверять независимо от дальнейших изменений в реестре доверителей.",
            }
      }
      selectedCharacter={props.selectedCharacter}
      server={props.server}
      stats={[
        {
          label: "Документы",
          value: String(props.documents.length),
          helperText: "Всего сохранённых адвокатских запросов на сервере.",
          tone: props.documents.length > 0 ? "success" : "neutral",
        },
        {
          label: "Доверители",
          value: String(props.trustorRegistry.length),
          helperText: "Количество доверителей, доступных в этом контуре сервера.",
          tone: props.trustorRegistry.length > 0 ? "success" : "warning",
        },
        {
          label: "Адвокатский доступ",
          value: props.selectedCharacter?.canCreateAttorneyRequest ? "Активен" : "Ожидает",
          helperText: "Для нового запроса нужен персонаж с адвокатским доступом.",
          tone: props.selectedCharacter?.canCreateAttorneyRequest ? "success" : "warning",
        },
      ]}
      title="Адвокатские запросы"
    />
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
    <DocumentFamilyOverviewLayout
      canCreateDocuments={props.canCreateDocuments}
      createHref={`/servers/${props.server.code}/documents/legal-services-agreements/new`}
      createLabel="Создать договор"
      description="Открывайте и собирайте договоры на оказание юридических услуг в рабочем контуре выбранного сервера."
      documents={props.documents}
      emptyState={{
        title: "Договоров пока нет",
        description:
          "Создайте первый договор на оказание юридических услуг, чтобы он появился в этом разделе.",
      }}
      eyebrow="Договоры"
      heroBadges={
        props.selectedCharacter
          ? [
              {
                label: `Подпись: ${props.selectedCharacter.hasActiveSignature ? "загружена" : "ожидается"}`,
                tone: props.selectedCharacter.hasActiveSignature ? "success" : "warning",
              },
            ]
          : undefined
      }
      heroSupportingText={`Доверителей на сервере: ${props.trustorRegistry.length}. После сборки здесь доступны готовые страницы для проверки и скачивания.`}
      hubHref={`/servers/${props.server.code}/documents`}
      listDescription="Здесь собраны сохранённые договоры. Откройте нужный документ, чтобы продолжить проверку полей и собрать итоговые страницы."
      notice={
        !props.canCreateDocuments
          ? {
              title: "Создание пока недоступно",
              description:
                "Для создания нужен хотя бы один персонаж и хотя бы один доверитель на этом сервере. Уже сохранённые договоры остаются доступны.",
            }
          : {
              title: "Сборка страниц договора",
              description:
                "После заполнения утверждённых полей можно собрать готовые страницы договора для проверки и скачивания без изменения самого create-flow.",
            }
      }
      selectedCharacter={props.selectedCharacter}
      server={props.server}
      stats={[
        {
          label: "Документы",
          value: String(props.documents.length),
          helperText: "Всего сохранённых договоров в этом server-scoped разделе.",
          tone: props.documents.length > 0 ? "success" : "neutral",
        },
        {
          label: "Доверители",
          value: String(props.trustorRegistry.length),
          helperText: "Количество доверителей, доступных для новых договоров.",
          tone: props.trustorRegistry.length > 0 ? "success" : "warning",
        },
        {
          label: "Подпись",
          value: props.selectedCharacter?.hasActiveSignature ? "Готова" : "Ожидается",
          helperText: "Активная подпись понадобится при сборке итоговых страниц.",
          tone: props.selectedCharacter?.hasActiveSignature ? "success" : "warning",
        },
      ]}
      title="Договоры на оказание юридических услуг"
    />
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
    <DocumentFamilyOverviewLayout
      canCreateDocuments={props.canCreateDocuments}
      createHref={`/servers/${props.server.code}/documents/claims/new`}
      createLabel="Создать иск"
      description="Открывайте и редактируйте исковые заявления и документы по реабилитации на выбранном сервере."
      documents={props.documents}
      emptyState={{
        title: "Исков пока нет",
        description: "Создайте первое исковое заявление, чтобы оно появилось в этом разделе.",
      }}
      eyebrow="Иски"
      heroSupportingText="Тип документа выбирается при создании черновика и дальше не меняется автоматически."
      hubHref={`/servers/${props.server.code}/documents`}
      listDescription="Здесь собраны сохранённые документы из раздела исков. Откройте нужный черновик, чтобы продолжить редактирование и сборку."
      notice={
        !props.canCreateDocuments
          ? {
              title: "Создание временно недоступно",
              description:
                "На сервере сейчас нет доступных персонажей, поэтому новый документ из раздела исков создать нельзя. Уже сохранённые черновики при этом остаются доступны.",
            }
          : null
      }
      selectedCharacter={props.selectedCharacter}
      server={props.server}
      stats={[
        {
          label: "Документы",
          value: String(props.documents.length),
          helperText: "Всего сохранённых документов в разделе исков.",
          tone: props.documents.length > 0 ? "success" : "neutral",
        },
        {
          label: "Создание",
          value: props.canCreateDocuments ? "Доступно" : "Ограничено",
          helperText: props.canCreateDocuments
            ? "Можно открыть новый черновик искового документа."
            : "Нужен доступный персонаж на выбранном сервере.",
          tone: props.canCreateDocuments ? "success" : "warning",
        },
        {
          label: "Персонаж",
          value: props.selectedCharacter ? "Выбран" : "Не выбран",
          helperText: props.selectedCharacter
            ? props.selectedCharacter.fullName
            : "Без выбранного персонажа создание недоступно.",
          tone: props.selectedCharacter ? "success" : "warning",
        },
      ]}
      title="Исковые заявления"
    />
  );
}
