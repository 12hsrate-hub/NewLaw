"use client";

import { useActionState, useEffect, useState } from "react";

import { AssistantAnswerCard } from "@/components/product/legal-assistant/assistant-answer-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  runInternalAILegalCoreScenariosAction,
  type InternalAILegalCoreActionState,
} from "@/server/actions/internal-ai-legal-core";
import type { InternalAILegalCorePageContext } from "@/server/internal/ai-legal-core";

type InternalAILegalCoreSectionProps = {
  context: InternalAILegalCorePageContext;
  initialState: InternalAILegalCoreActionState;
};

function formatNullableMetric(value: number | null, suffix = "") {
  return value === null ? "n/a" : `${value}${suffix}`;
}

function formatNullableCost(value: number | null) {
  return value === null ? "n/a" : `$${value.toFixed(6)}`;
}

function formatDelta(value: number | null, suffix = "") {
  if (value === null) {
    return "n/a";
  }

  const sign = value > 0 ? "+" : "";

  return `${sign}${value}${suffix}`;
}

function readGroupTitle(
  groups: InternalAILegalCorePageContext["scenarioGroups"],
  groupKey: string,
) {
  return groups.find((group) => group.key === groupKey)?.title ?? groupKey;
}

function readTargetFlowLabel(targetFlow: string) {
  return targetFlow === "document_text_improvement"
    ? "document_text_improvement"
    : "server_legal_assistant";
}

export function InternalAILegalCoreSection({
  context,
  initialState,
}: InternalAILegalCoreSectionProps) {
  const [state, formAction, isPending] = useActionState(
    runInternalAILegalCoreScenariosAction,
    initialState,
  );
  const safeState = state ?? initialState;
  const firstAvailableGroup =
    context.scenarioGroups.find((group) => group.scenarios.length > 0)?.key ??
    context.scenarioGroups[0]?.key ??
    "general_legal_questions";
  const [selectedGroup, setSelectedGroup] = useState(firstAvailableGroup);
  const selectedGroupData =
    context.scenarioGroups.find((group) => group.key === selectedGroup) ?? context.scenarioGroups[0];
  const firstAvailableScenario = selectedGroupData?.scenarios[0]?.id ?? "";
  const [selectedScenarioId, setSelectedScenarioId] = useState(firstAvailableScenario);

  useEffect(() => {
    const nextScenarioId = selectedGroupData?.scenarios[0]?.id ?? "";

    if (!selectedGroupData?.scenarios.some((scenario) => scenario.id === selectedScenarioId)) {
      setSelectedScenarioId(nextScenarioId);
    }
  }, [selectedGroupData, selectedScenarioId]);

  return (
    <section className="space-y-6">
      <Card className="space-y-4 border-[#d7c4b6] bg-white/80">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-[#8c5a36]">AI legal core</p>
          <h2 className="text-3xl font-semibold">Test Scenarios Runner</h2>
          <p className="max-w-3xl text-sm leading-6 text-[#6f6258]">
            Это internal `super_admin` surface для ручного прогона `AI Legal Core` по test
            scenarios. В текущем practical slice сценарии запускаются через `server legal
            assistant`, поэтому весь путь проходит через тот же legal-core pipeline:
            normalization, retrieval, generation, self-assessment и hidden routing в шаг `17`.
          </p>
        </div>
      </Card>

      <Card className="space-y-4 border-[#d7c4b6] bg-white/80">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.24em] text-[#8c5a36]">Implementation scope</p>
          <h3 className="text-2xl font-semibold">Текущие границы implementation</h3>
        </div>

        <div className="space-y-3">
          {context.implementationNotes.map((note, index) => (
            <div
              className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3 text-sm leading-6 text-[#6f6258]"
              key={`${index}-${note}`}
            >
              {note}
            </div>
          ))}
        </div>
      </Card>

      <Card className="space-y-5 border-[#d7c4b6] bg-white/80">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.24em] text-[#8c5a36]">Run controls</p>
          <h3 className="text-2xl font-semibold">Параметры тестового прогона</h3>
        </div>

        <form action={formAction} className="space-y-5">
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="serverSlug">
                Сервер
              </label>
              <select
                className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm"
                defaultValue={context.servers[0]?.code ?? ""}
                id="serverSlug"
                name="serverSlug"
              >
                {context.servers.map((server) => (
                  <option key={server.id} value={server.code}>
                    {server.name} ({server.code}) · laws={server.currentPrimaryLawCount} · precedents=
                    {server.currentPrecedentCount}
                  </option>
                ))}
              </select>
              {safeState.fieldErrors.serverSlug ? (
                <p className="text-sm leading-6 text-[#8a2d1d]">{safeState.fieldErrors.serverSlug}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="lawVersionSelection">
                Версия законодательства
              </label>
              <select
                className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm"
                defaultValue={context.lawVersionOptions[0]?.value ?? "current_snapshot_only"}
                id="lawVersionSelection"
                name="lawVersionSelection"
              >
                {context.lawVersionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-sm leading-6 text-[#6f6258]">
                {context.lawVersionOptions[0]?.description}
              </p>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="actorContext">
                Actor context
              </label>
              <select
                className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm"
                defaultValue="general_question"
                id="actorContext"
                name="actorContext"
              >
                {context.actorContextOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-sm leading-6 text-[#6f6258]">
                {context.actorContextOptions.find((option) => option.value === "general_question")
                  ?.description ?? ""}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="answerMode">
                Answer mode
              </label>
              <select
                className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm"
                defaultValue="normal"
                id="answerMode"
                name="answerMode"
              >
                {context.answerModeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-sm leading-6 text-[#6f6258]">
                {context.answerModeOptions.find((option) => option.value === "normal")?.description ??
                  ""}
              </p>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="scenarioGroup">
                Группа сценариев
              </label>
              <select
                className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm"
                id="scenarioGroup"
                name="scenarioGroup"
                onChange={(event) => {
                  setSelectedGroup(event.target.value as typeof firstAvailableGroup);
                }}
                value={selectedGroup}
              >
                {context.scenarioGroups.map((group) => (
                  <option key={group.key} value={group.key}>
                    {group.title} · scenarios={group.scenarioCount} · {group.runMode}
                  </option>
                ))}
              </select>
              <p className="text-sm leading-6 text-[#6f6258]">
                {selectedGroupData?.description ?? ""}
              </p>
              {safeState.fieldErrors.scenarioGroup ? (
                <p className="text-sm leading-6 text-[#8a2d1d]">{safeState.fieldErrors.scenarioGroup}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="scenarioId">
                Один сценарий
              </label>
              <select
                className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm"
                disabled={(selectedGroupData?.scenarios.length ?? 0) === 0}
                id="scenarioId"
                name="scenarioId"
                onChange={(event) => {
                  setSelectedScenarioId(event.target.value);
                }}
                value={selectedScenarioId}
              >
                {(selectedGroupData?.scenarios ?? []).map((scenario) => (
                  <option key={scenario.id} value={scenario.id}>
                    {scenario.title}
                    {" · "}
                    {readTargetFlowLabel(scenario.targetFlow)}
                  </option>
                ))}
              </select>
              <p className="text-sm leading-6 text-[#6f6258]">
                {selectedGroupData?.scenarios.find((scenario) => scenario.id === selectedScenarioId)
                  ?.expectedBehavior ??
                  "Для этой группы individual assistant scenario пока не подключён."}
              </p>
              {safeState.fieldErrors.scenarioId ? (
                <p className="text-sm leading-6 text-[#8a2d1d]">{safeState.fieldErrors.scenarioId}</p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              disabled={isPending || (selectedGroupData?.scenarios.length ?? 0) === 0}
              name="runTarget"
              type="submit"
              value="scenario"
            >
              {isPending ? "Запускаем..." : "Прогнать сценарий"}
            </Button>
            <Button
              disabled={isPending || (selectedGroupData?.scenarios.length ?? 0) === 0}
              name="runTarget"
              type="submit"
              value="group"
              variant="secondary"
            >
              {isPending ? "Запускаем..." : "Прогнать до 4 сценариев из группы"}
            </Button>
          </div>
        </form>

        {safeState.errorMessage ? (
          <p className="text-sm leading-6 text-[#8a2d1d]">{safeState.errorMessage}</p>
        ) : null}
      </Card>

      <Card className="space-y-4 border-[#d7c4b6] bg-white/80">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.24em] text-[#8c5a36]">Scenario registry</p>
          <h3 className="text-2xl font-semibold">Покрытие test scenarios</h3>
        </div>

        <div className="space-y-3">
          {context.scenarioGroups.map((group) => (
            <div
              className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-4"
              key={group.key}
            >
              <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-[#8c5a36]">
                <span>{group.title}</span>
                <span>·</span>
                <span>{group.runMode}</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-[#6f6258]">{group.description}</p>
              <p className="mt-2 text-sm leading-6 text-[#6f6258]">
                active scenarios: {group.scenarioCount}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {safeState.runSummary ? (
        <Card className="space-y-4 border-[#d7c4b6] bg-white/80">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.24em] text-[#8c5a36]">Run summary</p>
            <h3 className="text-2xl font-semibold">Итоги прогона</h3>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Run id</p>
              <p className="mt-2 break-all text-sm font-medium">{safeState.runSummary.testRunId}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Server</p>
              <p className="mt-2 text-sm font-medium">
                {safeState.runSummary.serverName} ({safeState.runSummary.serverCode})
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Scenarios</p>
              <p className="mt-2 text-lg font-medium">{safeState.runSummary.scenarioCount}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Sent to review</p>
              <p className="mt-2 text-lg font-medium">{safeState.runSummary.sentToReviewCount}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Completed</p>
              <p className="mt-2 text-sm font-medium">{safeState.runSummary.completedAt}</p>
            </div>
          </div>
        </Card>
      ) : null}

      {safeState.results.length > 0 ? (
        <div className="space-y-6">
          {safeState.results.map((result) => (
            <Card className="space-y-5 border-[#d7c4b6] bg-white/80" key={result.scenarioId}>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-[#8c5a36]">
                  <span>{readGroupTitle(context.scenarioGroups, result.scenarioGroup)}</span>
                  <span>·</span>
                  <span>{readTargetFlowLabel(result.targetFlow)}</span>
                  <span>·</span>
                  <span>{result.status}</span>
                  {result.technical.reviewPriority ? (
                    <>
                      <span>·</span>
                      <span>review {result.technical.reviewPriority}</span>
                    </>
                  ) : null}
                </div>
                <h3 className="text-2xl font-semibold">{result.scenarioTitle}</h3>
                <p className="text-sm leading-6 text-[#6f6258]">
                  Ввод: <span className="font-medium text-[#1e1916]">{result.inputText}</span>
                </p>
                <p className="text-sm leading-6 text-[#6f6258]">
                  Expected behavior: {result.expectedBehavior}
                </p>
                {result.message ? (
                  <p className="text-sm leading-6 text-[#8a2d1d]">{result.message}</p>
                ) : null}
              </div>

              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-6">
                <div className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Confidence</p>
                  <p className="mt-2 text-lg font-medium">{result.technical.confidence ?? "n/a"}</p>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Insufficient</p>
                  <p className="mt-2 text-lg font-medium">
                    {result.technical.insufficientData === null
                      ? "n/a"
                      : result.technical.insufficientData
                        ? "yes"
                        : "no"}
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Used sources</p>
                  <p className="mt-2 text-lg font-medium">{result.technical.usedSources.length}</p>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Tokens</p>
                  <p className="mt-2 text-lg font-medium">
                    {formatNullableMetric(result.technical.tokens)}
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Cost</p>
                  <p className="mt-2 text-lg font-medium">{formatNullableCost(result.technical.costUsd)}</p>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Latency</p>
                  <p className="mt-2 text-lg font-medium">
                    {formatNullableMetric(result.technical.latencyMs, " ms")}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[#8c5a36]">Used sources</p>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs leading-5 text-[#6f6258]">
                  {JSON.stringify(result.technical.usedSources, null, 2)}
                </pre>
              </div>

              {result.comparison ? (
                <Card className="space-y-4 border-[#d7c4b6] bg-white/70">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.18em] text-[#8c5a36]">
                      Before / after
                    </p>
                    <h4 className="text-xl font-semibold">
                      Сравнение с предыдущим прогоном этого сценария
                    </h4>
                    <p className="text-sm leading-6 text-[#6f6258]">
                      Current run: {result.comparison.current.testRunId}
                      {result.comparison.previous
                        ? ` · previous run: ${result.comparison.previous.testRunId}`
                        : " · previous run: none"}
                    </p>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-[#8c5a36]">Previous</p>
                      <p className="text-sm leading-6 text-[#6f6258]">
                        {result.comparison.previous?.outputPreview ??
                          "Для этого сценария пока нет предыдущего test run."}
                      </p>
                    </div>
                    <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-[#8c5a36]">Current</p>
                      <p className="text-sm leading-6 text-[#1e1916]">
                        {result.comparison.current.outputPreview ?? "n/a"}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-4">
                    <div className="rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                        Tokens delta
                      </p>
                      <p className="mt-2 text-lg font-medium">
                        {formatDelta(result.comparison.deltas.tokens)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                        Cost delta
                      </p>
                      <p className="mt-2 text-lg font-medium">
                        {formatDelta(result.comparison.deltas.costUsd, " USD")}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                        Latency delta
                      </p>
                      <p className="mt-2 text-lg font-medium">
                        {formatDelta(result.comparison.deltas.latencyMs, " ms")}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                        Used sources delta
                      </p>
                      <p className="mt-2 text-lg font-medium">
                        {formatDelta(result.comparison.deltas.usedSourcesCount)}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-4">
                    <div className="rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                        Output changed
                      </p>
                      <p className="mt-2 text-lg font-medium">
                        {result.comparison.changed.outputPreview ? "yes" : "no"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                        Confidence changed
                      </p>
                      <p className="mt-2 text-lg font-medium">
                        {result.comparison.changed.confidence ? "yes" : "no"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                        Insufficient changed
                      </p>
                      <p className="mt-2 text-lg font-medium">
                        {result.comparison.changed.insufficientData ? "yes" : "no"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                        Review changed
                      </p>
                      <p className="mt-2 text-lg font-medium">
                        {result.comparison.changed.sentToReview ? "yes" : "no"}
                      </p>
                    </div>
                  </div>
                </Card>
              ) : null}

              {result.answer ? <AssistantAnswerCard answer={result.answer} /> : null}
              {result.rewrite ? (
                <Card className="space-y-4 border-[#d7c4b6] bg-white/70">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.18em] text-[#8c5a36]">
                      Document text improvement
                    </p>
                    <h4 className="text-xl font-semibold">Результат AI-доработки описательной части</h4>
                  </div>
                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-[#8c5a36]">Исходный текст</p>
                      <p className="text-sm leading-6 text-[#6f6258]">{result.rewrite.sourceText}</p>
                    </div>
                    <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-[#8c5a36]">Улучшенный текст</p>
                      <p className="text-sm leading-6 text-[#1e1916]">{result.rewrite.suggestionText}</p>
                    </div>
                  </div>
                </Card>
              ) : null}
            </Card>
          ))}
        </div>
      ) : null}
    </section>
  );
}
