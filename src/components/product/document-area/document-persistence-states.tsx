import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

import {
  DocumentLink,
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
