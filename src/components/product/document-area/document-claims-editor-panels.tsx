"use client";

import { ClaimsFieldHint } from "@/components/product/document-area/document-claims-editor-form";
import type {
  ClaimsGenerationState,
  ClaimsPreviewState,
} from "@/components/product/document-area/document-claims-editor-shared";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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
        Сохранить claims draft
      </Button>
      <Button disabled={props.isDirty} onClick={props.onGeneratePreview} type="button" variant="secondary">
        Собрать structured preview
      </Button>
      <Button disabled={props.isDirty} onClick={props.onGenerateCheckpoint} type="button" variant="secondary">
        Зафиксировать generated checkpoint
      </Button>
      <Button disabled={!props.hasPreview} onClick={props.onCopyPreview} type="button" variant="secondary">
        Копировать текст preview
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
          <h3 className="text-lg font-semibold">Claims output preview</h3>
          <ClaimsFieldHint>
            Это отдельный claims structured renderer. Он не использует OGP BBCode и не включает publication workflow.
          </ClaimsFieldHint>
        </div>
        <ul className="space-y-2 text-sm leading-6 text-[var(--muted)]">
          <li>Document status: {props.generationState.status}</li>
          <li>
            Preview format: {props.previewState?.format ?? props.generationState.generatedOutputFormat ?? "ещё не собран"}
          </li>
          <li>
            Renderer version:{" "}
            {props.previewState?.rendererVersion ?? props.generationState.generatedRendererVersion ?? "ещё не собран"}
          </li>
          <li>
            Generated at:{" "}
            {props.generationState.generatedAt
              ? new Date(props.generationState.generatedAt).toLocaleString("ru-RU")
              : "checkpoint ещё не фиксировался"}
          </li>
          <li>
            Generated form schema version: {props.generationState.generatedFormSchemaVersion ?? "ещё не зафиксирована"}
          </li>
          <li>Modified after generation: {props.generationState.isModifiedAfterGeneration ? "да" : "нет"}</li>
          <li>Publication / forum sync для claims на этом шаге не активируются.</li>
          {props.previewState ? (
            <li>
              Blocking reasons:{" "}
              {props.previewState.blockingReasons.length > 0 ? props.previewState.blockingReasons.join(", ") : "нет"}
            </li>
          ) : null}
          {props.isPreviewStale ? (
            <li>
              Текущий preview устарел после последнего сохранения. Можно собрать preview заново или перезаписать
              generated checkpoint.
            </li>
          ) : null}
        </ul>
      </div>

      <div className="space-y-4 rounded-3xl border border-[var(--border)] bg-white/70 p-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Structured preview</h3>
          <ClaimsFieldHint>Preview и copyText строятся из одного и того же deterministic output shape.</ClaimsFieldHint>
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
            Structured preview ещё не собран. Сначала сохрани draft, затем запусти Generate preview.
          </div>
        )}
      </div>

      <div className="space-y-4 rounded-3xl border border-[var(--border)] bg-white/70 p-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Copy-friendly text</h3>
          <ClaimsFieldHint>Это не BBCode и не publication artifact. Текст только для просмотра и копирования.</ClaimsFieldHint>
        </div>
        <Textarea className="min-h-[320px] font-mono text-xs" readOnly value={props.previewState?.copyText ?? "Preview ещё не собран."} />
      </div>
    </>
  );
}
