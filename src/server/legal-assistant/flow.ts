import { getServerByCode } from "@/db/repositories/server.repository";
import {
  generateServerLegalAssistantAnswer,
  parseAssistantAnswerSections,
} from "@/server/legal-assistant/answer-pipeline";
import {
  getAssistantGuestUsageState,
  storeAssistantGuestAnswer,
} from "@/server/legal-assistant/guest-session";
import { getAssistantViewerContext } from "@/server/legal-assistant/viewer";
import { assistantQuestionInputSchema } from "@/schemas/legal-assistant";

type LegalAssistantFlowDependencies = {
  getServerByCode: typeof getServerByCode;
  getAssistantViewerContext: typeof getAssistantViewerContext;
  getAssistantGuestUsageState: typeof getAssistantGuestUsageState;
  storeAssistantGuestAnswer: typeof storeAssistantGuestAnswer;
  generateServerLegalAssistantAnswer: typeof generateServerLegalAssistantAnswer;
};

const defaultDependencies: LegalAssistantFlowDependencies = {
  getServerByCode,
  getAssistantViewerContext,
  getAssistantGuestUsageState,
  storeAssistantGuestAnswer,
  generateServerLegalAssistantAnswer,
};

export async function answerLegalAssistantQuestion(
  input: {
    serverSlug: string;
    question: string;
    actorContext?: "self" | "representative_for_trustor" | "general_question";
  },
  dependencies: LegalAssistantFlowDependencies = defaultDependencies,
) {
  const parsed = assistantQuestionInputSchema.parse(input);
  const server = await dependencies.getServerByCode(parsed.serverSlug);

  if (!server) {
    return {
      status: "server-not-found" as const,
      message: "Выбранный сервер не найден или сейчас недоступен.",
    };
  }

  const viewer = await dependencies.getAssistantViewerContext();
  const guestUsageState = viewer.isAuthenticated
    ? null
    : await dependencies.getAssistantGuestUsageState();

  if (!viewer.isAuthenticated && guestUsageState && !guestUsageState.hasGuestQuestionAvailable) {
    return {
      status: "guest-limit-reached" as const,
      server: {
        id: server.id,
        code: server.code,
        name: server.name,
      },
      savedAnswer:
        guestUsageState.savedAnswer &&
        guestUsageState.savedAnswer.answerMetadataJson &&
        typeof guestUsageState.savedAnswer.answerMetadataJson === "object"
          ? {
              question: guestUsageState.savedAnswer.questionText,
              answerMarkdown: guestUsageState.savedAnswer.answerMarkdown,
              sections: parseAssistantAnswerSections(guestUsageState.savedAnswer.answerMarkdown),
              metadata: guestUsageState.savedAnswer.answerMetadataJson,
              status: guestUsageState.savedAnswer.answerStatus,
            }
          : guestUsageState.savedAnswer
            ? {
                question: guestUsageState.savedAnswer.questionText,
                answerMarkdown: guestUsageState.savedAnswer.answerMarkdown,
                sections: parseAssistantAnswerSections(guestUsageState.savedAnswer.answerMarkdown),
                metadata: null,
                status: guestUsageState.savedAnswer.answerStatus,
              }
            : null,
      requiresAuthCta: true,
    };
  }

  const answerResult = await dependencies.generateServerLegalAssistantAnswer({
    serverId: server.id,
    serverCode: server.code,
    serverName: server.name,
    question: parsed.question,
    actorContext: parsed.actorContext,
    accountId: viewer.account?.id ?? null,
    guestSessionId: guestUsageState?.session?.id ?? null,
  });

  if (answerResult.status === "answered" || answerResult.status === "no_norms") {
    if (!viewer.isAuthenticated) {
      await dependencies.storeAssistantGuestAnswer({
        serverId: server.id,
        questionText: parsed.question,
        answerMarkdown: answerResult.answerMarkdown,
        answerMetadataJson: answerResult.metadata,
        answerStatus: answerResult.status === "answered" ? "answered" : "no_norms",
      });
    }

    return {
      status: answerResult.status,
      server: {
        id: server.id,
        code: server.code,
        name: server.name,
      },
      answer: {
        question: parsed.question,
        answerMarkdown: answerResult.answerMarkdown,
        sections: answerResult.sections,
        metadata: answerResult.metadata,
      },
      viewer: {
        isAuthenticated: viewer.isAuthenticated,
      },
      requiresAuthCta: !viewer.isAuthenticated,
    } as const;
  }

  if (answerResult.status === "no_corpus") {
    return {
      status: "no-corpus" as const,
      server: {
        id: server.id,
        code: server.code,
        name: server.name,
      },
      message: answerResult.message,
      metadata: answerResult.metadata,
    };
  }

  return {
    status: "unavailable" as const,
    server: {
      id: server.id,
      code: server.code,
      name: server.name,
    },
    message: answerResult.message,
    metadata: answerResult.metadata,
  };
}
