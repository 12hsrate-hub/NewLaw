import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type AssistantAnswerCardProps = {
  answer: {
    question: string;
    sections: {
      summary: string;
      normativeAnalysis: string;
      interpretation: string;
      sources?: string;
    };
    metadata: Record<string, unknown> | null;
    status?: "answered" | "no_norms";
  };
};

type ReferenceItem = {
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

function readReferenceItems(metadata: Record<string, unknown> | null) {
  const references = metadata?.references;

  return Array.isArray(references) ? (references as ReferenceItem[]) : [];
}

function readCorpusSnapshot(metadata: Record<string, unknown> | null) {
  const snapshot = metadata?.corpusSnapshot;

  if (!snapshot || typeof snapshot !== "object") {
    return null;
  }

  return snapshot as {
    corpusSnapshotHash?: string;
    currentVersionIds?: string[];
  };
}

export function AssistantAnswerCard({ answer }: AssistantAnswerCardProps) {
  const references = readReferenceItems(answer.metadata);
  const corpusSnapshot = readCorpusSnapshot(answer.metadata);

  return (
    <Card className="space-y-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Badge>{answer.status === "no_norms" ? "Норма не найдена" : "Ответ построен по корпусу"}</Badge>
          {corpusSnapshot?.corpusSnapshotHash ? (
            <span className="text-xs leading-6 text-[var(--muted)]">
              corpus snapshot: <code>{corpusSnapshot.corpusSnapshotHash}</code>
            </span>
          ) : null}
        </div>
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
          <h2 className="text-lg font-semibold">Что прямо следует из норм</h2>
          <p className="text-sm leading-7 text-[var(--foreground)]">
            {answer.sections.normativeAnalysis}
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Вывод / интерпретация</h2>
          <p className="text-sm leading-7 text-[var(--foreground)]">
            {answer.sections.interpretation}
          </p>
        </section>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Использованные нормы / источники</h2>

        {references.length === 0 ? (
          <p className="text-sm leading-6 text-[var(--muted)]">
            В этом ответе нет подтвержденных блоков корпуса, на которые можно сослаться напрямую.
          </p>
        ) : (
          <div className="space-y-3">
            {references.map((reference) => (
              <div
                key={reference.lawBlockId}
                className="rounded-2xl border border-[var(--border)] bg-white/60 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{reference.lawTitle}</Badge>
                  <span className="text-xs leading-6 text-[var(--muted)]">
                    {reference.articleNumberNormalized
                      ? `Статья ${reference.articleNumberNormalized}`
                      : `Блок ${reference.blockType} #${reference.blockOrder}`}
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
                  {reference.sourcePosts.length > 0 ? (
                    <p>
                      Посты:{" "}
                      {reference.sourcePosts.map((sourcePost, index) => (
                        <span key={sourcePost.postExternalId}>
                          {index > 0 ? ", " : ""}
                          <Link
                            className="text-[var(--accent)] underline"
                            href={sourcePost.postUrl}
                          >
                            #{sourcePost.postOrder}
                          </Link>
                        </span>
                      ))}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </Card>
  );
}
