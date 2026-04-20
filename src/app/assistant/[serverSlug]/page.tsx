import Link from "next/link";

import { AssistantQuestionForm } from "@/components/product/legal-assistant/assistant-question-form";
import { AssistantServerSelector } from "@/components/product/legal-assistant/assistant-server-selector";
import { Card } from "@/components/ui/card";
import { PageContainer } from "@/components/ui/page-container";
import { getServerByCode, listAssistantServers } from "@/db/repositories/server.repository";
import { type AssistantQuestionActionState } from "@/server/actions/legal-assistant";
import { parseAssistantAnswerSections } from "@/server/legal-assistant/answer-pipeline";
import {
  type AssistantGuestAnswerSnapshot,
  getAssistantGuestUsageState,
} from "@/server/legal-assistant/guest-session";
import { getAssistantViewerContext } from "@/server/legal-assistant/viewer";

export const dynamic = "force-dynamic";

type AssistantServerPageProps = {
  params: Promise<{
    serverSlug: string;
  }>;
};

function buildInitialQuestionState(input: {
  isAuthenticated: boolean;
  savedAnswer: AssistantGuestAnswerSnapshot | null;
  hasGuestQuestionAvailable: boolean;
}): AssistantQuestionActionState {
  if (!input.savedAnswer) {
    return {
      status: "idle",
      errorMessage: null,
      fieldErrors: {},
      answer: null,
      requiresAuthCta: false,
    };
  }

  return {
    status: !input.isAuthenticated && !input.hasGuestQuestionAvailable ? "guest_limit_reached" : "answered",
    errorMessage:
      !input.isAuthenticated && !input.hasGuestQuestionAvailable
        ? "Гостевой тестовый вопрос уже использован. Старый ответ остаётся доступным, а для нового вопроса войди или зарегистрируйся."
        : null,
    fieldErrors: {},
    answer: {
      question: input.savedAnswer.questionText,
      answerMarkdown: input.savedAnswer.answerMarkdown,
      sections: parseAssistantAnswerSections(input.savedAnswer.answerMarkdown),
      metadata:
        input.savedAnswer.answerMetadataJson &&
        typeof input.savedAnswer.answerMetadataJson === "object"
          ? (input.savedAnswer.answerMetadataJson as Record<string, unknown>)
          : null,
      status: input.savedAnswer.answerStatus,
    },
    requiresAuthCta: !input.isAuthenticated && !input.hasGuestQuestionAvailable,
  };
}

export default async function AssistantServerPage({ params }: AssistantServerPageProps) {
  const resolvedParams = await params;
  const [servers, viewer, server] = await Promise.all([
    listAssistantServers(),
    getAssistantViewerContext(),
    getServerByCode(resolvedParams.serverSlug),
  ]);
  const guestUsageState = viewer.isAuthenticated ? null : await getAssistantGuestUsageState();
  const selectedServer =
    servers.find((item) => item.code === resolvedParams.serverSlug) ??
    (server
      ? {
          id: server.id,
          code: server.code,
          name: server.name,
          hasCurrentLawCorpus: false,
          currentPrimaryLawCount: 0,
        }
      : null);

  if (!selectedServer) {
    return (
      <PageContainer>
        <main className="min-h-screen px-6 py-10">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
            <Card className="space-y-3">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
                Server Legal Assistant
              </p>
              <h1 className="text-3xl font-semibold">Сервер не найден</h1>
              <p className="text-sm leading-6 text-[var(--muted)]">
                Такой `serverSlug` сейчас не найден среди доступных server context. Выбери сервер
                вручную ниже.
              </p>
            </Card>

            <AssistantServerSelector servers={servers} />
          </div>
        </main>
      </PageContainer>
    );
  }

  const initialState = buildInitialQuestionState({
    isAuthenticated: viewer.isAuthenticated,
    savedAnswer: guestUsageState?.savedAnswer ?? null,
    hasGuestQuestionAvailable: guestUsageState?.hasGuestQuestionAvailable ?? true,
  });

  return (
    <PageContainer>
      <main className="min-h-screen px-6 py-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
          <div className="flex flex-wrap items-center gap-3 text-sm leading-6 text-[var(--muted)]">
            <Link className="text-[var(--accent)] underline" href="/assistant">
              Все серверы assistant
            </Link>
            <span>Текущий serverSlug: {selectedServer.code}</span>
          </div>

          <AssistantServerSelector
            currentServerCode={selectedServer.code}
            servers={servers}
          />

          {!selectedServer.hasCurrentLawCorpus ? (
            <Card className="space-y-3">
              <h1 className="text-3xl font-semibold">{selectedServer.name}</h1>
              <p className="text-sm leading-6 text-[var(--muted)]">
                Для этого сервера пока нет подтвержденного current law corpus. Помощник не может
                честно отвечать, пока подтвержденные primary laws не подготовлены.
              </p>
            </Card>
          ) : (
            <AssistantQuestionForm
              initialState={initialState}
              isAssistantAvailable
              isAuthenticated={viewer.isAuthenticated}
              serverName={selectedServer.name}
              serverSlug={selectedServer.code}
            />
          )}
        </div>
      </main>
    </PageContainer>
  );
}
