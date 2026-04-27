"use client";

import { ClaimsFieldHint } from "@/components/product/document-area/document-claims-editor-form";
import type {
  ClaimsGenerationState,
  ClaimsPreviewState,
} from "@/components/product/document-area/document-claims-editor-shared";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

function formatClaimsDocumentStatus(status: ClaimsGenerationState["status"]) {
  if (status === "draft") {
    return "Черновик";
  }

  if (status === "generated") {
    return "Документ собран";
  }

  return "Опубликован";
}

export function ClaimsEditorActionBar(props: {
  isDirty: boolean;
  hasPreview: boolean;
  onSave: () => void;
  onGeneratePreview: () => void;
  onGenerateCheckpoint: () => void;
  onCopyPreview: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button disabled={!props.isDirty} onClick={props.onSave} type="button">
        Сохранить черновик
      </Button>
      <Button disabled={props.isDirty} onClick={props.onGeneratePreview} type="button" variant="secondary">
        Обновить предпросмотр
      </Button>
      <Button disabled={props.isDirty} onClick={props.onGenerateCheckpoint} type="button" variant="secondary">
        Сохранить итоговую версию
      </Button>
      <Button disabled={!props.hasPreview} onClick={props.onCopyPreview} type="button" variant="secondary">
        Скопировать текст
      </Button>
    </div>
  );
}

export function ClaimsEditorPreviewPanels(props: {
  generationState: ClaimsGenerationState;
  previewState: ClaimsPreviewState;
  isPreviewStale: boolean;
}) {
  return (
    <>
      <div className="space-y-4 rounded-3xl border border-[var(--border)] bg-white/70 p-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Сведения о сборке</h3>
          <ClaimsFieldHint>
            Здесь видно, когда в последний раз собирался текст документа и нужно ли обновить его перед использованием.
          </ClaimsFieldHint>
        </div>
        <ul className="space-y-2 text-sm leading-6 text-[var(--muted)]">
          <li>Статус документа: {formatClaimsDocumentStatus(props.generationState.status)}</li>
          <li>
            Результат сборки: {props.previewState?.format ?? props.generationState.generatedOutputFormat ?? "ещё не подготовлен"}
          </li>
          <li>
            Последняя сборка:{" "}
            {props.generationState.generatedAt
              ? new Date(props.generationState.generatedAt).toLocaleString("ru-RU")
              : "ещё не выполнялась"}
          </li>
          <li>
            {props.generationState.isModifiedAfterGeneration
              ? "После последней сборки документ менялся. Перед использованием лучше обновить предпросмотр."
              : "После последней сборки документ не менялся."}
          </li>
          <li>Публикация на форуме для этого раздела не используется.</li>
          {props.previewState ? (
            <li>
              Что ещё нужно проверить:{" "}
              {props.previewState.blockingReasons.length > 0 ? props.previewState.blockingReasons.join(", ") : "замечаний нет"}
            </li>
          ) : null}
          {props.isPreviewStale ? (
            <li>
              Текущий предпросмотр устарел после последнего сохранения. Обновите его перед использованием.
            </li>
          ) : null}
        </ul>
      </div>

      <div className="space-y-4 rounded-3xl border border-[var(--border)] bg-white/70 p-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Предпросмотр документа</h3>
          <ClaimsFieldHint>Здесь показывается текст, который будет использован в итоговой версии документа.</ClaimsFieldHint>
        </div>
        {props.previewState ? (
          <div className="space-y-4">
            {props.previewState.sections.map((section) => (
              <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-white/80 p-4" key={section.key}>
                <h4 className="text-sm font-semibold text-[var(--foreground)]">{section.title}</h4>
                <pre className="whitespace-pre-wrap text-sm leading-6 text-[var(--muted)]">{section.body}</pre>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-5 text-sm text-[var(--muted)]">
            Предпросмотр ещё не собран. Сначала сохраните черновик, затем обновите предпросмотр.
          </div>
        )}
      </div>

      <div className="space-y-4 rounded-3xl border border-[var(--border)] bg-white/70 p-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Текст для копирования</h3>
          <ClaimsFieldHint>Этот текст можно использовать для просмотра и дальнейшей ручной работы с документом.</ClaimsFieldHint>
        </div>
        <Textarea className="min-h-[320px] font-mono text-xs" readOnly value={props.previewState?.copyText ?? "Предпросмотр ещё не собран."} />
      </div>
    </>
  );
}
