import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
      <Card className="space-y-3">
        <h2 className="text-2xl font-semibold">Пока нет документов</h2>
        <p className="text-sm leading-6 text-[var(--muted)]">
          Созданные черновики и собранные документы появятся здесь.
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
                {document.server.name}
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
              <p className="text-sm leading-6 text-[#8a2d1d]">
                Не удалось подтвердить последнюю публикацию. Проверьте ссылку и попробуйте ещё раз.
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
          Здесь отображаются сохранённые договоры. После заполнения данных можно собрать готовые
          страницы договора для проверки и скачивания.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-[var(--muted)]">
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
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Иски</p>
        <h1 className="text-3xl font-semibold">Иски</h1>
        <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
          Здесь отображаются сохранённые документы из раздела исков. Вид документа выбирается при
          создании черновика и дальше уже не меняется автоматически.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-[var(--muted)]">
          <Badge>Сервер: {props.server.name}</Badge>
          {props.selectedCharacter ? (
            <>
              <Badge>Персонаж: {props.selectedCharacter.fullName}</Badge>
              <span>
                Сейчас выбран{" "}
                {props.selectedCharacter.source === "last_used" ? "последний использованный" : "первый доступный"} персонаж
              </span>
            </>
          ) : (
            <Badge>Создание недоступно: на сервере нет персонажей</Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          {props.canCreateDocuments ? (
            <DocumentLink href={`/servers/${props.server.code}/documents/claims/new`}>
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
            На сервере сейчас нет доступных персонажей, поэтому новый документ из раздела исков
            создать нельзя. Уже сохранённые черновики при этом остаются доступны.
          </p>
        </Card>
      ) : null}

      <PersistedDocumentList documents={props.documents} />
    </div>
  );
}
