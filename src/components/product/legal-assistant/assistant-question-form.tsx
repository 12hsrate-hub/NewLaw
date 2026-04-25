"use client";

import Link from "next/link";
import { useActionState } from "react";

import { AssistantAnswerCard } from "@/components/product/legal-assistant/assistant-answer-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  submitAssistantQuestionAction,
  type AssistantQuestionActionState,
} from "@/server/actions/legal-assistant";

function readActorContextFromMetadata(metadata: Record<string, unknown> | null | undefined) {
  const actorContext = metadata?.actor_context;

  return actorContext === "self" ||
    actorContext === "representative_for_trustor" ||
    actorContext === "general_question"
    ? actorContext
    : "general_question";
}

type AssistantQuestionFormProps = {
  serverSlug: string;
  serverName: string;
  initialState: AssistantQuestionActionState;
  isAuthenticated: boolean;
  isAssistantAvailable: boolean;
};

export function AssistantQuestionForm({
  serverSlug,
  serverName,
  initialState,
  isAuthenticated,
  isAssistantAvailable,
}: AssistantQuestionFormProps) {
  const [state, formAction, isPending] = useActionState(
    submitAssistantQuestionAction,
    initialState,
  );
  const safeState = state ?? initialState;
  const isGuestBlocked = safeState.status === "guest_limit_reached";
  const isSubmitDisabled = isPending || !isAssistantAvailable || isGuestBlocked;
  const selectedActorContext = readActorContextFromMetadata(safeState.answer?.metadata);

  return (
    <div className="space-y-6">
      <Card className="space-y-5">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
            Server Legal Assistant
          </p>
          <h1 className="text-3xl font-semibold">{serverName}</h1>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Помощник отвечает только по подтвержденному corpus выбранного сервера: current primary
            laws и, где это уместно, reviewed judicial precedents. Знания вне корпуса не
            используются.
          </p>
          <p className="text-sm leading-6 text-[var(--muted)]">
            {isAuthenticated
              ? "Ты вошёл в аккаунт. В этом шаге отдельный лимит для зарегистрированного пользователя не действует."
              : "Гостю доступен только 1 тестовый вопрос. После первого ответа старый ответ останется видимым, а новый вопрос попросит вход или регистрацию."}
          </p>
        </div>

        <form action={formAction} className="space-y-4">
          <input name="serverSlug" type="hidden" value={serverSlug} />

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="actorContext">
              Контекст вопроса
            </label>
            <select
              className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm"
              defaultValue={selectedActorContext}
              id="actorContext"
              name="actorContext"
            >
              <option value="general_question">Общий вопрос</option>
              <option value="self">Действую от себя</option>
              <option value="representative_for_trustor">Действую в интересах доверителя</option>
            </select>
            <p className="text-sm leading-6 text-[var(--muted)]">
              Это влияет на рамку анализа и формулировки ответа, но не расширяет правовую опору за
              пределы законодательства выбранного сервера.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="question">
              Вопрос по законодательной базе сервера
            </label>
            <Textarea
              defaultValue={safeState.answer?.question ?? ""}
              id="question"
              name="question"
              placeholder="Например: может ли договор считаться действительным без письменного оформления?"
              required
            />
            {safeState.fieldErrors.question ? (
              <p className="text-sm leading-6 text-[#8a2d1d]">{safeState.fieldErrors.question}</p>
            ) : null}
          </div>

          <Button disabled={isSubmitDisabled} fullWidth type="submit">
            {isPending ? "Готовим ответ..." : "Задать вопрос"}
          </Button>
        </form>

        {safeState.errorMessage ? (
          <p className="text-sm leading-6 text-[#8a2d1d]">{safeState.errorMessage}</p>
        ) : null}

        {safeState.requiresAuthCta ? (
          <div className="rounded-2xl border border-[var(--border)] bg-white/60 p-4 text-sm leading-6 text-[var(--muted)]">
            <p>Чтобы задать новый вопрос, войди в аккаунт или зарегистрируйся.</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <Link className="text-[var(--accent)] underline" href={`/sign-in?next=/assistant/${serverSlug}`}>
                Войти
              </Link>
              <Link className="text-[var(--accent)] underline" href={`/sign-up?next=/assistant/${serverSlug}`}>
                Зарегистрироваться
              </Link>
            </div>
          </div>
        ) : null}
      </Card>

      {safeState.answer ? <AssistantAnswerCard answer={safeState.answer} /> : null}
    </div>
  );
}
