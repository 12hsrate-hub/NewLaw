import type { LegalCoreIntent } from "@/server/legal-core/metadata";

function normalizeQuestion(input: string) {
  return input.trim().toLowerCase();
}

function hasKeyword(source: string, keywords: string[]) {
  return keywords.some((keyword) => source.includes(keyword));
}

function pushUniqueTerms(target: string[], terms: string[]) {
  for (const term of terms) {
    if (!target.includes(term)) {
      target.push(term);
    }
  }
}

export function buildAssistantRetrievalQuery(input: {
  normalizedQuestion: string;
  intent: LegalCoreIntent;
}) {
  const normalizedQuestion = input.normalizedQuestion.trim();

  if (normalizedQuestion.length === 0) {
    return normalizedQuestion;
  }

  const normalizedSource = normalizeQuestion(normalizedQuestion);
  const hintTerms: string[] = [];

  if (hasKeyword(normalizedSource, ["маск"])) {
    pushUniqueTerms(hintTerms, [
      "административный кодекс",
      "процессуальный кодекс",
      "маскировка",
      "скрытие личности",
      "идентификация личности",
      "штраф",
      "тикет",
      "задержание",
    ]);
  }

  if (hasKeyword(normalizedSource, ["задерж"])) {
    pushUniqueTerms(hintTerms, [
      "процессуальный кодекс",
      "задержание",
      "основания задержания",
    ]);
  }

  if (hasKeyword(normalizedSource, ["адвокат", "защитник"])) {
    pushUniqueTerms(hintTerms, ["адвокат", "адвокатура", "процессуальный кодекс"]);
  }

  if (
    hasKeyword(normalizedSource, ["адвокат", "защитник"]) &&
    hasKeyword(normalizedSource, ["задерж"])
  ) {
    pushUniqueTerms(hintTerms, ["причины задержания", "видеофиксация задержания"]);
  }

  if (hasKeyword(normalizedSource, ["запрос"]) && hasKeyword(normalizedSource, ["адвокат"])) {
    pushUniqueTerms(hintTerms, [
      "официальный адвокатский запрос",
      "уголовный кодекс",
      "неисполнение правовых актов",
    ]);
  }

  if (hasKeyword(normalizedSource, ["бодикам", "body-cam", "bodycam", "видеозапис", "видеофиксац"])) {
    pushUniqueTerms(hintTerms, [
      "процессуальный кодекс",
      "видеозапись задержания",
      "видеофиксация",
      "body-cam",
    ]);
  }

  if (input.intent === "complaint_strategy") {
    pushUniqueTerms(hintTerms, ["жалоба", "обжалование"]);
  }

  if (input.intent === "evidence_check") {
    pushUniqueTerms(hintTerms, ["доказательства", "видеозапись"]);
  }

  if (hintTerms.length === 0) {
    return normalizedQuestion;
  }

  return `${normalizedQuestion}\n\nretrieval_hints: ${hintTerms.join("; ")}`;
}
