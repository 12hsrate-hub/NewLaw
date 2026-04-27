import type { ComplaintNarrativeRiskFlag } from "@/schemas/document-ai";

type ComplaintNarrativeReviewStatus = {
  title: string;
  description: string;
  tone: "ready" | "review" | "rework";
};

const severeComplaintNarrativeRiskFlags = new Set<ComplaintNarrativeRiskFlag>([
  "insufficient_facts",
  "weak_legal_context",
  "legal_basis_not_found",
]);

function hasMissingTextReason(reasons: string[]) {
  return reasons.some((reason) => {
    const normalized = reason.toLowerCase();

    return normalized.includes("нет текста") || normalized.includes("пока нет текста");
  });
}

export function formatDocumentRewriteBlockedMessage(
  mode: "standard" | "grounded",
  reasons: string[],
) {
  if (hasMissingTextReason(reasons)) {
    return mode === "grounded"
      ? "Сначала заполните этот фрагмент текста, чтобы проверить его с опорой на нормы."
      : "Сначала заполните этот фрагмент текста, чтобы улучшить формулировку.";
  }

  return mode === "grounded"
    ? "Для этого фрагмента пока недоступна проверка с опорой на нормы. Используйте текущий текст как основу и при необходимости уточните правовую опору вручную."
    : "Исходный текст сохранён. Не удалось подготовить новый вариант — проверьте содержание раздела и повторите попытку.";
}

export function formatDocumentRewriteUnavailableMessage(mode: "standard" | "grounded") {
  return mode === "grounded"
    ? "Проверка с опорой на нормы временно недоступна. Исходный текст сохранён, можно попробовать ещё раз позже."
    : "Не удалось улучшить формулировку. Исходный текст сохранён, можно попробовать ещё раз.";
}

export function formatGroundedRewriteInsufficientCorpusMessage() {
  return "Для этого фрагмента пока недостаточно подтверждённых правовых оснований. Проверьте формулировку и при необходимости добавьте нормы вручную.";
}

export function formatComplaintNarrativeUnavailableMessage(
  mode: "unavailable" | "invalid-output",
) {
  return mode === "invalid-output"
    ? "Не удалось проверить предложенный текст. Исходное описание сохранено, можно повторить попытку позже."
    : "Не удалось улучшить описание. Исходный текст сохранён, можно попробовать ещё раз.";
}

export function resolveComplaintNarrativeReviewStatus(input: {
  riskFlags: ComplaintNarrativeRiskFlag[];
  shouldSendToReview: boolean;
}): ComplaintNarrativeReviewStatus {
  const hasSevereRisk = input.riskFlags.some((flag) =>
    severeComplaintNarrativeRiskFlags.has(flag),
  );

  if (hasSevereRisk) {
    return {
      title: "Перед использованием текст нужно доработать",
      description:
        "В тексте пока не хватает важных фактов или точной правовой опоры. Сначала лучше уточнить замечания ниже.",
      tone: "rework",
    };
  }

  if (input.shouldSendToReview || input.riskFlags.length > 0) {
    return {
      title: "Текст нужно проверить перед использованием",
      description:
        "Текст можно использовать как основу, но перед подачей лучше проверить замечания ниже.",
      tone: "review",
    };
  }

  return {
    title: "Текст можно использовать как основу",
    description:
      "Существенных замечаний по этому варианту нет. Перед использованием достаточно обычной проверки.",
    tone: "ready",
  };
}
