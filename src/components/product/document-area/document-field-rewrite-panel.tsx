import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type DocumentFieldRewritePanelProps = {
  sectionLabel: string;
  sourceText: string;
  suggestionText: string;
  basedOnUpdatedAt: string;
  titlePrefix?: string;
  supportingSummary?: string | null;
  onApply: () => void;
  onDismiss: () => void;
  onCopy: () => void;
};

export function DocumentFieldRewritePanel(props: DocumentFieldRewritePanelProps) {
  return (
    <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-white/80 p-4">
      <div className="space-y-1">
        <p className="text-sm font-medium text-[var(--foreground)]">
          {props.titlePrefix ?? "AI-предложение"} для секции {props.sectionLabel}
        </p>
        <p className="text-xs leading-5 text-[var(--muted)]">
          Предложение собрано только из последнего persisted состояния документа от{" "}
          {new Date(props.basedOnUpdatedAt).toLocaleString("ru-RU")}.
        </p>
        {props.supportingSummary ? (
          <p className="text-xs leading-5 text-[var(--muted)]">{props.supportingSummary}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
          Текущий текст
        </p>
        <Textarea className="min-h-[140px]" readOnly value={props.sourceText} />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
          AI-предложение
        </p>
        <Textarea className="min-h-[180px]" readOnly value={props.suggestionText} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={props.onApply} type="button">
          Применить
        </Button>
        <Button onClick={props.onDismiss} type="button" variant="secondary">
          Отклонить
        </Button>
        <Button onClick={props.onCopy} type="button" variant="secondary">
          Скопировать
        </Button>
      </div>
    </div>
  );
}
