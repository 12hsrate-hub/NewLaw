"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { resolveComplaintNarrativeReviewStatus } from "@/components/product/document-area/document-ai-review-copy";
import {
  formatComplaintNarrativeRiskFlagLabel,
  type OgpComplaintNarrativeImprovementSuggestionState,
} from "@/components/product/document-area/document-draft-editor-shared";

type ComplaintNarrativeImprovementPanelProps = {
  suggestion: OgpComplaintNarrativeImprovementSuggestionState;
  onApply: () => void;
  onDismiss: () => void;
  onCopy: () => void;
};

function formatLegalBasisLabel(input: {
  lawName: string;
  article?: string;
  part?: string;
}) {
  return [input.lawName, input.article ? `ст. ${input.article}` : null, input.part ? `ч. ${input.part}` : null]
    .filter(Boolean)
    .join(", ");
}

export function ComplaintNarrativeImprovementPanel(
  props: ComplaintNarrativeImprovementPanelProps,
) {
  const { suggestion } = props;
  const reviewStatus = resolveComplaintNarrativeReviewStatus({
    riskFlags: suggestion.riskFlags,
    shouldSendToReview: suggestion.shouldSendToReview,
  });
  const reviewToneClassName =
    reviewStatus.tone === "ready"
      ? "bg-[rgba(32,99,69,0.08)]"
      : reviewStatus.tone === "rework"
        ? "bg-[rgba(141,79,49,0.12)]"
        : "bg-[rgba(141,79,49,0.08)]";

  return (
    <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-white/80 p-4">
      <div className="space-y-1">
        <p className="text-sm font-medium text-[var(--foreground)]">Предложенный улучшенный текст</p>
        <p className="text-xs leading-5 text-[var(--muted)]">
          Вариант подготовлен по последней сохранённой версии документа от{" "}
          {new Date(suggestion.basedOnUpdatedAt).toLocaleString("ru-RU")}.
        </p>
        <p className="text-xs leading-5 text-[var(--muted)]">
          Текст не применяется автоматически: сначала проверьте замечания и подтвердите замену поля.
        </p>
      </div>

      <div
        className={`space-y-1 rounded-2xl border border-[var(--border)] p-3 text-sm leading-6 text-[var(--foreground)] ${reviewToneClassName}`}
      >
        <p className="font-medium">{reviewStatus.title}</p>
        <p>{reviewStatus.description}</p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
          Текущий текст
        </p>
        <Textarea className="min-h-[140px]" readOnly value={suggestion.sourceText} />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
          Улучшенный текст
        </p>
        <Textarea className="min-h-[220px]" readOnly value={suggestion.improvedText} />
      </div>

      {suggestion.usedFacts.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-[var(--foreground)]">Какие факты уже отражены</p>
          <ul className="space-y-2 text-sm leading-6 text-[var(--muted)]">
            {suggestion.usedFacts.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {suggestion.missingFacts.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-[var(--foreground)]">Что ещё стоит уточнить</p>
          <ul className="space-y-2 text-sm leading-6 text-[var(--muted)]">
            {suggestion.missingFacts.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {suggestion.reviewNotes.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-[var(--foreground)]">Что стоит проверить перед подачей</p>
          <ul className="space-y-2 text-sm leading-6 text-[var(--muted)]">
            {suggestion.reviewNotes.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {suggestion.riskFlags.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-[var(--foreground)]">На что обратить внимание</p>
          <div className="flex flex-wrap gap-2">
            {suggestion.riskFlags.map((flag) => (
              <Badge key={flag}>{formatComplaintNarrativeRiskFlagLabel(flag)}</Badge>
            ))}
          </div>
        </div>
      ) : null}

      {suggestion.legalBasisUsed.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-[var(--foreground)]">Использованные нормы</p>
          <ul className="space-y-2 text-sm leading-6 text-[var(--muted)]">
            {suggestion.legalBasisUsed.map((item, index) => (
              <li key={`${item.law_name}-${item.article ?? "no-article"}-${index}`}>
                <span className="font-medium text-[var(--foreground)]">
                  {formatLegalBasisLabel({
                    lawName: item.law_name,
                    article: item.article,
                    part: item.part,
                  })}
                </span>
                : {item.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={props.onApply} type="button">
          Применить текст
        </Button>
        <Button onClick={props.onDismiss} type="button" variant="secondary">
          Оставить исходный текст
        </Button>
        <Button onClick={props.onCopy} type="button" variant="secondary">
          Скопировать вариант
        </Button>
      </div>
    </div>
  );
}
