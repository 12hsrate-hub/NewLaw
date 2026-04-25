import { Card } from "@/components/ui/card";
import type { InternalAIReviewPageContext } from "@/server/internal/ai-review";

type InternalAIReviewSectionProps = {
  context: InternalAIReviewPageContext;
};

export function InternalAIReviewSection({
  context,
}: InternalAIReviewSectionProps) {
  const analytics = context.reviewPreview.analytics;

  return (
    <section className="space-y-6">
      <Card className="space-y-4 border-[#d7c4b6] bg-white/80">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-[#8c5a36]">AI review</p>
          <h2 className="text-3xl font-semibold">AI Quality Review Workflow</h2>
          <p className="max-w-3xl text-sm leading-6 text-[#6f6258]">
            Это internal-only process surface для `super_admin`: здесь собраны queued AI-cases,
            repo-managed `AI Behavior Rules` и шаблон `fix_instruction`. Контур не вносит правки
            автоматически и нужен как мост между review snapshot и инженерным PR-циклом.
          </p>
        </div>
      </Card>

      <Card className="space-y-4 border-[#d7c4b6] bg-white/80">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.24em] text-[#8c5a36]">Access model</p>
          <h3 className="text-2xl font-semibold">Access Scope Preview</h3>
          <p className="max-w-3xl text-sm leading-6 text-[#6f6258]">
            Ниже показано, как review-данные должны разделяться по ролям. Текущий route остаётся
            `super_admin`-only, но сами view-модели уже готовы для раздельной выдачи без утечки raw
            цепочки.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[#8c5a36]">super_admin</p>
            <p className="text-sm leading-6 text-[#6f6258]">
              Видит полный raw chain, flags, review items, retrieved sources, final output и
              внутренние служебные поля review snapshot.
            </p>
            <p className="text-xs leading-5 text-[#8c5a36]">
              visibility: {context.accessViews.superAdmin.visibility}
            </p>
          </div>

          <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[#8c5a36]">server_admin</p>
            <p className="text-sm leading-6 text-[#6f6258]">
              Получает только обезличенную статистику без raw input, normalized input и полного
              текста ответа.
            </p>
            <p className="text-xs leading-5 text-[#8c5a36]">
              visibility: {context.accessViews.serverAdmin.visibility}
            </p>
            <p className="text-sm leading-6 text-[#6f6258]">
              queued={context.accessViews.serverAdmin.queuedCount} · high=
              {context.accessViews.serverAdmin.byPriority.high} · medium=
              {context.accessViews.serverAdmin.byPriority.medium} · low=
              {context.accessViews.serverAdmin.byPriority.low}
            </p>
          </div>

          <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[#8c5a36]">tester</p>
            <p className="text-sm leading-6 text-[#6f6258]">
              Видит только sanitized test examples: признаки кейса и наличие chain components без
              показа исходного пользовательского ввода.
            </p>
            <p className="text-xs leading-5 text-[#8c5a36]">
              visibility: {context.accessViews.tester.visibility}
            </p>
            <p className="text-sm leading-6 text-[#6f6258]">
              examples={context.accessViews.tester.examples.length}
            </p>
          </div>
        </div>
      </Card>

      <Card className="space-y-4 border-[#d7c4b6] bg-white/80">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.24em] text-[#8c5a36]">Review analytics</p>
          <h3 className="text-2xl font-semibold">Queued Case Analytics</h3>
          <p className="max-w-3xl text-sm leading-6 text-[#6f6258]">
            Эта сводка помогает увидеть не только отдельные спорные кейсы, но и повторяемые
            паттерны: какие `flags`, `prompt_version`, `law_version` и root causes чаще всего
            приводят к очереди для `super_admin`.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Reviewed</p>
            <p className="mt-2 text-lg font-medium">{analytics.reviewedCount}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Queued</p>
            <p className="mt-2 text-lg font-medium">{analytics.queuedCount}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Total tokens</p>
            <p className="mt-2 text-lg font-medium">{analytics.totalTokens}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Total cost</p>
            <p className="mt-2 text-lg font-medium">${analytics.totalCostUsd.toFixed(6)}</p>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {[
            {
              title: "By root cause",
              items: analytics.byRootCause,
            },
            {
              title: "By flag",
              items: analytics.byFlag,
            },
            {
              title: "By prompt version",
              items: analytics.byPromptVersion,
            },
            {
              title: "By law version",
              items: analytics.byLawVersion,
            },
            {
              title: "By fix target",
              items: analytics.byFixTarget,
            },
          ].map((group) => (
            <div
              className="space-y-3 rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-4"
              key={group.title}
            >
              <p className="text-xs uppercase tracking-[0.18em] text-[#8c5a36]">{group.title}</p>
              {group.items.length > 0 ? (
                <div className="space-y-2">
                  {group.items.slice(0, 6).map((item) => (
                    <div
                      className="flex items-center justify-between gap-3 rounded-2xl border border-[#e6d6ca] bg-white/80 px-4 py-3 text-sm"
                      key={`${group.title}-${item.key}`}
                    >
                      <span className="break-all text-[#6f6258]">{item.key}</span>
                      <span className="font-medium text-[#1e1916]">{item.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm leading-6 text-[var(--muted)]">Пока нет данных.</p>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card className="space-y-4 border-[#d7c4b6] bg-white/80">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.24em] text-[#8c5a36]">Sanitized examples</p>
          <h3 className="text-2xl font-semibold">Tester View Preview</h3>
          <p className="max-w-3xl text-sm leading-6 text-[#6f6258]">
            Это пример того, как должна выглядеть безопасная тестовая выборка без raw input и без
            полного final output.
          </p>
        </div>

        {context.accessViews.tester.examples.length > 0 ? (
          <div className="space-y-3">
            {context.accessViews.tester.examples.map((example) => (
              <div
                className="space-y-3 rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-4"
                key={`tester-${example.id}`}
              >
                <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-[#8c5a36]">
                  <span>{example.featureKey}</span>
                  <span>·</span>
                  <span>{example.priority}</span>
                  <span>·</span>
                  <span>{example.rootCause}</span>
                </div>
                {example.flags.length > 0 ? (
                  <p className="text-sm leading-6 text-[#6f6258]">Flags: {example.flags.join(", ")}</p>
                ) : null}
                {example.reviewItems.length > 0 ? (
                  <p className="text-sm leading-6 text-[#6f6258]">
                    Review items: {example.reviewItems.join(" | ")}
                  </p>
                ) : null}
                <p className="text-sm leading-6 text-[#6f6258]">
                  chain: raw={example.availableChain.hasRawInput ? "present" : "absent"} · normalized=
                  {example.availableChain.hasNormalizedInput ? "present" : "absent"} · sources=
                  {example.availableChain.retrievedSourcesCount} · final_output=
                  {example.availableChain.hasFinalOutput ? "present" : "absent"}
                </p>
                {example.issueClusterKey ? (
                  <p className="text-xs leading-5 text-[#8c5a36]">
                    issue_cluster_key: {example.issueClusterKey}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3 text-sm leading-6 text-[var(--muted)]">
            Пока нет queued cases для sanitized tester preview.
          </div>
        )}
      </Card>

      <Card className="space-y-4 border-[#d7c4b6] bg-white/80">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.24em] text-[#8c5a36]">Queued cases</p>
          <h3 className="text-2xl font-semibold">Review Queue Summary</h3>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Queued cases</p>
            <p className="mt-2 text-lg font-medium">{context.reviewPreview.queuedCount}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">High</p>
            <p className="mt-2 text-lg font-medium">{context.reviewPreview.byPriority.high}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Medium</p>
            <p className="mt-2 text-lg font-medium">{context.reviewPreview.byPriority.medium}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Low</p>
            <p className="mt-2 text-lg font-medium">{context.reviewPreview.byPriority.low}</p>
          </div>
        </div>

        {context.reviewPreview.recentQueuedItems.length > 0 ? (
          <div className="space-y-3">
            {context.reviewPreview.recentQueuedItems.map((item) => (
              <div
                className="space-y-4 rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-4"
                key={item.id}
              >
                <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-[#8c5a36]">
                  <span>{item.featureKey}</span>
                  <span>·</span>
                  <span>{item.priority}</span>
                  <span>·</span>
                  <span>{item.rootCause}</span>
                  {item.aiReviewerStatus ? (
                    <>
                      <span>·</span>
                      <span>reviewer {item.aiReviewerStatus}</span>
                    </>
                  ) : null}
                  {item.server ? (
                    <>
                      <span>·</span>
                      <span>{item.server.code}</span>
                    </>
                  ) : null}
                </div>

                <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                      Quality score
                    </p>
                    <p className="mt-2 text-lg font-medium">{item.qualityScore ?? "n/a"}</p>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                      Confidence
                    </p>
                    <p className="mt-2 text-lg font-medium">{item.confidence ?? "n/a"}</p>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                      Input quality
                    </p>
                    <p className="mt-2 text-lg font-medium">{item.inputQuality ?? "n/a"}</p>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                      Fix target
                    </p>
                    <p className="mt-2 text-lg font-medium">{item.fixTarget ?? "n/a"}</p>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-[#8c5a36]">Raw input</p>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                      {item.caseChain.rawInput ?? "Не сохранён."}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-[#8c5a36]">
                      Normalized input
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                      {item.caseChain.normalizedInput ?? "Не сохранён."}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-[#8c5a36]">
                      changed={item.caseChain.normalizationChanged ? "yes" : "no"}
                      {item.caseChain.normalizationComparisonResult
                        ? ` · ${item.caseChain.normalizationComparisonResult}`
                        : ""}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-[#8c5a36]">
                      Retrieved sources
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                      Найдено источников: {item.caseChain.retrievedSources.length}
                    </p>
                    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs leading-5 text-[#6f6258]">
                      {item.caseChain.retrievedSources.length > 0
                        ? JSON.stringify(item.caseChain.retrievedSources, null, 2)
                        : "[]"}
                    </pre>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-[#8c5a36]">
                      Final output
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                      {item.caseChain.finalOutputPreview ?? item.outputPreview ?? "Preview пока отсутствует."}
                    </p>
                  </div>
                </div>

                {item.flags.length > 0 ? (
                  <p className="text-xs leading-5 text-[#8c5a36]">
                    Flags: {item.flags.join(", ")}
                  </p>
                ) : null}
                {item.reviewItems.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.18em] text-[#8c5a36]">
                      Review items
                    </p>
                    {item.reviewItems.map((reviewItem, index) => (
                      <div
                        className="rounded-2xl border border-[#d7c4b6] bg-[#fff8f2] px-4 py-3 text-sm leading-6 text-[#6f6258]"
                        key={`${item.id}-${index}-${reviewItem}`}
                      >
                        {reviewItem}
                      </div>
                    ))}
                  </div>
                ) : null}
                {item.issueClusterKey ? (
                  <p className="text-xs leading-5 text-[#8c5a36]">
                    issue_cluster_key: {item.issueClusterKey}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3 text-sm leading-6 text-[var(--muted)]">
            Сейчас в review queue нет кейсов, помеченных для `super_admin`.
          </div>
        )}
      </Card>

      <Card className="space-y-4 border-[#d7c4b6] bg-white/80">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.24em] text-[#8c5a36]">Behavior rules</p>
          <h3 className="text-2xl font-semibold">AI Behavior Rules Registry</h3>
          <p className="max-w-3xl text-sm leading-6 text-[#6f6258]">
            Это repo-managed реестр правил поведения AI. Он нужен, чтобы fix instructions не жили
            хаотично в отдельных кейсах и могли переходить в prompts, код и regression tests через
            обычный PR-процесс.
          </p>
        </div>

        <div className="space-y-4">
          {context.behaviorRules.map((rule) => (
            <div
              className="space-y-3 rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3"
              key={rule.ruleId}
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-[#8c5a36]">
                  <span>{rule.ruleId}</span>
                  <span>·</span>
                  <span>{rule.status}</span>
                </div>
                <h4 className="text-lg font-semibold">{rule.title}</h4>
              </div>

              <p className="text-sm leading-6 text-[#6f6258]">{rule.summary}</p>
              <p className="text-sm leading-6 text-[#6f6258]">
                Root causes: <span className="font-medium text-[#1e1916]">{rule.rootCauses.join(", ")}</span>
              </p>
              <p className="text-sm leading-6 text-[#6f6258]">
                Scope: <span className="font-medium text-[#1e1916]">{rule.scope.join(", ")}</span>
              </p>
              <p className="text-sm leading-6 text-[#6f6258]">
                Source of truth: <span className="font-medium text-[#1e1916]">{rule.sourceOfTruth}</span>
              </p>
              <p className="text-sm leading-6 text-[#6f6258]">
                Acceptance: <span className="font-medium text-[#1e1916]">{rule.acceptanceExpectation}</span>
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="space-y-4 border-[#d7c4b6] bg-white/80">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.24em] text-[#8c5a36]">Confirmed issues</p>
          <h3 className="text-2xl font-semibold">Confirmed Issue Registry</h3>
          <p className="max-w-3xl text-sm leading-6 text-[#6f6258]">
            Это repo-managed baseline для persisted annotations: сюда попадают уже подтверждённые
            классы проблем с привязкой к `AI Behavior Rules`, `fix_instruction` и regression
            follow-up.
          </p>
        </div>

        <div className="space-y-4">
          {context.confirmedIssues.map((issue) => (
            <div
              className="space-y-4 rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-4"
              key={issue.issueId}
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-[#8c5a36]">
                  <span>{issue.issueId}</span>
                  <span>·</span>
                  <span>{issue.status}</span>
                  <span>·</span>
                  <span>{issue.rootCause}</span>
                </div>
                <h4 className="text-lg font-semibold">{issue.title}</h4>
              </div>

              <p className="text-sm leading-6 text-[#6f6258]">{issue.summary}</p>
              <p className="text-sm leading-6 text-[#6f6258]">
                Scope: <span className="font-medium text-[#1e1916]">{issue.featureScope.join(", ")}</span>
              </p>
              <p className="text-sm leading-6 text-[#6f6258]">
                Linked rules:{" "}
                <span className="font-medium text-[#1e1916]">{issue.linkedRuleIds.join(", ")}</span>
              </p>
              <p className="text-sm leading-6 text-[#6f6258]">
                Source of truth: <span className="font-medium text-[#1e1916]">{issue.sourceOfTruth}</span>
              </p>
              <p className="text-sm leading-6 text-[#6f6258]">
                issue_fingerprint example:{" "}
                <span className="font-medium text-[#1e1916]">{issue.issueFingerprintExample}</span>
              </p>
              <p className="text-sm leading-6 text-[#6f6258]">
                issue_cluster_key example:{" "}
                <span className="font-medium text-[#1e1916]">{issue.issueClusterKeyExample}</span>
              </p>
              <p className="text-sm leading-6 text-[#6f6258]">
                fix_target: <span className="font-medium text-[#1e1916]">{issue.fixTarget ?? "n/a"}</span>
              </p>

              <div className="grid gap-4 xl:grid-cols-2">
                <div className="space-y-2 rounded-2xl border border-[#e6d6ca] bg-white/80 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#8c5a36]">
                    Fix instruction snapshot
                  </p>
                  <p className="text-sm leading-6 text-[#6f6258]">
                    Wrong: {issue.fixInstructionSnapshot.whatAIDidWrong}
                  </p>
                  <p className="text-sm leading-6 text-[#6f6258]">
                    Future behavior: {issue.fixInstructionSnapshot.correctFutureBehavior}
                  </p>
                  <p className="text-sm leading-6 text-[#6f6258]">
                    Bad example: {issue.fixInstructionSnapshot.badExample}
                  </p>
                  <p className="text-sm leading-6 text-[#6f6258]">
                    Good example: {issue.fixInstructionSnapshot.goodExample}
                  </p>
                  <p className="text-sm leading-6 text-[#6f6258]">
                    Codex instruction: {issue.fixInstructionSnapshot.codexInstruction}
                  </p>
                  <p className="text-sm leading-6 text-[#6f6258]">
                    Regression expectation: {issue.fixInstructionSnapshot.regressionExpectation}
                  </p>
                </div>

                <div className="space-y-2 rounded-2xl border border-[#e6d6ca] bg-white/80 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#8c5a36]">
                    Regression follow-up
                  </p>
                  <p className="text-sm leading-6 text-[#6f6258]">
                    status: <span className="font-medium text-[#1e1916]">{issue.regressionFollowUp.status}</span>
                  </p>
                  <p className="text-sm leading-6 text-[#6f6258]">
                    artifact: <span className="font-medium text-[#1e1916]">{issue.regressionFollowUp.artifact}</span>
                  </p>
                  <p className="text-sm leading-6 text-[#6f6258]">
                    justification:{" "}
                    <span className="font-medium text-[#1e1916]">
                      {issue.regressionFollowUp.justification ?? "n/a"}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="space-y-4 border-[#d7c4b6] bg-white/80">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.24em] text-[#8c5a36]">Fix instruction</p>
          <h3 className="text-2xl font-semibold">Fix Instruction Template</h3>
          <p className="max-w-3xl text-sm leading-6 text-[#6f6258]">
            Подтверждённая проблема не должна заканчиваться устной пометкой. Ниже минимальный
            шаблон, который нужно заполнить перед изменением prompts, кода или regression tests.
          </p>
        </div>

        <div className="space-y-3">
          {context.fixInstructionTemplate.map((field) => (
            <div
              className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3"
              key={field.fieldKey}
            >
              <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-[#8c5a36]">
                <span>{field.fieldKey}</span>
                <span>·</span>
                <span>{field.required ? "required" : "optional"}</span>
              </div>
              <p className="mt-2 text-base font-medium">{field.label}</p>
              <p className="mt-1 text-sm leading-6 text-[#6f6258]">{field.description}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="space-y-4 border-[#d7c4b6] bg-white/80">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.24em] text-[#8c5a36]">Regression gate</p>
          <h3 className="text-2xl font-semibold">Regression Gate Checklist</h3>
          <p className="max-w-3xl text-sm leading-6 text-[#6f6258]">
            Confirmed issue нельзя считать закрытым, пока не пройдён regression gate. Этот слой
            нужен, чтобы fix instruction не превращался в разовую договорённость без проверяемого
            инженерного следа.
          </p>
        </div>

        <div className="space-y-3">
          {context.regressionGateItems.map((item) => (
            <div
              className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3"
              key={item.itemKey}
            >
              <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-[#8c5a36]">
                <span>{item.itemKey}</span>
                <span>·</span>
                <span>{item.required ? "required" : "conditional"}</span>
              </div>
              <p className="mt-2 text-base font-medium">{item.label}</p>
              <p className="mt-1 text-sm leading-6 text-[#6f6258]">{item.description}</p>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          {context.regressionGateRules.map((rule) => (
            <div
              className="rounded-2xl border border-[#d7c4b6] bg-[#fff8f2] px-4 py-3"
              key={rule.ruleKey}
            >
              <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-[#8c5a36]">
                <span>{rule.ruleKey}</span>
              </div>
              <p className="mt-2 text-base font-medium">{rule.title}</p>
              <p className="mt-1 text-sm leading-6 text-[#6f6258]">{rule.summary}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="space-y-4 border-[#d7c4b6] bg-white/80">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.24em] text-[#8c5a36]">Workflow notes</p>
          <h3 className="text-2xl font-semibold">Human Review Guardrails</h3>
        </div>

        <div className="space-y-3">
          {context.workflowNotes.map((note, index) => (
            <div
              className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3 text-sm leading-6 text-[#6f6258]"
              key={`${index}-${note}`}
            >
              {note}
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}
