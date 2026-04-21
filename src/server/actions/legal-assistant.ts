"use server";

import { ZodError } from "zod";

import { answerLegalAssistantQuestion } from "@/server/legal-assistant/flow";

export type AssistantRenderedAnswer = {
  question: string;
  answerMarkdown: string;
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

export type AssistantQuestionActionState = {
  status:
    | "idle"
    | "answered"
    | "no_norms"
    | "guest_limit_reached"
    | "no_corpus"
    | "unavailable"
    | "error";
  errorMessage: string | null;
  fieldErrors: {
    question?: string;
  };
  answer: AssistantRenderedAnswer | null;
  requiresAuthCta: boolean;
};

export async function submitAssistantQuestionAction(
  _previousState: AssistantQuestionActionState,
  formData: FormData,
): Promise<AssistantQuestionActionState> {
  const serverSlug = typeof formData.get("serverSlug") === "string" ? String(formData.get("serverSlug")) : "";
  const question = typeof formData.get("question") === "string" ? String(formData.get("question")) : "";

  try {
    const result = await answerLegalAssistantQuestion({
      serverSlug,
      question,
    });

    if (result.status === "answered" || result.status === "no_norms") {
      return {
        status: result.status,
        errorMessage: null,
        fieldErrors: {},
        answer: {
          ...result.answer,
          status: result.status,
        },
        requiresAuthCta: result.requiresAuthCta,
      };
    }

    if (result.status === "guest-limit-reached") {
      return {
        status: "guest_limit_reached",
        errorMessage:
          "Гостевой тестовый вопрос уже использован. Старый ответ остаётся доступным, а для нового вопроса войди или зарегистрируйся.",
        fieldErrors: {},
        answer: result.savedAnswer,
        requiresAuthCta: true,
      };
    }

    if (result.status === "no-corpus") {
      return {
        status: "no_corpus",
        errorMessage: result.message,
        fieldErrors: {},
        answer: null,
        requiresAuthCta: false,
      };
    }

    if (result.status === "unavailable") {
      return {
        status: "unavailable",
        errorMessage: result.message,
        fieldErrors: {},
        answer: null,
        requiresAuthCta: false,
      };
    }

    return {
      status: "error",
      errorMessage: "Не удалось определить выбранный сервер для юридического помощника.",
      fieldErrors: {},
      answer: null,
      requiresAuthCta: false,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      const fieldErrors = error.flatten().fieldErrors;

      return {
        status: "error",
        errorMessage: null,
        fieldErrors: {
          question: fieldErrors.question?.[0],
        },
        answer: null,
        requiresAuthCta: false,
      };
    }

    return {
      status: "error",
      errorMessage: "Не удалось обработать вопрос по законодательной базе. Попробуй ещё раз.",
      fieldErrors: {},
      answer: null,
      requiresAuthCta: false,
    };
  }
}
