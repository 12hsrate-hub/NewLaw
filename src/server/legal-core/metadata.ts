export const legalCoreIntents = [
  "law_explanation",
  "situation_analysis",
  "complaint_strategy",
  "evidence_check",
  "qualification_check",
  "document_text_improvement",
] as const;

export const legalCoreActorContexts = [
  "self",
  "representative_for_trustor",
  "general_question",
] as const;

export const legalCoreResponseModes = ["short", "normal", "detailed", "document_ready"] as const;

export const legalCoreAnswerConfidences = ["low", "medium", "high"] as const;
export const legalCoreRiskLevels = ["low", "medium", "high"] as const;

export type LegalCoreIntent = (typeof legalCoreIntents)[number];
export type LegalCoreActorContext = (typeof legalCoreActorContexts)[number];
export type LegalCoreResponseMode = (typeof legalCoreResponseModes)[number];
export type LegalCoreAnswerConfidence = (typeof legalCoreAnswerConfidences)[number];
export type LegalCoreRiskLevel = (typeof legalCoreRiskLevels)[number];

export type LegalCoreSelfAssessment = {
  answer_confidence: LegalCoreAnswerConfidence;
  insufficient_data: boolean;
  answer_risk_level: LegalCoreRiskLevel;
};

function hasKeyword(source: string, keywords: string[]) {
  return keywords.some((keyword) => source.includes(keyword));
}

export function classifyAssistantIntent(question: string): LegalCoreIntent {
  const normalizedQuestion = question.trim().toLowerCase();

  if (
    hasKeyword(normalizedQuestion, [
      "доказ",
      "подтверж",
      "хватит ли",
      "достаточно ли",
      "скрин",
      "видео",
      "запись",
    ])
  ) {
    return "evidence_check";
  }

  if (
    hasKeyword(normalizedQuestion, [
      "квалифиц",
      "квалификац",
      "состав",
      "как квалифицировать",
      "как квалифициру",
    ])
  ) {
    return "qualification_check";
  }

  if (
    hasKeyword(normalizedQuestion, [
      "жалоб",
      "стратег",
      "как подать",
      "как действовать",
      "что делать",
      "как лучше",
      "обжал",
    ])
  ) {
    return "complaint_strategy";
  }

  if (
    hasKeyword(normalizedQuestion, [
      "объясни",
      "поясни",
      "что значит",
      "что такое",
      "как понимать",
      "разъясни",
    ])
  ) {
    return "law_explanation";
  }

  return "situation_analysis";
}

export function detectQuestionResponseMode(question: string): LegalCoreResponseMode {
  const normalizedQuestion = question.trim().toLowerCase();

  if (hasKeyword(normalizedQuestion, ["кратко", "коротко", "в двух словах"])) {
    return "short";
  }

  if (hasKeyword(normalizedQuestion, ["подробно", "детально", "развернуто", "развёрнуто"])) {
    return "detailed";
  }

  if (
    hasKeyword(normalizedQuestion, [
      "готовый текст",
      "сразу текст",
      "готовый документ",
      "готовую формулировку",
    ])
  ) {
    return "document_ready";
  }

  return "normal";
}

export function deriveActorContextFromFilingMode(
  filingMode: "self" | "representative",
): LegalCoreActorContext {
  return filingMode === "representative" ? "representative_for_trustor" : "self";
}

export function buildAssistantSelfAssessment(input: {
  status: "answered" | "no_norms" | "no_corpus" | "unavailable";
  lawResultCount: number;
  precedentResultCount: number;
}): LegalCoreSelfAssessment {
  if (input.status === "no_corpus" || input.status === "unavailable") {
    return {
      answer_confidence: "low",
      insufficient_data: true,
      answer_risk_level: "high",
    };
  }

  if (input.status === "no_norms") {
    return {
      answer_confidence: "low",
      insufficient_data: true,
      answer_risk_level: "high",
    };
  }

  if (input.lawResultCount === 0 && input.precedentResultCount > 0) {
    return {
      answer_confidence: "medium",
      insufficient_data: true,
      answer_risk_level: "medium",
    };
  }

  if (input.lawResultCount > 0 && input.precedentResultCount > 0) {
    return {
      answer_confidence: "high",
      insufficient_data: false,
      answer_risk_level: "low",
    };
  }

  return {
    answer_confidence: "medium",
    insufficient_data: false,
    answer_risk_level: "low",
  };
}

export function buildDocumentRewriteSelfAssessment(input: {
  missingDataCount: number;
  sourceLength: number;
}): LegalCoreSelfAssessment {
  if (input.sourceLength === 0) {
    return {
      answer_confidence: "low",
      insufficient_data: true,
      answer_risk_level: "high",
    };
  }

  if (input.missingDataCount > 0) {
    return {
      answer_confidence: "medium",
      insufficient_data: true,
      answer_risk_level: "medium",
    };
  }

  return {
    answer_confidence: "high",
    insufficient_data: false,
    answer_risk_level: "low",
  };
}

export function buildGroundedDocumentRewriteSelfAssessment(input: {
  missingDataCount: number;
  sourceLength: number;
  groundingMode: "law_grounded" | "precedent_grounded" | null;
  lawResultCount: number;
  precedentResultCount: number;
}): LegalCoreSelfAssessment {
  if (input.sourceLength === 0 || input.groundingMode === null) {
    return {
      answer_confidence: "low",
      insufficient_data: true,
      answer_risk_level: "high",
    };
  }

  if (input.missingDataCount > 0) {
    return {
      answer_confidence: "medium",
      insufficient_data: true,
      answer_risk_level: "medium",
    };
  }

  if (input.groundingMode === "precedent_grounded" || input.lawResultCount === 0) {
    return {
      answer_confidence: "medium",
      insufficient_data: input.precedentResultCount === 0,
      answer_risk_level: "medium",
    };
  }

  return {
    answer_confidence: "high",
    insufficient_data: false,
    answer_risk_level: "low",
  };
}
