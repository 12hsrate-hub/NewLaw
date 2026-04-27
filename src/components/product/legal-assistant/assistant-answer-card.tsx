import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type AssistantAnswerCardProps = {
  answer: {
    question: string;
    sections: {
      summary: string;
      normativeAnalysis: string;
      precedentAnalysis: string;
      interpretation: string;
      sources?: string;
    };
    metadata: Record<string, unknown> | null;
    status?: "answered" | "no_norms";
  };
};

type LawReferenceItem = {
  sourceKind: "law";
  lawId: string;
  lawKey: string;
  lawTitle: string;
  lawVersionId: string;
  lawBlockId: string;
  blockType: string;
  blockOrder: number;
  articleNumberNormalized?: string | null;
  snippet: string;
  sourceTopicUrl: string;
  sourcePosts: Array<{
    postExternalId: string;
    postUrl: string;
    postOrder: number;
  }>;
};

type PrecedentReferenceItem = {
  sourceKind: "precedent";
  precedentId: string;
  precedentKey: string;
  precedentTitle: string;
  precedentVersionId: string;
  precedentBlockId: string;
  blockType: string;
  blockOrder: number;
  validityStatus: string;
  snippet: string;
  sourceTopicUrl: string;
  sourceTopicTitle: string;
  sourcePosts: Array<{
    postExternalId: string;
    postUrl: string;
    postOrder: number;
  }>;
};

type ReferenceItem = LawReferenceItem | PrecedentReferenceItem;

function readReferenceItems(metadata: Record<string, unknown> | null) {
  const references = metadata?.references;

  return Array.isArray(references) ? (references as ReferenceItem[]) : [];
}

function formatPrecedentValidityLabel(status: string) {
  switch (status) {
    case "applicable":
      return "Подходит для использования";
    case "limited":
      return "Нужно применять с оговорками";
    case "obsolete":
      return "Требует особенно внимательной проверки";
    default:
      return "Требует проверки";
  }
}

function renderSourcePosts(
  sourcePosts: Array<{
    postExternalId: string;
    postUrl: string;
    postOrder: number;
  }>,
) {
  if (sourcePosts.length === 0) {
    return null;
  }

  return (
    <p>
      Посты:{" "}
      {sourcePosts.map((sourcePost, index) => (
        <span key={sourcePost.postExternalId}>
          {index > 0 ? ", " : ""}
          <Link className="text-[var(--accent)] underline" href={sourcePost.postUrl}>
            #{sourcePost.postOrder}
          </Link>
        </span>
      ))}
    </p>
  );
}

export function AssistantAnswerCard({ answer }: AssistantAnswerCardProps) {
  const references = readReferenceItems(answer.metadata);
  const lawReferences = references.filter(
    (reference): reference is LawReferenceItem => reference.sourceKind === "law",
  );
  const precedentReferences = references.filter(
    (reference): reference is PrecedentReferenceItem => reference.sourceKind === "precedent",
  );

  return (
    <Card className="space-y-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Badge>
            {answer.status === "no_norms"
              ? "Проверьте ответ перед использованием"
              : "Ответ основан на найденных правовых источниках"}
          </Badge>
        </div>
        {answer.status === "no_norms" ? (
          <p className="text-sm leading-6 text-[var(--muted)]">
            Часть выводов не подтверждена прямыми правовыми источниками. Перед использованием
            проверьте формулировки вручную.
          </p>
        ) : null}
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Вопрос</p>
          <p className="text-sm leading-6">{answer.question}</p>
        </div>
      </div>

      <div className="space-y-5">
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Краткий вывод</h2>
          <p className="text-sm leading-7 text-[var(--foreground)]">{answer.sections.summary}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Что прямо следует из норм закона</h2>
          <p className="text-sm leading-7 text-[var(--foreground)]">
            {answer.sections.normativeAnalysis}
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Что подтверждается судебными прецедентами</h2>
          <p className="text-sm leading-7 text-[var(--foreground)]">
            {answer.sections.precedentAnalysis}
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Вывод / интерпретация</h2>
          <p className="text-sm leading-7 text-[var(--foreground)]">
            {answer.sections.interpretation}
          </p>
        </section>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Правовые источники</h2>

        {references.length === 0 ? (
          <p className="text-sm leading-6 text-[var(--muted)]">
            Для этого ответа не нашлось прямых подтверждённых источников, на которые можно
            сослаться без дополнительной проверки.
          </p>
        ) : (
          <div className="space-y-5">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                Законы
              </h3>

              {lawReferences.length === 0 ? (
                <p className="text-sm leading-6 text-[var(--muted)]">
                  Релевантные нормы закона в этом ответе не использовались.
                </p>
              ) : (
                <div className="space-y-3">
                  {lawReferences.map((reference) => (
                    <div
                      key={reference.lawBlockId}
                      className="rounded-2xl border border-[var(--border)] bg-white/60 p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge>{reference.lawTitle}</Badge>
                        <span className="text-xs leading-6 text-[var(--muted)]">
                          {reference.articleNumberNormalized
                            ? `Статья ${reference.articleNumberNormalized}`
                            : "Фрагмент закона"}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6">{reference.snippet}</p>
                      <div className="mt-3 space-y-1 text-xs leading-6 text-[var(--muted)]">
                        <p>
                          Источник темы:{" "}
                          <Link className="text-[var(--accent)] underline" href={reference.sourceTopicUrl}>
                            {reference.sourceTopicUrl}
                          </Link>
                        </p>
                        {renderSourcePosts(reference.sourcePosts)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                Судебные прецеденты
              </h3>

              {precedentReferences.length === 0 ? (
                <p className="text-sm leading-6 text-[var(--muted)]">
                  Релевантные подтверждённые судебные прецеденты в этом ответе не использовались.
                </p>
              ) : (
                <div className="space-y-3">
                  {precedentReferences.map((reference) => (
                    <div
                      key={reference.precedentBlockId}
                      className="rounded-2xl border border-[var(--border)] bg-white/60 p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge>{reference.precedentTitle}</Badge>
                        <Badge className="bg-[rgba(32,99,69,0.12)] text-[#206345]">
                          {formatPrecedentValidityLabel(reference.validityStatus)}
                        </Badge>
                        <span className="text-xs leading-6 text-[var(--muted)]">
                          Фрагмент судебного прецедента
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6">{reference.snippet}</p>
                      <div className="mt-3 space-y-1 text-xs leading-6 text-[var(--muted)]">
                        <p>
                          Источник темы:{" "}
                          <Link className="text-[var(--accent)] underline" href={reference.sourceTopicUrl}>
                            {reference.sourceTopicUrl}
                          </Link>
                        </p>
                        {renderSourcePosts(reference.sourcePosts)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </Card>
  );
}
