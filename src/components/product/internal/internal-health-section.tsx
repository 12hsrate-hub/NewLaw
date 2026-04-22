import { Card } from "@/components/ui/card";
import { resolveAssistantStatusUi } from "@/components/product/server-directory/status-ui";
import type { InternalHealthContext } from "@/server/internal/health";

type InternalHealthSectionProps = {
  context: InternalHealthContext;
};

export function InternalHealthSection({
  context,
}: InternalHealthSectionProps) {
  return (
    <section className="space-y-6">
      <Card className="space-y-4 border-[#d7c4b6] bg-white/80">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-[#8c5a36]">Internal health</p>
          <h2 className="text-3xl font-semibold">Corpus, Assistant and Runtime Summary</h2>
          <p className="max-w-3xl text-sm leading-6 text-[#6f6258]">
            Это internal-only compact summary по состоянию corpus, assistant availability и runtime
            readiness. Здесь нет расширенного operational UI или raw internal explorers.
          </p>
        </div>
      </Card>

      <Card className="space-y-4 border-[#d7c4b6] bg-white/80">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.24em] text-[#8c5a36]">Runtime</p>
          <h3 className="text-2xl font-semibold">Application Health</h3>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Status</p>
            <p className="mt-2 text-lg font-medium">{context.runtime.status}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Environment</p>
            <p className="mt-2 text-lg font-medium">{context.runtime.environment}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Prisma</p>
            <p className="mt-2 text-lg font-medium">{context.runtime.checks.prisma}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Database</p>
            <p className="mt-2 text-lg font-medium">{context.runtime.checks.database}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3 text-sm leading-6 text-[var(--muted)]">
          Последняя проверка:{" "}
          <span className="font-medium text-[var(--foreground)]">{context.runtime.timestamp}</span>
        </div>
      </Card>

      <Card className="space-y-4 border-[#d7c4b6] bg-white/80">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.24em] text-[#8c5a36]">Warnings</p>
          <h3 className="text-2xl font-semibold">Concise Attention Points</h3>
        </div>

        {context.warnings.length > 0 ? (
          <div className="space-y-3">
            {context.warnings.map((warning, index) => (
              <div
                className="rounded-2xl border border-[#d7c4b6] bg-[#fff5eb] px-4 py-3 text-sm leading-6 text-[#7a3f1d]"
                key={`${warning.message}-${index}`}
              >
                {warning.message}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3 text-sm leading-6 text-[var(--muted)]">
            На summary-уровне критичных warning signals сейчас не найдено.
          </div>
        )}
      </Card>

      <div className="space-y-4">
        {context.serverSummaries.map((serverSummary) => {
          const assistantUi = resolveAssistantStatusUi(serverSummary.assistantStatus);

          return (
            <Card className="space-y-4 border-[#d7c4b6] bg-white/80" key={serverSummary.id}>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-[#8c5a36]">
                  <span>Server</span>
                  <span>·</span>
                  <span>{serverSummary.code}</span>
                </div>
                <h3 className="text-2xl font-semibold">{serverSummary.name}</h3>
                <p className="text-sm leading-6 text-[var(--muted)]">
                  {assistantUi.description}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    Assistant
                  </p>
                  <p className="mt-2 text-lg font-medium">{assistantUi.label}</p>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    Current primary laws
                  </p>
                  <p className="mt-2 text-lg font-medium">{serverSummary.currentPrimaryLawCount}</p>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    Law sources
                  </p>
                  <p className="mt-2 text-lg font-medium">
                    {serverSummary.enabledLawSourceCount} / {serverSummary.totalLawSourceCount}
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    Precedent topics
                  </p>
                  <p className="mt-2 text-lg font-medium">{serverSummary.precedentTopicCount}</p>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    Current precedents
                  </p>
                  <p className="mt-2 text-lg font-medium">{serverSummary.currentPrecedentCount}</p>
                </div>
              </div>

              {serverSummary.warnings.length > 0 ? (
                <div className="space-y-2">
                  {serverSummary.warnings.map((warning, index) => (
                    <div
                      className="rounded-2xl border border-[#d7c4b6] bg-[#fff5eb] px-4 py-3 text-sm leading-6 text-[#7a3f1d]"
                      key={`${serverSummary.id}-${warning.message}-${index}`}
                    >
                      {warning.message}
                    </div>
                  ))}
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>
    </section>
  );
}
