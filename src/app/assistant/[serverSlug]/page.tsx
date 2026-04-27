import Link from "next/link";

import { AssistantQuestionForm } from "@/components/product/legal-assistant/assistant-question-form";
import { AssistantServerSelector } from "@/components/product/legal-assistant/assistant-server-selector";
import { ProductStateCard } from "@/components/product/states/product-state-card";
import { PageContainer } from "@/components/ui/page-container";
import { EmbeddedCard } from "@/components/ui/embedded-card";
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
          hasUsablePrecedentCorpus: false,
          currentPrecedentCount: 0,
          hasUsableAssistantCorpus: false,
        }
      : null);

  if (!selectedServer) {
    return (
      <PageContainer as="main" contentClassName="flex flex-col gap-6" variant="wide">
        <ProductStateCard
          description="Такой сервер сейчас не найден среди доступных для помощника. Выберите другой сервер и попробуйте снова."
          eyebrow="Юридический помощник"
          primaryAction={{
            href: "/assistant",
            label: "Выбрать другой сервер",
          }}
          title="Сервер не найден"
        />

        <AssistantServerSelector servers={servers} />
      </PageContainer>
    );
  }

  const initialState = buildInitialQuestionState({
    isAuthenticated: viewer.isAuthenticated,
    savedAnswer: guestUsageState?.savedAnswer ?? null,
    hasGuestQuestionAvailable: guestUsageState?.hasGuestQuestionAvailable ?? true,
  });

  return (
    <PageContainer as="main" contentClassName="flex flex-col gap-6" variant="wide">
      <EmbeddedCard className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 text-sm leading-6 text-[var(--muted)]">
          <Link className="font-medium text-[var(--info)] underline-offset-4 transition hover:underline" href="/assistant">
            Все серверы
          </Link>
          <span>Выбран сервер: {selectedServer.name}</span>
        </div>
      </EmbeddedCard>

      <AssistantServerSelector currentServerCode={selectedServer.code} servers={servers} />

      {!selectedServer.hasUsableAssistantCorpus ? (
        <ProductStateCard
          badges={[`Сервер: ${selectedServer.name}`]}
          description="Для этого сервера пока недостаточно правовых материалов. Выберите другой сервер или вернитесь позже."
          eyebrow="Юридический помощник"
          primaryAction={{
            href: "/assistant",
            label: "Выбрать другой сервер",
          }}
          title="Помощник временно недоступен"
        />
      ) : (
        <AssistantQuestionForm
          initialState={initialState}
          isAssistantAvailable
          isAuthenticated={viewer.isAuthenticated}
          serverName={selectedServer.name}
          serverSlug={selectedServer.code}
        />
      )}
    </PageContainer>
  );
}
