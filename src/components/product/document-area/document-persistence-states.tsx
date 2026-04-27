import { AccessBlockedCard } from "@/components/product/foundation/access-blocked-card";
import { EmptyStateCard } from "@/components/product/foundation/empty-state-card";
import { EmbeddedCard } from "@/components/ui/embedded-card";
import { StatusBadge } from "@/components/ui/status-badge";

import {
  formatDocumentStatus,
} from "@/components/product/document-area/document-persistence-shared";

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
    <AccessBlockedCard
      badges={[`Сервер: ${props.server.name}`, "Только для владельца"]}
      description="Не удалось открыть документ. Он не найден на этом сервере или недоступен для текущего аккаунта."
      eyebrow="Документ"
      helperText="Ваши данные не удалены. Можно вернуться к списку документов и открыть другой черновик или готовый документ."
      primaryAction={{
        href: familyHref,
        label: `Вернуться к ${familyLabel}`,
      }}
      secondaryAction={{
        href: "/account/documents",
        label: "Открыть общий обзор документов",
      }}
      title="Документ недоступен"
    />
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
      <EmptyStateCard
        badges={["Требует восстановления", `Статус: ${formatDocumentStatus(props.document.status)}`]}
        description="Не удалось безопасно прочитать данные этого документа. Сам документ не удалён, но его содержимое требует проверки или восстановления."
        eyebrow="Документ"
        helperText="Попробуйте открыть другой документ или вернуться позже. Если проблема повторяется, понадобится помощь администратора."
        primaryAction={{
          href: props.familyHref,
          label: `Вернуться к ${props.familyLabel}`,
        }}
        secondaryAction={{
          href: "/account/documents",
          label: "Открыть общий обзор документов",
        }}
        title={props.document.title}
      />

      <EmbeddedCard className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone="warning">Требует восстановления</StatusBadge>
        </div>
        <div className="space-y-1 text-sm leading-6 text-[var(--muted)]">
          <p>Статус: {formatDocumentStatus(props.document.status)}.</p>
          <p>Сохранено: {new Date(props.document.snapshotCapturedAt).toLocaleString("ru-RU")}.</p>
          <p>Последнее обновление: {new Date(props.document.updatedAt).toLocaleString("ru-RU")}.</p>
        </div>
      </EmbeddedCard>
    </div>
  );
}
